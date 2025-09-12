<template>
  <div class="audio-controls">
    <input type="file" accept="audio/*" @change="onFileChange" />
    <button @click="play" :disabled="!audioUrl">播放並同步口型</button>
    <button @click="stop" :disabled="!audioUrl">停止</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const emit = defineEmits(['play', 'stop'])
const audioUrl = ref<string>('')

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files[0]) {
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = URL.createObjectURL(files[0])
  }
}

function play() { emit('play', audioUrl.value) }
function stop() { emit('stop') }

defineExpose({ audioUrl })
</script>

<style scoped>
.audio-controls { display:flex; gap:8px; align-items:center; justify-content:center; margin:12px 0 }
input[type="file"]{display:block}
</style>
