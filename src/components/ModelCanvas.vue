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

onMounted(async () => {
  if (!canvas.value) return
  const app = new Application({
    view: canvas.value,
    width: props.width,
    height: props.height,
    backgroundAlpha: 0,
  })

  model = await Live2DModel.from(props.modelPath, { ticker: Ticker.shared })
  app.stage.addChild(model)
  // default placement and orientation
  model.x = props.width / 2
  model.y = props.height / 2 + 800
  model.rotation = Math.PI
  model.skew.x = Math.PI
  model.scale.set(props.initialScale, props.initialScale)
  model.anchor.set(0.5, 0.5)
  model.on('hit', (hitAreas: string[]) => {
    if (hitAreas.includes('body')) model.motion('tap_body')
  })
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

function stopSpeaking() {
  try { model?.stopSpeaking?.() } catch (e) { /* ignore */ }
}

defineExpose({ setScale, applyOffset, playVoice, stopSpeaking })
</script>

<style scoped>
canvas { display:block; margin:0 auto; }
</style>
