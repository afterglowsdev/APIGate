<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useConfigStore } from '../stores/config'
import type { ClientData } from '../api/client'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-vue-next'
import { generateToken } from '../utils'

const store = useConfigStore()
const editingClient = ref<string | null>(null)
const showNewForm = ref(false)
const deleteTarget = ref<string | null>(null)

const newClient = ref<ClientData>({
  id: '', name: '', token: '', enabled: false,
  allowedProfiles: [], dailyQuota: 0, monthlyQuota: 0, rateLimitPerMinute: 0,
})

const form = ref<ClientData>({ ...newClient.value })

onMounted(() => store.loadConfig())

const profileNames = computed(() => Object.keys(store.profiles))

function startEdit(id: string) {
  editingClient.value = id
  const client = store.clients.find((c) => c.id === id)
  if (client) {
    form.value = JSON.parse(JSON.stringify(client))
  }
}

function cancelEdit() {
  editingClient.value = null
}

async function saveClient(id: string) {
  store.updateClient(id, form.value)
  await store.saveConfig()
  editingClient.value = null
}

async function createClient() {
  if (!newClient.value.id) return
  store.addClient({ ...newClient.value })
  await store.saveConfig()
  showNewForm.value = false
  newClient.value = { id: '', name: '', token: '', enabled: false, allowedProfiles: [], dailyQuota: 0, monthlyQuota: 0, rateLimitPerMinute: 0 }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  store.deleteClient(deleteTarget.value)
  await store.saveConfig()
  deleteTarget.value = null
}

function genToken() {
  newClient.value.token = generateToken(24)
}

function genTokenEdit() {
  form.value.token = generateToken(24)
}

function toggleProfile(profile: string) {
  const idx = form.value.allowedProfiles.indexOf(profile)
  if (idx >= 0) {
    form.value.allowedProfiles.splice(idx, 1)
  } else {
    form.value.allowedProfiles.push(profile)
  }
}

const deleteMessage = computed(() => `Delete client "${deleteTarget.value}"? This cannot be undone.`)

function clientStatus(client: ClientData): { label: string; class: string } {
  if (!client.enabled) return { label: 'Disabled', class: 'text-gray-400' }
  const issues = store.validateClient(client)
  if (issues.length > 0) return { label: 'Missing ' + issues.join(', '), class: 'text-amber-500' }
  return { label: 'Enabled', class: 'text-green-600' }
}

async function toggleEnabled(id: string) {
  const client = store.clients.find((c) => c.id === id)
  if (!client) return
  if (!client.enabled) {
    const issues = store.validateClient(client)
    if (issues.length > 0) {
      alert('Cannot enable: ' + issues.join(', '))
      return
    }
  }
  client.enabled = !client.enabled
  await store.saveConfig()
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Clients</h2>
        <p class="text-sm text-gray-500 mt-0.5">Manage API clients and their access</p>
      </div>
      <button
        @click="showNewForm = true"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
      >
        <Plus class="w-3.5 h-3.5" />
        New Client
      </button>
    </div>

    <!-- Save warnings -->
    <div v-if="store.warnings.length" class="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
      <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <div v-for="(w, i) in store.warnings" :key="i" class="text-amber-700">{{ w }}</div>
      </div>
    </div>

    <!-- New Client Form -->
    <div v-if="showNewForm" class="mt-4 bg-white border border-gray-200 rounded p-4 shadow-subtle space-y-3">
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">Client ID</label>
          <input v-model="newClient.id" placeholder="e.g. desktop-app" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">Name</label>
          <input v-model="newClient.name" placeholder="Display name" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">Token</label>
          <div class="flex gap-1">
            <input v-model="newClient.token" placeholder="Client token" class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono" />
            <button @click="genToken" class="px-2 py-1.5 text-xs bg-gray-100 rounded border border-gray-300 hover:bg-gray-200 shrink-0">Gen</button>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="createClient" class="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">Create</button>
        <button @click="showNewForm = false" class="px-3 py-1.5 text-xs text-gray-500">Cancel</button>
      </div>
    </div>

    <!-- Clients List -->
    <div class="mt-4 space-y-3">
      <div v-if="store.clients.length === 0" class="text-sm text-gray-400 py-8 text-center">
        No clients yet
      </div>

      <div
        v-for="client in store.clients"
        :key="client.id"
        class="bg-white border border-gray-200 rounded shadow-subtle overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <button
              @click="toggleEnabled(client.id)"
              :class="['w-2 h-2 rounded-full', client.enabled ? 'bg-green-500' : 'bg-gray-300']"
            />
            <span class="font-medium text-gray-800 text-sm">{{ client.name }}</span>
            <code class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ client.id }}</code>
            <span :class="['text-xs', clientStatus(client).class]">{{ clientStatus(client).label }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="editingClient !== client.id"
              @click="startEdit(client.id)"
              class="text-xs text-gray-500 hover:text-gray-800"
            >
              Edit
            </button>
            <button @click="deleteTarget = client.id" class="text-xs text-gray-400 hover:text-red-600">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-if="editingClient === client.id" class="p-4 space-y-3 bg-gray-50/50">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Name</label>
              <input v-model="form.name" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Token</label>
              <div class="flex gap-1">
                <input v-model="form.token" class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono" />
                <button @click="genTokenEdit" class="px-2 py-1.5 text-xs bg-gray-100 rounded border border-gray-300 hover:bg-gray-200 shrink-0">Gen</button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Rate Limit (req/min)</label>
              <input v-model.number="form.rateLimitPerMinute" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Daily Quota</label>
              <input v-model.number="form.dailyQuota" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Monthly Quota</label>
              <input v-model.number="form.monthlyQuota" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
          </div>

          <!-- Allowed Profiles -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Allowed Profiles</label>
            <div v-if="profileNames.length === 0" class="text-xs text-gray-400">No profiles defined yet</div>
            <div v-else class="flex flex-wrap gap-1.5">
              <label
                v-for="p in profileNames"
                :key="p"
                :class="[
                  'px-2.5 py-1 text-xs rounded border cursor-pointer transition-colors',
                  form.allowedProfiles.includes(p)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                ]"
              >
                <input
                  type="checkbox"
                  :checked="form.allowedProfiles.includes(p)"
                  @change="toggleProfile(p)"
                  class="hidden"
                />
                {{ p }}
              </label>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button @click="saveClient(client.id)" class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">
              <Save class="w-3 h-3" /> Save
            </button>
            <button @click="cancelEdit" class="px-3 py-1.5 text-xs text-gray-500">Cancel</button>
            <label class="flex items-center gap-1.5 text-xs text-gray-500 ml-auto cursor-pointer">
              <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300" />
              Enabled
            </label>
          </div>
        </div>

        <!-- Collapsed View -->
        <div v-else class="px-4 py-2.5 text-sm text-gray-500 flex items-center gap-4">
          <span>Token: {{ client.token }}</span>
          <span>Profiles: {{ client.allowedProfiles.join(', ') || 'none' }}</span>
          <span v-if="client.dailyQuota">Daily: {{ client.dailyQuota }}</span>
          <span v-if="client.monthlyQuota">Monthly: {{ client.monthlyQuota }}</span>
          <span v-if="client.rateLimitPerMinute">{{ client.rateLimitPerMinute }}/min</span>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      title="Delete Client"
      :message="deleteMessage"
      confirmLabel="Delete"
      danger
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </AppLayout>
</template>
