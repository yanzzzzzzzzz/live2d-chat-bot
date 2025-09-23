import { ref, onUnmounted, computed } from 'vue';
import type { LiveConnectConfig } from '@google/genai';
import { GenAILiveClient } from '../lib/genai-live-client';
import { AudioStreamer } from '../lib/audio-streamer';
import type { LiveClientOptions } from '../lib/types';
import { audioContext } from '../lib/utils';

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
};

export function useLiveAPI(options: LiveClientOptions): UseLiveAPIResults {
  const client = new GenAILiveClient(options);
  let audioStreamer: AudioStreamer | null = null;

  const model = ref<string>('models/gemini-2.0-flash-exp');
  const config = ref<LiveConnectConfig>({});
  const connected = ref(false);
  const volume = ref(0);

  // 計算屬性來返回當前值
  const currentConfig = computed(() => config.value);
  const currentModel = computed(() => model.value);
  const isConnected = computed(() => connected.value);
  const currentVolume = computed(() => volume.value);

  // Initialize audio streamer
  const initAudioStreamer = async () => {
    if (!audioStreamer) {
      console.log('🔊 Initializing audio streamer...')
      const audioCtx = await audioContext();
      audioStreamer = new AudioStreamer(audioCtx);
      
      // 設置音頻完成回調
      audioStreamer.onComplete = () => {
        console.log('🎵 Audio playback completed')
      }
      
      console.log('✅ Audio streamer initialized')
    }
  };

  // Set up client event listeners
  const setupClientEvents = () => {
    const onOpen = () => {
      connected.value = true;
    };

    const onClose = () => {
      connected.value = false;
    };

    const onError = (error: ErrorEvent) => {
      console.error('error', error);
    };

    const stopAudioStreamer = () => audioStreamer?.stop();

    const onAudio = async (data: ArrayBuffer) => {
      console.log('🎵 Processing audio data, size:', data.byteLength)
      // 不再直接播放音頻，只是通過事件傳遞數據讓 GeminiLive.vue 處理
      // 註釋掉直接音頻播放的邏輯
      // if (!audioStreamer) {
      //   console.log('🔊 Audio streamer not ready, initializing...')
      //   await initAudioStreamer();
      // }
      // 
      // if (audioStreamer) {
      //   console.log('▶️ Adding audio to streamer')
      //   audioStreamer.addPCM16(new Uint8Array(data));
      // } else {
      //   console.error('❌ Failed to initialize audio streamer')
      // }
      
      console.log('📤 Forwarding audio data to GeminiLive for collection')
    };

    client
      .on('error', onError)
      .on('open', onOpen)
      .on('close', onClose)
      .on('interrupted', stopAudioStreamer)
      .on('audio', onAudio);

    return () => {
      client
        .off('error', onError)
        .off('open', onOpen)
        .off('close', onClose)
        .off('interrupted', stopAudioStreamer)
        .off('audio', onAudio);
    };
  };

  // Set up event listeners
  const cleanup = setupClientEvents();

  const connect = async () => {
    if (!config.value) {
      throw new Error('config has not been set');
    }
    
    console.log('🔌 Preparing to connect...')
    client.disconnect();
    
    // 確保音頻系統在連接前就準備好
    console.log('🔊 Ensuring audio streamer is ready...')
    await initAudioStreamer();
    
    console.log('🚀 Connecting to Gemini Live...')
    await client.connect(model.value, config.value);
    
    // 讓音頻上下文準備好接收音頻
    if (audioStreamer) {
      await audioStreamer.resume();
      console.log('🎵 Audio streamer resumed and ready')
    }
  };

  const disconnect = async () => {
    client.disconnect();
    connected.value = false;
  };

  const setConfig = (newConfig: LiveConnectConfig) => {
    config.value = newConfig;
  };

  const setModel = (newModel: string) => {
    model.value = newModel;
  };

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
    client.disconnect();
    audioStreamer?.stop();
  });

  return {
    client,
    get config() { return currentConfig.value; },
    setConfig,
    get model() { return currentModel.value; },
    setModel,
    get connected() { return isConnected.value; },
    connect,
    disconnect,
    get volume() { return currentVolume.value; },
  };
}