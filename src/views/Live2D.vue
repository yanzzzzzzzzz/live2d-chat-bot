<template>
  <div>
    <ModelCanvas ref="canvasRef" :initialScale="modelScale" />
    <AudioControls @play="onPlay" @stop="onStop" />
    <ScaleControls :scale="modelScale" :presets="presets" @zoom-in="onZoomIn" @zoom-out="onZoomOut" @set-scale="onSetScale" />
    <OffsetControls :x="modelOffsetX" :y="modelOffsetY" :minX="offsetMinX" :maxX="offsetMaxX" :minY="offsetMinY" :maxY="offsetMaxY" @update:x="onUpdateX" @update:y="onUpdateY" @reset-x="onResetX" @reset-y="onResetY" @reset-all="onResetAll" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModelCanvas from '@/components/ModelCanvas.vue'
import AudioControls from '@/components/AudioControls.vue'
import ScaleControls from '@/components/ScaleControls.vue'
import OffsetControls from '@/components/OffsetControls.vue'

const modelScale = ref(0.5)
const presets = [0.05, 0.1, 0.2, 0.5, 1]

const modelOffsetX = ref(0)
const modelOffsetY = ref(0)

const offsetMinX = ref(-400)
const offsetMaxX = ref(400)
const offsetMinY = ref(-800)
const offsetMaxY = ref(800)

const canvasRef = ref<InstanceType<typeof ModelCanvas> | null>(null)

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
</script>

<style scoped>
/* view-level styles (minimal) */
</style>
