<template>
  <div :class="['audio-pulse', { active: active, hover: hover }]">
    <div
      v-for="(_, i) in lines"
      :key="i"
      ref="lineRefs"
      :style="{ 
        animationDelay: `${i * 133}ms`,
        height: lineHeights[i] + 'px'
      }"
      class="pulse-line"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'

export interface AudioPulseProps {
  active: boolean
  volume: number
  hover?: boolean
}

const props = withDefaults(defineProps<AudioPulseProps>(), {
  hover: false
})

const lineCount = 3
const lines = Array(lineCount).fill(null)
const lineRefs = ref<HTMLDivElement[]>([])
const lineHeights = ref<number[]>([4, 4, 4])

let animationId: number | null = null

const updateLines = () => {
  lineHeights.value = lineHeights.value.map((_, i) => 
    Math.min(24, 4 + props.volume * (i === 1 ? 400 : 60))
  )
  
  if (props.active) {
    animationId = requestAnimationFrame(updateLines)
  }
}

watch(() => props.active, (newActive) => {
  if (newActive) {
    updateLines()
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    // 重置為基礎高度
    lineHeights.value = [4, 4, 4]
  }
}, { immediate: true })

watch(() => props.volume, () => {
  if (!props.active) return
  // 即時更新高度，不等待動畫循環
  lineHeights.value = lineHeights.value.map((_, i) => 
    Math.min(24, 4 + props.volume * (i === 1 ? 400 : 60))
  )
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.audio-pulse {
  display: flex;
  width: 24px;
  justify-content: space-evenly;
  align-items: center;
  transition: all 0.5s;
  height: 24px;
  opacity: 0.3;
}

.pulse-line {
  background-color: #666;
  border-radius: 1000px;
  width: 4px;
  min-height: 4px;
  transition: height 0.1s ease;
}

.audio-pulse.hover .pulse-line {
  animation: hover 1.4s infinite alternate ease-in-out;
}

.audio-pulse.active {
  opacity: 1;
}

.audio-pulse.active .pulse-line {
  background-color: #22c55e;
}

@keyframes hover {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-3.5px);
  }
}

@keyframes pulse {
  from {
    scale: 1 1;
  }
  to {
    scale: 1.2 1.2;
  }
}
</style>