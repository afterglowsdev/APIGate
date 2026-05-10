import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import type { GatewayConfigResponse, ProfileData, ClientData } from '../api/client'

export const useConfigStore = defineStore('config', () => {
  const config = ref<GatewayConfigResponse | null>(null)
  const isLoading = ref(false)
  const error = ref('')
  const warnings = ref<string[]>([])

  const profiles = computed(() => config.value?.profiles ?? {})
  const clients = computed(() => config.value?.clients ?? [])

  async function loadConfig() {
    isLoading.value = true
    error.value = ''
    try {
      config.value = await api.getConfig()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig(): Promise<boolean> {
    if (!config.value) return false
    isLoading.value = true
    error.value = ''
    warnings.value = []
    try {
      const result = await api.saveConfig(config.value)
      warnings.value = result.warnings
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    } finally {
      isLoading.value = false
    }
  }

  function updateProfile(name: string, profile: ProfileData) {
    if (!config.value) return
    config.value.profiles[name] = profile
  }

  function addProfile(name: string) {
    if (!config.value) return
    config.value.profiles[name] = {
      enabled: false,
      description: '',
      models: [],
      max_tokens: 2048,
      temperature: 0.7,
    }
  }

  function deleteProfile(name: string) {
    if (!config.value) return
    delete config.value.profiles[name]
    // Also clean up from clients
    for (const client of config.value.clients) {
      client.allowedProfiles = client.allowedProfiles.filter((p) => p !== name)
    }
    if (config.value.defaultProfile === name) {
      config.value.defaultProfile = ''
    }
  }

  function updateClient(id: string, client: ClientData) {
    if (!config.value) return
    const idx = config.value.clients.findIndex((c) => c.id === id)
    if (idx >= 0) {
      config.value.clients[idx] = client
    }
  }

  function addClient(client: ClientData) {
    if (!config.value) return
    config.value.clients.push(client)
  }

  function deleteClient(id: string) {
    if (!config.value) return
    config.value.clients = config.value.clients.filter((c) => c.id !== id)
  }

  // Validation helpers for UI status display
  function validateProfile(profile: ProfileData): string[] {
    const errors: string[] = []
    if (profile.models.length === 0) errors.push('Missing models')
    if (!profile.max_tokens || profile.max_tokens <= 0) errors.push('Missing max_tokens')
    return errors
  }

  function validateClient(client: ClientData): string[] {
    const errors: string[] = []
    if (!client.token || client.token.startsWith('****')) {
      // Token is masked - check if there's a real token underneath
    }
    if (!client.token) errors.push('Missing token')
    if (client.allowedProfiles.length === 0) errors.push('Missing allowed profiles')
    return errors
  }

  return {
    config, isLoading, error, warnings,
    profiles, clients,
    loadConfig, saveConfig,
    updateProfile, addProfile, deleteProfile,
    updateClient, addClient, deleteClient,
    validateProfile, validateClient,
  }
})
