<script setup lang="ts">
import NavBar from './components/NavBar.vue'
</script>

<template>
  <div id="app">
    <NavBar />
    <router-view />
  </div>
</template>

<style>
/* give room for the fixed top nav (56px) so content isn't hidden */
#app {
  padding-top: 64px; /* slightly larger than nav height for breathing room */
}
</style>
