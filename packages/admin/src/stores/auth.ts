import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'
import router from '../router'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref('')

  async function login(password: string): Promise<boolean> {
    isLoading.value = true
    error.value = ''
    try {
      await api.login(password)
      isAuthenticated.value = true
      router.push('/dashboard')
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try { await api.logout() } catch { /* ignore */ }
    isAuthenticated.value = false
    router.push('/login')
  }

  async function checkSession() {
    try {
      await api.getSession()
      isAuthenticated.value = true
    } catch {
      isAuthenticated.value = false
    }
  }

  return { isAuthenticated, isLoading, error, login, logout, checkSession }
})
