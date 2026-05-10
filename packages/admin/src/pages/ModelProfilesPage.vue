<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useConfigStore } from '../stores/config'
import type { ProfileData } from '../api/client'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-vue-next'

const store = useConfigStore()
const editingProfile = ref<string | null>(null)
const newProfileName = ref('')
const showNewForm = ref(false)
const deleteTarget = ref<string | null>(null)

// Form state for current editing profile
const form = ref<ProfileData>({ enabled: false, models: [], max_tokens: 2048, temperature: 0.7, description: '' })

onMounted(() => store.loadConfig())

const profileList = computed(() => Object.entries(store.profiles))

function startEdit(name: string) {
  editingProfile.value = name
  form.value = JSON.parse(JSON.stringify(store.profiles[name]))
}

function cancelEdit() {
  editingProfile.value = null
}

async function saveProfile(name: string) {
  store.updateProfile(name, form.value)
  await store.saveConfig()
  editingProfile.value = null
}

function startNew() {
  showNewForm.value = true
  newProfileName.value = ''
}

async function createProfile() {
  if (!newProfileName.value) return
  store.addProfile(newProfileName.value)
  await store.saveConfig()
  showNewForm.value = false
  newProfileName.value = ''
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  store.deleteProfile(deleteTarget.value)
  await store.saveConfig()
  deleteTarget.value = null
}

function addModel() {
  form.value.models.push({ name: '', weight: 1 })
}

function removeModel(index: number) {
  form.value.models.splice(index, 1)
}

function profileStatus(profile: ProfileData): { label: string; class: string } {
  if (!profile.enabled) return { label: 'Disabled', class: 'text-gray-400' }
  const issues = store.validateProfile(profile)
  if (issues.length > 0) return { label: 'Missing ' + issues.join(', '), class: 'text-amber-500' }
  return { label: 'Enabled', class: 'text-green-600' }
}

const deleteMessage = computed(() => `Delete profile "${deleteTarget.value}"? This cannot be undone.`)

async function toggleEnabled(name: string) {
  const profile = store.profiles[name]
  if (!profile.enabled) {
    // Trying to enable — validate first
    const issues = store.validateProfile(profile)
    if (issues.length > 0) {
      alert('Cannot enable: ' + issues.join(', '))
      return
    }
  }
  profile.enabled = !profile.enabled
  await store.saveConfig()
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Model Profiles</h2>
        <p class="text-sm text-gray-500 mt-0.5">Define model pools with weighted selection</p>
      </div>
      <button
        @click="startNew"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
      >
        <Plus class="w-3.5 h-3.5" />
        New Profile
      </button>
    </div>

    <!-- New Profile Form -->
    <div v-if="showNewForm" class="mt-4 bg-white border border-gray-200 rounded p-4 shadow-subtle">
      <input
        v-model="newProfileName"
        placeholder="Profile name (e.g. app-fast)"
        class="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded mr-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
        @keyup.enter="createProfile"
      />
      <button @click="createProfile" class="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">Create</button>
      <button @click="showNewForm = false" class="px-3 py-1.5 text-xs text-gray-500 ml-2">Cancel</button>
    </div>

    <!-- Save warnings -->
    <div v-if="store.warnings.length" class="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
      <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <div v-for="(w, i) in store.warnings" :key="i" class="text-amber-700">{{ w }}</div>
      </div>
    </div>

    <!-- Profiles List -->
    <div class="mt-4 space-y-3">
      <div v-if="profileList.length === 0" class="text-sm text-gray-400 py-8 text-center">
        No profiles yet. Create one to get started.
      </div>

      <div
        v-for="[name, profile] in profileList"
        :key="name"
        class="bg-white border border-gray-200 rounded shadow-subtle overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <button
              @click="toggleEnabled(name)"
              :class="['w-2 h-2 rounded-full', profile.enabled ? 'bg-green-500' : 'bg-gray-300']"
              :title="profile.enabled ? 'Click to disable' : 'Click to enable'"
            />
            <span class="font-medium text-gray-800 text-sm">{{ name }}</span>
            <span :class="['text-xs', profileStatus(profile).class]">{{ profileStatus(profile).label }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="editingProfile !== name"
              @click="startEdit(name)"
              class="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Edit
            </button>
            <button
              @click="deleteTarget = name"
              class="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-if="editingProfile === name" class="p-4 space-y-3 bg-gray-50/50">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
              <input v-model="form.description" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Max Tokens</label>
              <input v-model.number="form.max_tokens" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Temperature</label>
              <input v-model.number="form.temperature" type="number" step="0.1" min="0" max="2" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
          </div>

          <!-- Models -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Models</label>
            <div class="space-y-1.5">
              <div v-for="(model, i) in form.models" :key="i" class="flex items-center gap-2">
                <input v-model="model.name" placeholder="Model name" class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                <input v-model.number="model.weight" type="number" min="0" placeholder="Weight" class="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                <button @click="removeModel(i)" class="text-gray-400 hover:text-red-500">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <button @click="addModel" class="mt-2 text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
              <Plus class="w-3 h-3" /> Add model
            </button>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button @click="saveProfile(name)" class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">
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
        <div v-else class="px-4 py-2.5 text-sm text-gray-500">
          {{ profile.description || 'No description' }} &middot;
          {{ profile.models.length }} model{{ profile.models.length !== 1 ? 's' : '' }} &middot;
          max_tokens: {{ profile.max_tokens }} &middot;
          temp: {{ profile.temperature }}
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      title="Delete Profile"
      :message="deleteMessage"
      confirmLabel="Delete"
      danger
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </AppLayout>
</template>
