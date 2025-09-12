<template>
  <div class="scale-controls">
    <button @click="$emit('zoom-out')">-</button>
    <span>比例: {{ scale.toFixed(2) }}</span>
    <button @click="$emit('zoom-in')">+</button>
    <div class="presets">
      <button v-for="p in presets" @click="$emit('set-scale', p)">x{{ p }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
const props = defineProps({ scale: { type: Number, required: true }, presets: { type: Array, default: () => [0.05,0.1,0.2,0.5,1] } })
const { scale } = toRefs(props)
</script>

<style scoped>
.scale-controls { display:flex; gap:12px; align-items:center; justify-content:center; margin:12px 0 }
.presets button { margin-left:8px }
</style>
