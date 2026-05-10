import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../pages/LoginPage.vue'),
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../pages/DashboardPage.vue'),
    },
    {
      path: '/profiles',
      name: 'Profiles',
      component: () => import('../pages/ModelProfilesPage.vue'),
    },
    {
      path: '/clients',
      name: 'Clients',
      component: () => import('../pages/ClientsPage.vue'),
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../pages/SettingsPage.vue'),
    },
    {
      path: '/playground',
      name: 'Playground',
      component: () => import('../pages/PlaygroundPage.vue'),
    },
  ],
})

router.beforeEach(async (to, from) => {
  const auth = useAuthStore()
  if (to.name !== 'Login' && !auth.isAuthenticated) {
    // Try to restore session
    await auth.checkSession()
    if (!auth.isAuthenticated) {
      return { name: 'Login' }
    }
  }
})

export default router
