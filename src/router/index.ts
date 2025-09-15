import { createRouter, createWebHistory } from 'vue-router'

const GeminiLive = () => import('@/views/GeminiLive.vue')
const Live2D = () => import('@/views/Live2D.vue')

const routes = [
  { path: '/', redirect: '/gemini' },
  { path: '/gemini', name: 'GeminiLive', component: GeminiLive, meta: { title: 'Gemini Live' } },
  { path: '/live2d', name: 'Live2D', component: Live2D, meta: { title: 'Live 2D' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
