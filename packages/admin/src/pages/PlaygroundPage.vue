<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useConfigStore } from '../stores/config'
import { useLocale } from '../locales'
import { api } from '../api/client'
import { Send, Loader2, ChevronDown, ChevronRight } from 'lucide-vue-next'

const store = useConfigStore()
const { messages: t } = useLocale()

const selectedProfile = ref('')
const systemPrompt = ref('You are a helpful assistant.')
const userMessage = ref('')
const useStream = ref(true)
const loading = ref(false)
const response = ref('')
const actualModel = ref('')
const durationMs = ref(0)
const error = ref('')

// Advanced mode — manual auth headers for /v1/chat/completions
const advancedMode = ref(false)
const showAdvanced = ref(false)
const xAppId = ref('')
const xDeviceId = ref(generateTestDeviceId())
const userId = ref('')
const xAppVersion = ref('1.0.0')
const xPlatform = ref(navigator.platform || 'web')

function generateTestDeviceId(): string {
  const existing = localStorage.getItem('playground_device_id')
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem('playground_device_id', id)
  return id
}

onMounted(async () => {
  await store.loadConfig()
  if (profileNames.value.length > 0 && !selectedProfile.value) {
    selectedProfile.value = profileNames.value[0]
  }
  if (!xAppId.value && store.apps.length > 0) {
    xAppId.value = store.apps[0].appId
  }
})

const profileNames = computed(() =>
  Object.entries(store.profiles).filter(([, p]) => p.enabled).map(([name]) => name)
)

const messages = computed(() => {
  const msgs: { role: string; content: string }[] = []
  if (systemPrompt.value) msgs.push({ role: 'system', content: systemPrompt.value })
  if (userMessage.value) msgs.push({ role: 'user', content: userMessage.value })
  return msgs
})

async function runTest() {
  if (!selectedProfile.value || !userMessage.value) return
  loading.value = true; response.value = ''; actualModel.value = ''; durationMs.value = 0; error.value = ''

  const start = performance.now()
  try {
    if (advancedMode.value) {
      await runAdvancedTest(start)
    } else {
      await runNormalTest(start)
    }
  } catch (e) { error.value = (e as Error).message }
  finally { durationMs.value = Math.round(performance.now() - start); loading.value = false }
}

async function runNormalTest(start: number) {
  const body = { profile: selectedProfile.value, messages: messages.value, stream: useStream.value }
  const resp = await api.test(body)

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`
    try { const d = await resp.json(); msg = d?.error?.message || msg } catch { /* ignore */ }
    throw new Error(msg)
  }

  if (useStream.value) {
    await readSSEStream(resp)
  } else {
    const data = await resp.json()
    response.value = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2)
    actualModel.value = data.model || ''
  }
}

async function runAdvancedTest(_start: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (xAppId.value) headers['X-App-Id'] = xAppId.value
  if (xDeviceId.value) headers['X-Device-Id'] = xDeviceId.value
  if (userId.value) headers['user_id'] = userId.value
  if (xAppVersion.value) headers['X-App-Version'] = xAppVersion.value
  if (xPlatform.value) headers['X-Platform'] = xPlatform.value

  const resp = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ profile: selectedProfile.value, messages: messages.value, stream: useStream.value }),
  })

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`
    try { const d = await resp.json(); msg = d?.error?.message || msg } catch { /* ignore */ }
    throw new Error(msg)
  }

  if (useStream.value) {
    await readSSEStream(resp)
  } else {
    const data = await resp.json()
    response.value = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2)
    actualModel.value = data.model || ''
  }
}

async function readSSEStream(resp: Response) {
  const reader = resp.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n'); buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.choices?.[0]?.delta?.content) response.value += parsed.choices[0].delta.content
          if (parsed.model) actualModel.value = parsed.model
        } catch { /* skip */ }
      }
    }
  }
}
</script>

<template>
  <AppLayout>
    <h2 class="text-lg font-semibold text-gray-900">{{ t.playground.title }}</h2>
    <p class="text-sm text-gray-500 mt-0.5">{{ t.playground.subtitle }}</p>

    <div class="mt-6 grid grid-cols-2 gap-6" style="min-height: 60vh">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">{{ t.playground.profile }}</label>
          <select v-model="selectedProfile" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900">
            <option value="" disabled>{{ t.playground.selectProfile }}</option>
            <option v-for="name in profileNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">{{ t.playground.systemPrompt }}</label>
          <textarea v-model="systemPrompt" rows="2" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono resize-none" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">{{ t.playground.userMessage }}</label>
          <textarea v-model="userMessage" rows="4" :placeholder="t.playground.placeholder" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none" @keydown.ctrl.enter="runTest" />
        </div>

        <!-- Advanced mode toggle -->
        <div class="border border-gray-200 rounded">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            @click="showAdvanced = !showAdvanced"
          >
            <span>{{ t.playground.advancedMode }}</span>
            <ChevronDown v-if="!showAdvanced" class="w-3.5 h-3.5" />
            <ChevronRight v-else class="w-3.5 h-3.5" />
          </button>
          <div v-if="showAdvanced" class="px-3 pb-3 space-y-2">
            <p class="text-xs text-gray-400">{{ t.playground.advancedModeDesc }}</p>
            <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input v-model="advancedMode" type="checkbox" class="rounded border-gray-300" />
              {{ t.playground.advancedMode }}
            </label>
            <template v-if="advancedMode">
              <p class="text-xs font-medium text-gray-500 pt-1">{{ t.playground.authHeaders }}</p>
              <input v-model="xAppId" :placeholder="t.playground.appId" class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-900" />
              <input v-model="xDeviceId" :placeholder="t.playground.deviceId" class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-900" />
              <input v-model="userId" :placeholder="t.playground.userId" class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-900" />
              <div class="grid grid-cols-2 gap-1.5">
                <input v-model="xAppVersion" :placeholder="t.playground.appVersion" class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-900" />
                <input v-model="xPlatform" :placeholder="t.playground.platform" class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-900" />
              </div>
            </template>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input v-model="useStream" type="checkbox" class="rounded border-gray-300" />{{ t.playground.stream }}
          </label>
          <button @click="runTest" :disabled="loading || !selectedProfile || !userMessage" class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Loader2 v-if="loading" class="w-3.5 h-3.5 animate-spin" />
            <Send v-else class="w-3.5 h-3.5" />
            {{ loading ? t.playground.running : t.playground.send }}
          </button>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded p-4 shadow-subtle overflow-auto">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ t.playground.response }}</h3>
          <div v-if="durationMs" class="text-xs text-gray-400">
            {{ durationMs }}ms
            <span v-if="actualModel" class="ml-2 text-gray-500">{{ actualModel }}</span>
          </div>
        </div>
        <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{{ error }}</div>
        <div v-else-if="loading && useStream" class="text-sm text-gray-700 whitespace-pre-wrap">
          {{ response }}<span class="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
        </div>
        <div v-else-if="!loading && response" class="text-sm text-gray-700 whitespace-pre-wrap">{{ response }}</div>
        <div v-else-if="!loading && !error" class="text-sm text-gray-400 text-center py-12">{{ t.playground.empty }}</div>
      </div>
    </div>
  </AppLayout>
</template>
