import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: () => import('../pages/LoginPage.vue') },
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: () => import('../pages/DashboardPage.vue') },
    { path: '/profiles', name: 'Profiles', component: () => import('../pages/ModelProfilesPage.vue') },
    { path: '/apps', name: 'Apps', component: () => import('../pages/AppsPage.vue') },
    { path: '/devices', name: 'Devices', component: () => import('../pages/DevicesPage.vue') },
    { path: '/settings', name: 'Settings', component: () => import('../pages/SettingsPage.vue') },
    { path: '/playground', name: 'Playground', component: () => import('../pages/PlaygroundPage.vue') },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.name !== 'Login' && !auth.isAuthenticated) {
    await auth.checkSession()
    if (!auth.isAuthenticated) return { name: 'Login' }
  }
})

export default router
