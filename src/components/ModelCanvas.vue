<template>
  <canvas ref="canvas" :width="width" :height="height"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { Application, Ticker } from 'pixi.js'

const props = defineProps({
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 },
  modelPath: { type: String, default: 'haru_greeter_t03.model3.json' },
  initialScale: { type: Number, default: 0.5 },
})

const canvas = ref<HTMLCanvasElement | null>(null)
let model: any = null
let mouthAnimationId: number | null = null
let lipSyncEnabled = false

onMounted(async () => {
  if (!canvas.value) return
  const app = new Application({
    view: canvas.value,
    width: props.width,
    height: props.height,
    backgroundAlpha: 0,
  })

  console.log('🎭 Loading Live2D model:', props.modelPath)
  model = await Live2DModel.from(props.modelPath, { ticker: Ticker.shared })
  app.stage.addChild(model)
  
  // default placement and orientation
  model.x = props.width / 2
  model.y = props.height / 2 + 800
  model.rotation = Math.PI
  model.skew.x = Math.PI
  model.scale.set(props.initialScale, props.initialScale)
  model.anchor.set(0.5, 0.5)
  
  // 檢查並初始化嘴型同步
  console.log('🔍 Initializing lip sync for Live2D model...')
  if (model.internalModel && model.internalModel.coreModel) {
    const coreModel = model.internalModel.coreModel
    console.log('✅ Core model accessible')
    console.log('🔧 Core model methods:', Object.getOwnPropertyNames(coreModel))
    
    // 檢查 ParamMouthOpenY 參數（這個模型使用這個參數）
    const paramCount = coreModel.getParameterCount()
    console.log(`📊 Model has ${paramCount} parameters`)
    
    // 嘗試不同的 API 方法來獲取參數 ID
    for (let i = 0; i < Math.min(paramCount, 5); i++) { // 只檢查前 5 個參數
      try {
        let paramId = null
        
        // 嘗試不同的方法名
        if (typeof coreModel.getParameterId === 'function') {
          paramId = coreModel.getParameterId(i)
        } else if (typeof coreModel.getParameterName === 'function') {
          paramId = coreModel.getParameterName(i)
        } else if (coreModel.parameters && coreModel.parameters[i]) {
          paramId = coreModel.parameters[i].id || coreModel.parameters[i].name
        }
        
        console.log(`🔍 Parameter ${i}: ${paramId}`)
        
        if (paramId === 'ParamMouthOpenY') {
          console.log('🎯 Found ParamMouthOpenY at index:', i)
          lipSyncEnabled = true
          break
        }
      } catch (e) {
        console.warn(`⚠️ Could not check parameter ${i}:`, e)
      }
    }
  }
  
  model.on('hit', (hitAreas: string[]) => {
    if (hitAreas.includes('body')) model.motion('tap_body')
  })
  
  console.log('✅ Live2D model loaded successfully, lip sync enabled:', lipSyncEnabled)
})

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function setScale(s: number) {
  if (!model) return
  model.scale.set(s, s)
}

function applyOffset(x: number, y: number, minX = -400, maxX = 400, minY = -800, maxY = 800) {
  if (!model) return
  const baseX = props.width / 2
  const baseY = props.height / 2 + 800
  model.x = baseX + clamp(x, minX, maxX)
  model.y = baseY + clamp(y, minY, maxY)
}

function playVoice(soundUrl: string) {
  if (!model || !soundUrl) return
  try {
    model.motion('Idle', 0, 3, { sound: soundUrl, volume: 1, crossOrigin: 'anonymous' })
  } catch (e) {
    console.error('playVoice error', e)
  }
}

function startSpeaking() {
  if (!model) {
    console.log('❌ No model available for lip sync')
    return
  }
  
  console.log('🗣️ Starting Live2D lip sync animation...')
  
  // 停止現有動畫
  if (mouthAnimationId) {
    clearInterval(mouthAnimationId)
    mouthAnimationId = null
  }
  
  // 嘗試使用 pixi-live2d-display-lipsyncpatch 的 speak 方法
  if (typeof model.speak === 'function') {
    console.log('✅ Using pixi-live2d-display-lipsyncpatch speak() method')
    try {
      const result = model.speak()
      console.log('🎤 speak() method result:', result)
      
      // 檢查是否有額外的配置選項
      if (model.lipSync) {
        console.log('💋 LipSync object available:', model.lipSync)
      }
      
      // 等待一下，然後檢查參數是否被設置
      setTimeout(() => {
        if (model.internalModel && model.internalModel.coreModel) {
          const coreModel = model.internalModel.coreModel
          for (let i = 0; i < coreModel.getParameterCount(); i++) {
            let paramId = null
            
            // 使用安全的 API 檢測
            try {
              if (typeof coreModel.getParameterId === 'function') {
                paramId = coreModel.getParameterId(i)
              } else if (typeof coreModel.getParameterName === 'function') {
                paramId = coreModel.getParameterName(i)
              } else if (coreModel.parameters && coreModel.parameters[i]) {
                paramId = coreModel.parameters[i].id || coreModel.parameters[i].name
              }
            } catch (e) {
              console.warn(`⚠️ Could not get parameter ${i}:`, e)
              continue
            }
            
            if (paramId === 'ParamMouthOpenY') {
              const value = coreModel.getParameterValueByIndex(i)
              console.log(`👄 ParamMouthOpenY current value: ${value}`)
              break
            }
          }
        }
      }, 100)
      
      return
    } catch (e) {
      console.warn('⚠️ speak() method failed, falling back to manual control:', e)
    }
  }
  
  // 手動控制 ParamMouthOpenY 參數
  if (model.internalModel && model.internalModel.coreModel && lipSyncEnabled) {
    console.log('✅ Starting manual lip sync with ParamMouthOpenY')
    const coreModel = model.internalModel.coreModel
    
    // 找到 ParamMouthOpenY 的索引 - 使用安全的 API 檢測
    let mouthParamIndex = -1
    for (let i = 0; i < coreModel.getParameterCount(); i++) {
      let paramId = null
      
      try {
        if (typeof coreModel.getParameterId === 'function') {
          paramId = coreModel.getParameterId(i)
        } else if (typeof coreModel.getParameterName === 'function') {
          paramId = coreModel.getParameterName(i)
        } else if (coreModel.parameters && coreModel.parameters[i]) {
          paramId = coreModel.parameters[i].id || coreModel.parameters[i].name
        }
      } catch (e) {
        console.warn(`⚠️ Could not get parameter ${i}:`, e)
        continue
      }
      
      if (paramId === 'ParamMouthOpenY') {
        mouthParamIndex = i
        break
      }
    }
    
    if (mouthParamIndex !== -1) {
      console.log('🎯 Found ParamMouthOpenY, starting animation')
      let animationTime = 0
      
      mouthAnimationId = setInterval(() => {
        // 創建自然的嘴部動作
        // 使用更複雜的波形來模擬說話
        const baseFreq = 0.3
        const secondaryFreq = 0.8
        const primary = Math.sin(animationTime * baseFreq) * 0.4
        const secondary = Math.sin(animationTime * secondaryFreq) * 0.2
        const noise = (Math.random() - 0.5) * 0.1
        
        let mouthOpenValue = Math.abs(primary + secondary + noise) * 0.8 + 0.1
        mouthOpenValue = Math.max(0, Math.min(1, mouthOpenValue))
        
        coreModel.setParameterValueByIndex(mouthParamIndex, mouthOpenValue)
        animationTime += 0.1
        
        // 每秒輸出一次當前值用於調試
        if (Math.floor(animationTime * 10) % 10 === 0) {
          console.log(`👄 Setting ParamMouthOpenY to: ${mouthOpenValue.toFixed(2)}`)
        }
      }, 50) // 每 50ms 更新一次，20 FPS
      
      console.log('✅ Manual lip sync animation started')
    } else {
      console.log('❌ ParamMouthOpenY parameter not found')
    }
  } else {
    console.log('⚠️ Manual lip sync not available, using fallback motion')
    // 回退到播放動作
    try {
      model.motion('Idle', 0, 3)
    } catch (e) {
      console.error('❌ Fallback motion failed:', e)
    }
  }
}

function stopSpeaking() {
  if (!model) return
  try {
    console.log('🤐 Stopping Live2D speaking animation...')
    
    // 停止嘴型同步
    if (typeof model.stopSpeaking === 'function') {
      model.stopSpeaking()
      console.log('✅ Live2D stopSpeaking() method called')
    } else if (typeof model.stopSpeak === 'function') {
      model.stopSpeak()
      console.log('✅ Live2D stopSpeak() method called')
    } else {
      console.log('⚠️ No stop speaking method available')
    }
    
    // 清理手動動畫
    if (mouthAnimationId) {
      clearInterval(mouthAnimationId)
      mouthAnimationId = null
      console.log('✅ Stopped manual mouth animation')
    }
    
  } catch (e) {
    console.error('❌ stopSpeaking error', e)
  }
}



defineExpose({ setScale, applyOffset, playVoice, startSpeaking, stopSpeaking })
</script>

<style scoped>
canvas { display:block; margin:0 auto; }
</style>
