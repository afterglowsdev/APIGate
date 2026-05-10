<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import StatCard from '../components/StatCard.vue'
import { useLocale } from '../locales'
import { api } from '../api/client'
import type { GatewayStatus } from '../api/client'

const { messages: t } = useLocale()
const status = ref<GatewayStatus | null>(null)
const loading = ref(true)

onMounted(async () => {
  try { status.value = await api.getStatus() } catch { /* ignore */ }
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <h2 class="text-lg font-semibold text-gray-900">{{ t.dashboard.title }}</h2>
    <p class="text-sm text-gray-500 mt-0.5">{{ t.dashboard.subtitle }}</p>

    <div class="grid grid-cols-4 gap-4 mt-6">
      <StatCard :title="t.dashboard.profiles" :value="status?.profiles ?? '-'" :description="t.dashboard.profilesDesc" />
      <StatCard :title="t.dashboard.apps" :value="status?.apps ?? '-'" :description="t.dashboard.appsDesc" />
      <StatCard :title="t.dashboard.devices" :value="status?.devices ?? '-'" :description="t.dashboard.devicesDesc" />
      <StatCard :title="t.dashboard.timeout" :value="status ? `${status.timeoutMs / 1000}s` : '-'" :description="t.dashboard.timeoutDesc" />
    </div>

    <div class="mt-8">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ t.dashboard.profilesList }}</h3>
      <div v-if="loading" class="text-sm text-gray-400">{{ t.loading }}</div>
      <div v-else-if="!status?.profilesList?.length" class="text-sm text-gray-400">{{ t.noData }}</div>
      <div v-else class="space-y-1.5">
        <div v-for="p in status.profilesList" :key="p.name"
          class="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2.5 text-sm shadow-subtle">
          <span :class="['w-1.5 h-1.5 rounded-full', p.enabled ? 'bg-green-500' : 'bg-gray-300']" />
          <span class="font-medium text-gray-800">{{ p.name }}</span>
          <span class="text-gray-400 text-xs">{{ p.modelCount }} {{ t.dashboard.models }}</span>
          <span v-if="p.description" class="text-gray-400 text-xs truncate">— {{ p.description }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ p.enabled ? t.dashboard.enabled : t.dashboard.disabled }}</span>
        </div>
      </div>
    </div>

    <div class="mt-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ t.dashboard.appsList }}</h3>
      <div v-if="loading" class="text-sm text-gray-400">{{ t.loading }}</div>
      <div v-else-if="!status?.appsList?.length" class="text-sm text-gray-400">{{ t.noData }}</div>
      <div v-else class="space-y-1.5">
        <div v-for="a in status.appsList" :key="a.appId"
          class="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2.5 text-sm shadow-subtle">
          <span :class="['w-1.5 h-1.5 rounded-full', a.enabled ? 'bg-green-500' : 'bg-gray-300']" />
          <span class="font-medium text-gray-800">{{ a.name }}</span>
          <code class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ a.appId }}</code>
          <span class="ml-auto text-xs text-gray-400">{{ a.enabled ? t.dashboard.enabled : t.dashboard.disabled }}</span>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
