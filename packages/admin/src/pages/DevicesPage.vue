<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useConfigStore } from '../stores/config'
import { useLocale } from '../locales'
import { api } from '../api/client'
import type { DeviceData } from '../api/client'
import { RefreshCw, Ban, CheckCircle, X, Pencil } from 'lucide-vue-next'

const store = useConfigStore()
const { messages: t } = useLocale()

const devices = ref<DeviceData[]>([])
const total = ref(0)
const loading = ref(false)

const filterAppId = ref('')
const filterStatus = ref('')
const searchQuery = ref('')
const offset = ref(0)
const limit = 50

const blockTarget = ref<DeviceData | null>(null)
const unblockTarget = ref<DeviceData | null>(null)
const noteTarget = ref<DeviceData | null>(null)
const noteText = ref('')

onMounted(async () => {
  await store.loadConfig()
  await loadDevices()
})

const appNames = computed(() => store.apps.map(a => a.appId))

async function loadDevices() {
  loading.value = true
  try {
    const result = await api.getDevices({
      appId: filterAppId.value || undefined,
      status: filterStatus.value || undefined,
      search: searchQuery.value || undefined,
      offset: offset.value,
      limit,
    })
    devices.value = result.devices
    total.value = result.total
  } catch { /* ignore */ }
  loading.value = false
}

function refresh() { offset.value = 0; loadDevices() }

async function blockDevice() {
  if (!blockTarget.value) return
  await api.blockDevice(blockTarget.value.appId, blockTarget.value.deviceId)
  blockTarget.value = null
  await loadDevices()
}

async function unblockDevice() {
  if (!unblockTarget.value) return
  await api.unblockDevice(unblockTarget.value.appId, unblockTarget.value.deviceId)
  unblockTarget.value = null
  await loadDevices()
}

async function saveNote() {
  if (!noteTarget.value) return
  await api.updateDeviceNote(noteTarget.value.appId, noteTarget.value.deviceId, noteText.value)
  noteTarget.value = null
  await loadDevices()
}

function openNote(device: DeviceData) {
  noteTarget.value = device
  noteText.value = device.note || ''
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function page(rel: number) {
  offset.value = Math.max(0, offset.value + rel * limit)
  loadDevices()
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ t.devices.title }}</h2>
        <p class="text-sm text-gray-500 mt-0.5">{{ t.devices.subtitle }}</p>
      </div>
      <button @click="refresh" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
        <RefreshCw class="w-3 h-3" />{{ loading ? t.loading : t.sidebar.devices }}
      </button>
    </div>

    <!-- Filters -->
    <div class="mt-4 flex items-center gap-3">
      <input v-model="searchQuery" :placeholder="t.devices.search" @keyup.enter="refresh"
        class="w-56 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
      <select v-model="filterAppId" @change="refresh" class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900">
        <option value="">{{ t.devices.filterApp }}</option>
        <option v-for="a in appNames" :key="a" :value="a">{{ a }}</option>
      </select>
      <select v-model="filterStatus" @change="refresh" class="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900">
        <option value="">{{ t.devices.filterStatus }}</option>
        <option value="active">{{ t.devices.active }}</option>
        <option value="blocked">{{ t.devices.blocked }}</option>
      </select>
      <span class="text-xs text-gray-400 ml-auto">{{ total }} {{ t.devices.deviceId }}</span>
    </div>

    <!-- Table -->
    <div class="mt-3 bg-white border border-gray-200 rounded shadow-subtle overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left">
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.appId }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.deviceId }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.status }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.appVersion }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.platform }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.lastSeen }}</th>
            <th class="px-3 py-2 font-medium text-gray-500">{{ t.devices.note }}</th>
            <th class="px-3 py-2 font-medium text-gray-500 w-24">{{ t.more }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading"><td colspan="8" class="px-3 py-8 text-center text-gray-400">{{ t.loading }}</td></tr>
          <tr v-else-if="devices.length === 0"><td colspan="8" class="px-3 py-8 text-center text-gray-400">{{ t.devices.noDevices }}</td></tr>
          <tr v-for="d in devices" :key="d.appId + d.deviceId" class="hover:bg-gray-50">
            <td class="px-3 py-2"><code class="text-gray-600 bg-gray-100 px-1 rounded">{{ d.appId }}</code></td>
            <td class="px-3 py-2 font-mono text-gray-700 text-[11px]">{{ d.deviceId.slice(0, 12) }}...</td>
            <td class="px-3 py-2">
              <span :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium',
                d.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700']">
                {{ d.status === 'active' ? t.devices.active : t.devices.blocked }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-500">{{ d.appVersion || '-' }}</td>
            <td class="px-3 py-2 text-gray-500">{{ d.platform || '-' }}</td>
            <td class="px-3 py-2 text-gray-500">{{ formatDate(d.lastSeen) }}</td>
            <td class="px-3 py-2 text-gray-500 max-w-[120px] truncate">{{ d.note || '-' }}</td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1">
                <button v-if="d.status === 'active'" @click="blockTarget = d" class="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5" :title="t.devices.block">
                  <Ban class="w-3 h-3" />
                </button>
                <button v-else @click="unblockTarget = d" class="text-xs text-green-500 hover:text-green-700 flex items-center gap-0.5" :title="t.devices.unblock">
                  <CheckCircle class="w-3 h-3" />
                </button>
                <button @click="openNote(d)" class="text-xs text-gray-400 hover:text-gray-600" :title="t.devices.addNote">
                  <Pencil class="w-3 h-3" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="mt-3 flex items-center justify-between text-xs text-gray-500">
      <span>{{ offset + 1 }}-{{ Math.min(offset + limit, total) }} / {{ total }}</span>
      <div class="flex gap-2">
        <button :disabled="offset === 0" @click="page(-1)" class="px-2 py-1 border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-50">←</button>
        <button :disabled="offset + limit >= total" @click="page(1)" class="px-2 py-1 border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-50">→</button>
      </div>
    </div>

    <ConfirmDialog :open="!!blockTarget" :title="t.devices.blockTitle" :message="t.devices.blockMsg.replace('{id}', blockTarget?.deviceId?.slice(0,12) || '')"
      :confirmLabel="t.devices.block" danger @confirm="blockDevice" @cancel="blockTarget = null" />
    <ConfirmDialog :open="!!unblockTarget" :title="t.devices.unblockTitle" :message="t.devices.unblockMsg.replace('{id}', unblockTarget?.deviceId?.slice(0,12) || '')"
      :confirmLabel="t.devices.unblock" @confirm="unblockDevice" @cancel="unblockTarget = null" />

    <!-- Note modal -->
    <Teleport to="body">
      <div v-if="noteTarget" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/30" @click="noteTarget = null" />
        <div class="relative bg-white rounded border border-gray-200 shadow-lg p-6 w-96 max-w-[90vw]">
          <h3 class="text-sm font-semibold text-gray-900">{{ t.devices.addNote }}</h3>
          <textarea v-model="noteText" rows="3" class="w-full mt-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none" />
          <div class="flex justify-end gap-2 mt-3">
            <button @click="noteTarget = null" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">{{ t.cancel }}</button>
            <button @click="saveNote" class="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">{{ t.save }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
