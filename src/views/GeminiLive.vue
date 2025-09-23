<template>
  <div class="gemini-live-container">
    <div class="controls-panel">
      <button 
        class="connect-btn" 
        :class="{ connected: isConnected, connecting: isConnecting }"
        @click="toggleConnection"
        :disabled="isConnecting"
      >
        {{ connectionButtonText }}
      </button>
      
      <div class="api-key-input" v-if="!isConnected">
        <input 
          v-model="apiKey" 
          type="password" 
          placeholder="請輸入 Gemini API Key"
          class="api-input"
          @input="clearError"
        />
        <small class="api-hint">
          請確保您的API Key有效並且已啟用Gemini Live功能
        </small>
      </div>
      
      <div class="voice-controls" v-if="isConnected">
        <div class="voice-status">
          <div class="status-text">
            {{ isListening ? '🎤 聽取中 - 請說話' : '🔇 未在聽取' }}
          </div>
          <div class="volume-indicator">
            <AudioPulse :active="isListening" :volume="inputVolume" />
            <span class="volume-text">音量: {{ Math.round(inputVolume * 100) }}%</span>
          </div>
        </div>
        <button @click="toggleListening" class="voice-btn">
          {{ isListening ? '停止聽取' : '開始聽取' }}
        </button>
      </div>
      
      <div class="status-info">
        <p>連線狀態: {{ connectionStatus }}</p>
        <p v-if="lastError" class="error">錯誤: {{ lastError }}</p>
        <details v-if="lastError" class="debug-info">
          <summary>調試信息</summary>
          <p>API Key 長度: {{ apiKey.length }}</p>
          <p>API Key 開頭: {{ apiKey.substring(0, 10) }}...</p>
          <p>請確保API Key正確且有Gemini Live權限</p>
        </details>
      </div>
    </div>

    <ModelCanvas ref="canvasRef" :initialScale="modelScale" />
    <AudioControls @play="onPlay" @stop="onStop" />
    <ScaleControls :scale="modelScale" :presets="presets" @zoom-in="onZoomIn" @zoom-out="onZoomOut" @set-scale="onSetScale" />
    <OffsetControls :x="modelOffsetX" :y="modelOffsetY" :minX="offsetMinX" :maxX="offsetMaxX" :minY="offsetMinY" :maxY="offsetMaxY" @update:x="onUpdateX" @update:y="onUpdateY" @reset-x="onResetX" @reset-y="onResetY" @reset-all="onResetAll" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ModelCanvas from '@/components/ModelCanvas.vue'
import AudioControls from '@/components/AudioControls.vue'
import AudioPulse from '@/components/AudioPulse.vue'
import ScaleControls from '@/components/ScaleControls.vue'
import OffsetControls from '@/components/OffsetControls.vue'
import { useLiveAPI } from '@/composables/useLiveAPI'
import { AudioRecorder } from '@/lib/audio-recorder'

const modelScale = ref(0.5)
const presets = [0.05, 0.1, 0.2, 0.5, 1]

const modelOffsetX = ref(0)
const modelOffsetY = ref(0)

const offsetMinX = ref(-400)
const offsetMaxX = ref(400)
const offsetMinY = ref(-800)
const offsetMaxY = ref(800)

const canvasRef = ref<InstanceType<typeof ModelCanvas> | null>(null)

// Gemini Live API相關狀態
const apiKey = ref('')
const isConnecting = ref(false)
const isConnected = ref(false)
const lastError = ref('')
const isListening = ref(false)
let mediaRecorder: MediaRecorder | null = null
let audioRecorder: AudioRecorder | null = null

// 音量狀態
const inputVolume = ref(0)

// 音頻緩存相關變量
const audioChunks = ref<ArrayBuffer[]>([])
const currentAudioUrl = ref<string | null>(null)
let audioCollecting = false

// 使用Live API
let liveAPI: ReturnType<typeof useLiveAPI> | null = null

const connectionStatus = computed(() => {
  if (isConnecting.value) return '連接中...'
  if (isConnected.value) return '已連接'
  return '未連接'
})

const connectionButtonText = computed(() => {
  if (isConnecting.value) return '連接中...'
  if (isConnected.value) return '斷開連接'
  return '連線到Gemini Live'
})

// 初始化Live API
const initLiveAPI = () => {
  if (!apiKey.value.trim()) {
    lastError.value = '請輸入API Key'
    return
  }

  try {
    liveAPI = useLiveAPI({ apiKey: apiKey.value })
    
    // 設置配置
    liveAPI.setConfig({
      generationConfig: {
        responseModalities: ['AUDIO'] as any,
        speechConfig: {
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: 'Charon'
            } 
          }
        }
      },
      systemInstruction: {
        parts: [{
          text: 'You are a friendly AI assistant. Please respond in English with short, natural responses.'
        }]
      }
    })

    // 監聽連接狀態變化
    liveAPI.client.on('open', () => {
      console.log('Connection opened')
      isConnected.value = true
      isConnecting.value = false
      lastError.value = ''
    })

    liveAPI.client.on('close', () => {
      console.log('Connection closed')
      isConnected.value = false
      isConnecting.value = false
      // 連線斷開時停止聽取
      stopListening()
    })

    liveAPI.client.on('error', (error) => {
      console.error('Live API error:', error)
      lastError.value = error.message || '連接錯誤'
      isConnecting.value = false
      isConnected.value = false
    })

    // 監聽音頻數據並收集到緩存中
    liveAPI.client.on('audio', (audioData: ArrayBuffer) => {
      console.log('🎵 Received audio data:', audioData.byteLength, 'bytes')
      
      // 開始收集音頻數據
      if (!audioCollecting) {
        console.log('🎬 Starting audio collection...')
        audioChunks.value = []
        audioCollecting = true
      }
      
      // 將音頻數據添加到緩存中
      audioChunks.value.push(audioData.slice()) // 創建副本
      console.log('📦 Collected audio chunk, total chunks:', audioChunks.value.length)
    })

    liveAPI.client.on('turncomplete', () => {
      console.log('🏁 Turn complete - conversation round ended')
      
      // 如果正在收集音頻數據，現在處理它們
      if (audioCollecting && audioChunks.value.length > 0) {
        console.log('🔄 Processing collected audio data...')
        processCollectedAudio()
        audioCollecting = false
      }
    })

    liveAPI.client.on('interrupted', () => {
      console.log('⚠️ Interrupted')
      
      // 如果正在收集音頻數據，現在處理它們
      if (audioCollecting && audioChunks.value.length > 0) {
        console.log('🔄 Processing collected audio data (interrupted)...')
        processCollectedAudio()
      }
      audioCollecting = false
    })

    liveAPI.client.on('content', (data) => {
      console.log('📝 Received content:', data)
    })

    liveAPI.client.on('setupcomplete', () => {
      console.log('✅ Setup completed - ready for conversation')
      // 連線設定完成後，自動開始音頻錄製
      startListening()
    })

    lastError.value = ''
  } catch (error: any) {
    console.error('Failed to initialize Live API:', error)
    lastError.value = '初始化失敗: ' + (error.message || error)
    isConnecting.value = false
    isConnected.value = false
  }
}

// 連接/斷開連接
const toggleConnection = async () => {
  if (isConnected.value) {
    await disconnect()
  } else {
    await connect()
  }
}

const connect = async () => {
  if (!liveAPI) {
    initLiveAPI()
  }

  if (!liveAPI) {
    return
  }

  try {
    isConnecting.value = true
    isConnected.value = false
    lastError.value = ''
    
    console.log('Attempting to connect to Gemini Live API...')
    await liveAPI.connect()
    console.log('Connect call completed')
  } catch (error: any) {
    console.error('Connection failed:', error)
    lastError.value = '連接失敗: ' + (error.message || error)
    isConnecting.value = false
    isConnected.value = false
  }
}

const disconnect = async () => {
  if (liveAPI) {
    await liveAPI.disconnect()
    stopListening()
  }
  isConnected.value = false
  isConnecting.value = false
}

// 清除錯誤信息
const clearError = () => {
  lastError.value = ''
}

// 處理收集的音頻數據並轉換為可播放的音頻文件
const processCollectedAudio = async () => {
  if (audioChunks.value.length === 0) {
    console.log('⚠️ No audio chunks to process')
    return
  }

  console.log('🔧 Processing', audioChunks.value.length, 'audio chunks...')

  try {
    // 計算總字節數
    const totalBytes = audioChunks.value.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    console.log('📊 Total audio data:', totalBytes, 'bytes')

    // 合併所有音頻塊
    const combinedBuffer = new Uint8Array(totalBytes)
    let offset = 0
    
    for (const chunk of audioChunks.value) {
      combinedBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // 將 PCM16 數據轉換為 WAV 格式
    const wavBuffer = createWavFile(combinedBuffer, 24000, 1) // 24kHz, mono
    const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' })
    
    // 清理之前的音頻 URL
    if (currentAudioUrl.value) {
      URL.revokeObjectURL(currentAudioUrl.value)
    }
    
    // 創建新的音頻 URL
    currentAudioUrl.value = URL.createObjectURL(audioBlob)
    console.log('✅ Audio file created:', currentAudioUrl.value)
    
    // 使用 Live2D 的播放功能播放音頻並同步嘴型
    if (canvasRef.value && currentAudioUrl.value) {
      console.log('🎭 Playing audio with Live2D lip sync...')
      canvasRef.value.playVoice?.(currentAudioUrl.value)
    }
    
    // 清空緩存
    audioChunks.value = []
    
  } catch (error) {
    console.error('❌ Error processing audio:', error)
  }
}

// 創建 WAV 文件的輔助函數
const createWavFile = (pcmData: Uint8Array, sampleRate: number, channels: number): ArrayBuffer => {
  const length = pcmData.length
  const buffer = new ArrayBuffer(44 + length)
  const view = new DataView(buffer)
  
  // WAV 檔頭
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM format
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true) // 16-bit
  writeString(36, 'data')
  view.setUint32(40, length, true)
  
  // PCM 數據
  new Uint8Array(buffer, 44).set(pcmData)
  
  return buffer
}

// 音頻錄製相關
const startListening = async () => {
  if (!isConnected.value) return

  try {
    // 啟動音量檢測
    if (!audioRecorder) {
      audioRecorder = new AudioRecorder()
      audioRecorder.on('volume', (volume: number) => {
        inputVolume.value = volume
      })
    }
    
    await audioRecorder.start()
    console.log('🎤 Audio recorder started for volume detection')

    // 獲取音頻流
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    
    // 創建音頻上下文用於PCM處理
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const source = audioContext.createMediaStreamSource(stream)
    
    // 創建腳本處理器節點
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    
    processor.onaudioprocess = (event) => {
      if (!liveAPI || !isListening.value) return
      
      const inputBuffer = event.inputBuffer
      const inputData = inputBuffer.getChannelData(0)
      
      // 轉換 Float32Array 為 Int16Array (PCM16)
      const pcm16 = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]))
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      }
      
      // 轉換為 base64
      const buffer = pcm16.buffer
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      
      // 發送 PCM 數據給 Gemini Live API
      liveAPI.client.sendRealtimeInput([{
        mimeType: 'audio/pcm;rate=16000',
        data: base64
      }])
    }
    
    // 連接音頻節點
    source.connect(processor)
    processor.connect(audioContext.destination)
    
    isListening.value = true
    console.log('🎤 Started listening with PCM16 format')
    
    // 保存引用以便清理
    mediaRecorder = {
      stop: () => {
        processor.disconnect()
        source.disconnect()
        audioContext.close()
        stream.getTracks().forEach(track => track.stop())
      },
      stream: stream
    } as any
    
  } catch (error) {
    console.error('Failed to start listening:', error)
    lastError.value = '無法開始錄音: ' + (error as Error).message
  }
}

const stopListening = () => {
  if (mediaRecorder && isListening.value) {
    mediaRecorder.stop()
    mediaRecorder = null
    isListening.value = false
  }
  
  // 停止音量檢測
  if (audioRecorder) {
    audioRecorder.stop()
    audioRecorder = null
    inputVolume.value = 0
  }
}

const toggleListening = () => {
  if (isListening.value) {
    stopListening()
  } else {
    startListening()
  }
}

// Live2D控制函數
function onZoomIn() {
  modelScale.value = Math.min(modelScale.value + 0.05, 2)
  canvasRef.value?.setScale?.(modelScale.value)
}
function onZoomOut() {
  modelScale.value = Math.max(modelScale.value - 0.05, 0.01)
  canvasRef.value?.setScale?.(modelScale.value)
}
function onSetScale(s: number) {
  modelScale.value = s
  canvasRef.value?.setScale?.(s)
}

function onPlay(audioUrl: string) {
  if (!audioUrl) return
  canvasRef.value?.playVoice?.(audioUrl)
}
function onStop() {
  canvasRef.value?.stopSpeaking?.()
}

function onUpdateX(v: number) {
  modelOffsetX.value = v
  canvasRef.value?.applyOffset?.(modelOffsetX.value, modelOffsetY.value, offsetMinX.value, offsetMaxX.value, offsetMinY.value, offsetMaxY.value)
}
function onUpdateY(v: number) {
  modelOffsetY.value = v
  canvasRef.value?.applyOffset?.(modelOffsetX.value, modelOffsetY.value, offsetMinX.value, offsetMaxX.value, offsetMinY.value, offsetMaxY.value)
}

function onResetX() { modelOffsetX.value = 0; onUpdateX(0) }
function onResetY() { modelOffsetY.value = 0; onUpdateY(0) }
function onResetAll() { modelOffsetX.value = 0; modelOffsetY.value = 0; onUpdateX(0); onUpdateY(0) }

// 生命週期
onMounted(() => {
  // 可以在這裡加載存儲的API Key
})

onUnmounted(() => {
  disconnect()
  stopListening()
})
</script>

<style scoped>
.gemini-live-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.controls-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 20px;
  color: #fff;
  min-width: 300px;
}

.connect-btn {
  display: inline-block;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.connect-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.connect-btn.connected {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.connect-btn.connecting {
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.api-key-input {
  margin-top: 15px;
}

.api-input {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
}

.api-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.api-hint {
  display: block;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  line-height: 1.3;
}

.voice-controls {
  margin-top: 15px;
}

.voice-status {
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.status-text {
  text-align: center;
  margin-bottom: 8px;
}

.volume-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.volume-text {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 60px;
}

.voice-btn {
  width: 100%;
  padding: 8px 16px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 6px;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 12px;
}

.voice-btn:hover {
  background: rgba(59, 130, 246, 0.3);
}

.voice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-info {
  margin-top: 15px;
  font-size: 12px;
}

.status-info p {
  margin: 5px 0;
  color: rgba(255, 255, 255, 0.8);
}

.error {
  color: #ef4444 !important;
}

.debug-info {
  margin-top: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
}

.debug-info summary {
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 5px;
}

.debug-info p {
  margin: 3px 0;
  color: rgba(255, 255, 255, 0.6);
}
</style>
