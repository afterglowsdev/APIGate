<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useConfigStore } from '../stores/config'
import { Save, AlertTriangle } from 'lucide-vue-next'

const store = useConfigStore()
const saving = ref(false)
const saved = ref(false)

onMounted(() => store.loadConfig())

async function save() {
  saving.value = true
  saved.value = false
  await store.saveConfig()
  saving.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Settings</h2>
        <p class="text-sm text-gray-500 mt-0.5">Gateway configuration</p>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="saved" class="text-xs text-green-600">Saved</span>
        <button
          @click="save"
          :disabled="saving"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Save class="w-3 h-3" />
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="store.warnings.length" class="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
      <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <div v-for="(w, i) in store.warnings" :key="i" class="text-amber-700">{{ w }}</div>
      </div>
    </div>

    <div v-if="!store.config" class="mt-6 text-sm text-gray-400">Loading...</div>

    <div v-else class="mt-6 space-y-5 max-w-2xl">
      <!-- Default Profile -->
      <div class="bg-white border border-gray-200 rounded p-4 shadow-subtle">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">Default Profile</h3>
        <p class="text-xs text-gray-500 mb-2">Used when no profile is specified in the request.</p>
        <select
          v-model="store.config.defaultProfile"
          class="w-64 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="" disabled>Select a profile</option>
          <option
            v-for="name in Object.keys(store.config.profiles)"
            :key="name"
            :value="name"
            :disabled="!store.config.profiles[name].enabled"
          >
            {{ name }}{{ store.config.profiles[name].enabled ? '' : ' (disabled)' }}
          </option>
        </select>
      </div>

      <!-- Timeout -->
      <div class="bg-white border border-gray-200 rounded p-4 shadow-subtle">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">Timeout (ms)</h3>
        <p class="text-xs text-gray-500 mb-2">Maximum time to wait for upstream response.</p>
        <input
          v-model.number="store.config.timeoutMs"
          type="number"
          min="1000"
          step="1000"
          class="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <!-- Body Size Limit -->
      <div class="bg-white border border-gray-200 rounded p-4 shadow-subtle">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">Request Body Limit (bytes)</h3>
        <p class="text-xs text-gray-500 mb-2">Maximum size of the request body.</p>
        <input
          v-model.number="store.config.requestBodyLimitBytes"
          type="number"
          min="1024"
          step="1024"
          class="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <span class="text-xs text-gray-400 ml-2">
          {{ store.config.requestBodyLimitBytes ? (store.config.requestBodyLimitBytes / 1024 / 1024).toFixed(2) + ' MB' : '' }}
        </span>
      </div>

      <!-- Debug -->
      <div class="bg-white border border-gray-200 rounded p-4 shadow-subtle">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">Debug Mode</h3>
        <p class="text-xs text-gray-500 mb-2">Enables detailed logging (not recommended for production).</p>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input
            v-model="store.config.debug"
            type="checkbox"
            class="rounded border-gray-300"
          />
          Enable debug logging
        </label>
      </div>
    </div>
  </AppLayout>
</template>
