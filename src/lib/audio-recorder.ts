import EventEmitter from 'eventemitter3'

/**
 * 簡化版音頻錄製器，用於音量檢測
 */
export class AudioRecorder extends EventEmitter {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyserNode: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private animationId: number | null = null
  private isRecording = false

  constructor() {
    super()
    this.updateVolume = this.updateVolume.bind(this)
  }

  async start(): Promise<void> {
    try {
      // 獲取用戶媒體
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      // 創建音頻上下文
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.source = this.audioContext.createMediaStreamSource(this.stream)

      // 創建分析器節點
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.8

      // 連接節點
      this.source.connect(this.analyserNode)

      // 準備數據數組
      const bufferLength = this.analyserNode.frequencyBinCount
      this.dataArray = new Uint8Array(new ArrayBuffer(bufferLength))

      this.isRecording = true
      this.updateVolume()

      console.log('🎤 AudioRecorder started successfully')
    } catch (error) {
      console.error('❌ Failed to start AudioRecorder:', error)
      throw error
    }
  }

  private updateVolume(): void {
    if (!this.isRecording || !this.analyserNode || !this.dataArray) {
      return
    }

    // 獲取頻域數據
    this.analyserNode.getByteFrequencyData(this.dataArray as Uint8Array)

    // 計算平均音量
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]
    }
    
    const average = sum / this.dataArray.length
    const volume = average / 256 // 標準化到 0-1 範圍

    // 發射音量事件
    this.emit('volume', volume)

    // 繼續更新
    this.animationId = requestAnimationFrame(this.updateVolume)
  }

  stop(): void {
    this.isRecording = false

    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    this.analyserNode = null
    this.dataArray = null

    console.log('🔇 AudioRecorder stopped')
  }

  isActive(): boolean {
    return this.isRecording
  }
}