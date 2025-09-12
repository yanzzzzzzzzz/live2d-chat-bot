<template>
  <div class="offset-controls">
    <div>
      <label>X: <strong>{{ x }}</strong></label>
      <input class="full-range" type="range" :min="minX" :max="maxX" :value="x" @input="onX" />
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button @click="$emit('reset-x')">Reset X</button>
        <button @click="$emit('reset-y')">Reset Y</button>
        <button @click="$emit('reset-all')">Reset All</button>
      </div>
    </div>
    <div style="margin-top:10px;">
      <label>Y: <strong>{{ y }}</strong></label>
      <input class="full-range" type="range" :min="minY" :max="maxY" :value="y" @input="onY" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
const props = defineProps({ x: Number, y: Number, minX: Number, maxX: Number, minY: Number, maxY: Number })
const emit = defineEmits(['update:x','update:y','reset-x','reset-y','reset-all'])
const { x, y, minX, maxX, minY, maxY } = toRefs(props)

function onX(e: Event) { emit('update:x', Number((e.target as HTMLInputElement).value)) }
function onY(e: Event) { emit('update:y', Number((e.target as HTMLInputElement).value)) }
</script>

<style scoped>
.full-range { width:100%; appearance:none; height:8px; border-radius:4px; background:linear-gradient(90deg,#666,#222); }
.offset-controls { max-width:640px; margin:0 auto }
</style>
