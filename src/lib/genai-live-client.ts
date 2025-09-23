import {
  GoogleGenAI,
  LiveClientToolResponse,
  LiveServerMessage,
  Session,
} from '@google/genai';

import type {
  Content,
  LiveCallbacks,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
} from '@google/genai';

import { EventEmitter } from 'eventemitter3';
import { difference } from 'lodash-es';
import type { LiveClientOptions, StreamingLog } from './types';
import { base64ToArrayBuffer } from './utils';

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (error: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
}

/**
 * A event-emitting class that manages the connection to the websocket
 */
export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  private _session: Session | null = null;
  public get session() {
    return this._session;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;

  public getConfig() {
    return { ...this.config };
  }

  constructor(options: LiveClientOptions) {
    super();
    console.log('Initializing GenAI client with API key length:', options.apiKey?.length || 0)
    // 直接傳遞整個options對象給GoogleGenAI構造函數
    this.client = new GoogleGenAI(options as any);
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: StreamingLog['message']) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit('log', log);
  }

  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      console.log('Already connected or connecting, status:', this._status)
      return false;
    }

    console.log('Starting connection process...')
    this._status = 'connecting';
    this.config = config;
    this._model = model;

    const callbacks: LiveCallbacks = {
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
      onclose: this.onclose,
    };

    try {
      console.log('Calling client.live.connect with:', { model, config })
      this._session = await this.client.live.connect({
        model,
        config,
        callbacks,
      });
      console.log('Connection established, session:', this._session)
    } catch (e) {
      console.error('Error connecting to GenAI Live:', e);
      this._status = 'disconnected';
      // 觸發錯誤事件
      this.emit('error', new ErrorEvent('Connection failed', { 
        error: e as Error
      }));
      return false;
    }

    this._status = 'connected';
    return true;
  }

  public disconnect() {
    if (!this.session) {
      return false;
    }
    this.session?.close();
    this._session = null;
    this._status = 'disconnected';

    this.log('client.close', `Disconnected`);
    return true;
  }

  protected onopen() {
    console.log('WebSocket connection opened')
    this.log('client.open', 'Connected');
    this.emit('open');
  }

  protected onerror(e: ErrorEvent) {
    console.error('WebSocket error:', e)
    this.log('server.error', e.message);
    this.emit('error', e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this.emit('close', e);
  }

  protected async onmessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.log('server.send', 'setupComplete');
      this.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('server.toolCallCancellation', message);
      this.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if ('interrupted' in serverContent) {
        this.log('server.content', 'interrupted');
        this.emit('interrupted');
        return;
      }
      if ('turnComplete' in serverContent) {
        this.log('server.content', 'turnComplete');
        this.emit('turncomplete');
      }

      if ('modelTurn' in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];

        // when its audio that is returned for modelTurn
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith('audio/pcm')
        );
        const base64s = audioParts.map((p) => p.inlineData?.data);

        // strip the audio parts out of the modelTurn
        const otherParts = difference(parts, audioParts);

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit('audio', data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        this.emit('content', content);
        this.log(`server.content`, message);
      }
    } else {
      console.log('received unmatched message', message);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      this.session?.sendRealtimeInput({ media: ch });
      if (ch.mimeType.includes('audio')) {
        hasAudio = true;
      }
      if (ch.mimeType.includes('image')) {
        hasVideo = true;
      }
      if (hasAudio && hasVideo) {
        break;
      }
    }
    const message =
      hasAudio && hasVideo
        ? 'audio + video'
        : hasAudio
        ? 'audio'
        : hasVideo
        ? 'video'
        : 'unknown';
    this.log(`client.realtimeInput`, message);
  }

  /**
   *  send a response to a function call and provide the id of the functions you are responding to
   */
  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log(`client.toolResponse`, toolResponse);
    }
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    this.session?.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, {
      turns: Array.isArray(parts) ? parts : [parts],
      turnComplete,
    });
  }
}