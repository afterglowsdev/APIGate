<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import StatCard from '../components/StatCard.vue'
import { api } from '../api/client'
import type { GatewayStatus } from '../api/client'

const status = ref<GatewayStatus | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    status.value = await api.getStatus()
  } catch { /* ignore */ }
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <h2 class="text-lg font-semibold text-gray-900">Dashboard</h2>
    <p class="text-sm text-gray-500 mt-0.5">Gateway status overview</p>

    <div class="grid grid-cols-4 gap-4 mt-6">
      <StatCard title="Profiles" :value="status?.profiles ?? '-'" description="Model profiles configured" />
      <StatCard title="Clients" :value="status?.clients ?? '-'" description="Registered API clients" />
      <StatCard title="Default Profile" :value="status?.defaultProfile || '-'" description="Fallback when none specified" />
      <StatCard title="Timeout" :value="status ? `${status.timeoutMs / 1000}s` : '-'" description="Upstream request timeout" />
    </div>

    <div class="mt-8">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Profiles</h3>
      <div v-if="loading" class="text-sm text-gray-400">Loading...</div>
      <div v-else-if="!status?.profilesList?.length" class="text-sm text-gray-400">No profiles configured</div>
      <div v-else class="space-y-1.5">
        <div
          v-for="p in status.profilesList"
          :key="p.name"
          class="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2.5 text-sm shadow-subtle"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', p.enabled ? 'bg-green-500' : 'bg-gray-300']" />
          <span class="font-medium text-gray-800">{{ p.name }}</span>
          <span class="text-gray-400 text-xs">{{ p.modelCount }} model{{ p.modelCount !== 1 ? 's' : '' }}</span>
          <span v-if="p.description" class="text-gray-400 text-xs truncate">— {{ p.description }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ p.enabled ? 'Enabled' : 'Disabled' }}</span>
        </div>
      </div>
    </div>

    <div class="mt-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Clients</h3>
      <div v-if="loading" class="text-sm text-gray-400">Loading...</div>
      <div v-else-if="!status?.clientsList?.length" class="text-sm text-gray-400">No clients configured</div>
      <div v-else class="space-y-1.5">
        <div
          v-for="cl in status.clientsList"
          :key="cl.id"
          class="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-2.5 text-sm shadow-subtle"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', cl.enabled ? 'bg-green-500' : 'bg-gray-300']" />
          <span class="font-medium text-gray-800">{{ cl.name }}</span>
          <code class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ cl.id }}</code>
          <span class="text-xs text-gray-400">Token: {{ cl.tokenPreview }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ cl.enabled ? 'Enabled' : 'Disabled' }}</span>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
