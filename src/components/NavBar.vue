<template>
  <nav class="nav-top">
  <router-link to="/live2d" class="nav-item" active-class="active">Live 2D</router-link>
  <router-link to="/gemini" class="nav-item" active-class="active">Gemini Live + Live2D</router-link>
  </nav>
</template>

<script setup lang="ts">
// simple navigation bar
</script>

<style scoped>
.nav-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: rgba(0,0,0,0.55); /* dark translucent for dark backgrounds */
  backdrop-filter: blur(6px);
  z-index: 1000;
}
.nav-item {
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 6px;
}
.nav-item:hover {
  background: rgba(255,255,255,0.04);
}
.nav-item.active {
  color: #cce7ff;
  background: rgba(255,255,255,0.06);
}
</style>
