import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import type { GatewayConfigResponse, ProfileData, AppData } from '../api/client'

export const useConfigStore = defineStore('config', () => {
  const config = ref<GatewayConfigResponse | null>(null)
  const isLoading = ref(false)
  const error = ref('')
  const warnings = ref<string[]>([])

  const profiles = computed(() => config.value?.profiles ?? {})
  const apps = computed(() => config.value?.apps ?? [])

  async function loadConfig() {
    isLoading.value = true; error.value = ''
    try { config.value = await api.getConfig() } catch (e) { error.value = (e as Error).message }
    finally { isLoading.value = false }
  }

  async function saveConfig(): Promise<boolean> {
    if (!config.value) return false
    isLoading.value = true; error.value = ''; warnings.value = []
    try { const result = await api.saveConfig(config.value); warnings.value = result.warnings; return true }
    catch (e) { error.value = (e as Error).message; return false }
    finally { isLoading.value = false }
  }

  // Profiles / 模型档位
  function updateProfile(name: string, profile: ProfileData) { if (!config.value) return; config.value.profiles[name] = profile }
  function addProfile(name: string) {
    if (!config.value) return
    config.value.profiles[name] = { enabled: false, description: '', models: [], max_tokens: 2048, temperature: 0.7 }
  }
  function deleteProfile(name: string) {
    if (!config.value) return
    delete config.value.profiles[name]
    for (const app of config.value.apps) app.allowedProfiles = app.allowedProfiles.filter(p => p !== name)
    if (config.value.defaultProfile === name) config.value.defaultProfile = ''
  }

  // Apps / 应用接入
  function updateApp(appId: string, app: AppData) {
    if (!config.value) return
    const idx = config.value.apps.findIndex(a => a.appId === appId)
    if (idx >= 0) config.value.apps[idx] = app
  }
  function addApp(app: AppData) { if (!config.value) return; config.value.apps.push(app) }
  function deleteApp(appId: string) {
    if (!config.value) return
    config.value.apps = config.value.apps.filter(a => a.appId !== appId)
  }

  function validateProfile(profile: ProfileData): string[] {
    const errors: string[] = []
    if (profile.models.length === 0) errors.push('Missing models')
    if (!profile.max_tokens || profile.max_tokens <= 0) errors.push('Missing max_tokens')
    return errors
  }

  function validateApp(app: AppData): string[] {
    const errors: string[] = []
    if (!app.appId) errors.push('Missing appId')
    if (!app.appSecret && app.requireAppSecret) errors.push('requireAppSecret is on but no secret set')
    if (app.allowedProfiles.length === 0) errors.push('Missing allowed profiles')
    return errors
  }

  return {
    config, isLoading, error, warnings, profiles, apps,
    loadConfig, saveConfig,
    updateProfile, addProfile, deleteProfile,
    updateApp, addApp, deleteApp,
    validateProfile, validateApp,
  }
})
