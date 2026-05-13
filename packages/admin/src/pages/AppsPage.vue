<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useConfigStore } from '../stores/config'
import { useLocale } from '../locales'
import type { AppData, AuthIdentifier } from '../api/client'
import { Plus, Trash2, Save, AlertTriangle, ChevronUp, ChevronDown, GripVertical } from 'lucide-vue-next'
import { generateToken } from '../utils'

const store = useConfigStore()
const { messages: t } = useLocale()
const editingApp = ref<string | null>(null)
const showNewForm = ref(false)
const deleteTarget = ref<string | null>(null)

function defaultIdentifiers(): AuthIdentifier[] {
  return [
    { header: 'X-App-Id', type: 'app', required: true, track: false },
    { header: 'X-Device-Id', type: 'device', required: true, track: true },
    { header: 'user_id', type: 'user', required: false, track: true },
    { header: 'X-App-Version', type: 'custom', required: false, track: false },
    { header: 'X-Platform', type: 'custom', required: false, track: false },
  ]
}

function defaultApp(): AppData {
  return {
    appId: '', name: '', enabled: false, requireAppSecret: false, appSecret: '',
    identifiers: defaultIdentifiers(),
    autoRegisterDevices: true, allowAnonymousDevices: true, defaultProfile: '',
    allowedProfiles: [], perDeviceDailyQuota: 0, perDeviceMonthlyQuota: 0,
    perDeviceRateLimitPerMinute: 0, perIpRateLimitPerMinute: 0, globalRateLimitPerMinute: 0,
  }
}

const newApp = ref<AppData>(defaultApp())
const form = ref<AppData>(defaultApp())

onMounted(() => store.loadConfig())
const profileNames = computed(() => Object.keys(store.profiles))

function startEdit(appId: string) {
  editingApp.value = appId
  const app = store.apps.find(a => a.appId === appId)
  if (app) form.value = JSON.parse(JSON.stringify(app))
}
function cancelEdit() { editingApp.value = null }

async function saveApp(appId: string) {
  store.updateApp(appId, form.value)
  const ok = await store.saveConfig()
  if (ok) editingApp.value = null
}

async function createApp() {
  if (!newApp.value.appId) return
  store.addApp({ ...newApp.value })
  const ok = await store.saveConfig()
  if (ok) {
    showNewForm.value = false
    newApp.value = defaultApp()
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  store.deleteApp(deleteTarget.value)
  await store.saveConfig()
  deleteTarget.value = null
}

const deleteMessage = computed(() => t.value.apps.deleteMsg.replace('{name}', deleteTarget.value || ''))

function genSecretNew() { newApp.value.appSecret = generateToken(24) }
function genSecretEdit() { form.value.appSecret = generateToken(24) }
function toggleProfile(profile: string) {
  const idx = form.value.allowedProfiles.indexOf(profile)
  if (idx >= 0) form.value.allowedProfiles.splice(idx, 1)
  else form.value.allowedProfiles.push(profile)
}

function appStatus(app: AppData): { label: string; class: string } {
  if (!app.enabled) return { label: t.value.apps.disabled, class: 'text-gray-400' }
  const issues = store.validateApp(app)
  if (issues.length > 0) return { label: issues.join(', '), class: 'text-amber-500' }
  return { label: t.value.apps.enabled, class: 'text-green-600' }
}

async function toggleEnabled(appId: string) {
  const app = store.apps.find(a => a.appId === appId)
  if (!app) return
  if (!app.enabled) {
    const issues = store.validateApp(app)
    if (issues.length > 0) { alert(issues.join(', ')); return }
  }
  app.enabled = !app.enabled
  await store.saveConfig()
}

// Identifier editor helpers / 识别码编辑
function addIdentifier(target: AppData) {
  if (!target.identifiers) target.identifiers = []
  target.identifiers.push({ header: '', type: 'device', required: false, track: true })
}
function removeIdentifier(target: AppData, index: number) {
  target.identifiers.splice(index, 1)
}
function moveIdentifier(target: AppData, index: number, dir: number) {
  const arr = target.identifiers
  const newIdx = index + dir
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]]
}

const identTypes = [
  { value: 'app', label: '应用 app' },
  { value: 'device', label: '设备 device' },
  { value: 'user', label: '用户 user' },
  { value: 'custom', label: '自定义 custom' },
]

function summarizeIdentifier(ident: AuthIdentifier): string {
  const flags = [ident.required ? '必填' : '可选']
  if (ident.track) flags.push('跟踪')
  return `${ident.header}(${flags.join('/')})`
}

function summarizeIdentifiers(identifiers?: AuthIdentifier[]): string {
  const active = (identifiers || []).filter((ident) => ident.header.trim().length > 0)
  if (active.length === 0) return '未配置'
  return active.map(summarizeIdentifier).join(', ')
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ t.apps.title }}</h2>
        <p class="text-sm text-gray-500 mt-0.5">{{ t.apps.subtitle }}</p>
      </div>
      <button @click="showNewForm = true" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors">
        <Plus class="w-3.5 h-3.5" />{{ t.apps.newApp }}
      </button>
    </div>

    <div v-if="store.warnings.length" class="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
      <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <div><div v-for="(w, i) in store.warnings" :key="i" class="text-amber-700">{{ w }}</div></div>
    </div>

    <!-- New App form -->
    <div v-if="showNewForm" class="mt-4 bg-white border border-gray-200 rounded p-4 shadow-subtle space-y-3">
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.appId }}</label>
          <input v-model="newApp.appId" :placeholder="t.apps.appIdPlaceholder" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.name }}</label>
          <input v-model="newApp.name" :placeholder="t.apps.namePlaceholder" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.appSecret }}</label>
          <div class="flex gap-1">
            <input v-model="newApp.appSecret" placeholder="(optional)" class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono" />
            <button @click="genSecretNew" class="px-2 py-1.5 text-xs bg-gray-100 rounded border border-gray-300 hover:bg-gray-200 shrink-0">{{ t.apps.genSecret }}</button>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="createApp" class="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800">{{ t.create }}</button>
        <button @click="showNewForm = false" class="px-3 py-1.5 text-xs text-gray-500">{{ t.cancel }}</button>
      </div>
    </div>

    <div class="mt-4 space-y-3">
      <div v-if="store.apps.length === 0" class="text-sm text-gray-400 py-8 text-center">{{ t.apps.noApps }}</div>

      <!-- App card -->
      <div v-for="app in store.apps" :key="app.appId" class="bg-white border border-gray-200 rounded shadow-subtle overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <button @click="toggleEnabled(app.appId)" :class="['w-2 h-2 rounded-full', app.enabled ? 'bg-green-500' : 'bg-gray-300']" />
            <span class="font-medium text-gray-800 text-sm">{{ app.name }}</span>
            <code class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ app.appId }}</code>
            <span :class="['text-xs', appStatus(app).class]">{{ appStatus(app).label }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="editingApp !== app.appId" @click="startEdit(app.appId)" class="text-xs text-gray-500 hover:text-gray-800">{{ t.edit }}</button>
            <button @click="deleteTarget = app.appId" class="text-xs text-gray-400 hover:text-red-600"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <!-- Edit form -->
        <div v-if="editingApp === app.appId" class="p-4 space-y-3 bg-gray-50/50">
          <div class="grid grid-cols-3 gap-3">
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.name }}</label>
              <input v-model="form.name" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.appSecret }}</label>
              <div class="flex gap-1">
                <input v-model="form.appSecret" placeholder="(optional)" class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono" />
                <button @click="genSecretEdit" class="px-2 py-1.5 text-xs bg-gray-100 rounded border border-gray-300 hover:bg-gray-200 shrink-0">{{ t.apps.genSecret }}</button>
              </div></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.defaultProfile }}</label>
              <select v-model="form.defaultProfile" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900">
                <option value="">{{ t.settings.selectProfile }}</option>
                <option v-for="p in profileNames" :key="p" :value="p">{{ p }}</option>
              </select></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.perDeviceDailyQuota }}</label>
              <input v-model.number="form.perDeviceDailyQuota" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.perDeviceMonthlyQuota }}</label>
              <input v-model.number="form.perDeviceMonthlyQuota" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.perDeviceRateLimitPerMinute }}</label>
              <input v-model.number="form.perDeviceRateLimitPerMinute" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.perIpRateLimitPerMinute }}</label>
              <input v-model.number="form.perIpRateLimitPerMinute" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.globalRateLimitPerMinute }}</label>
              <input v-model.number="form.globalRateLimitPerMinute" type="number" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
            <div><label class="block text-xs font-medium text-gray-600 mb-0.5">{{ t.apps.minAppVersion }}</label>
              <input v-model="form.minAppVersion" placeholder="e.g. 1.0.0" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" /></div>
          </div>

          <!-- Identifiers editor / 识别码配置 -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-gray-600">{{ t.apps.identifiers }}</label>
              <button @click="addIdentifier(form)" class="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-0.5">
                <Plus class="w-3 h-3" />{{ t.apps.addIdentifier }}
              </button>
            </div>
            <p class="text-xs text-gray-400 mb-2">{{ t.apps.identifiersDesc }}</p>
            <div class="space-y-1">
              <div v-for="(ident, i) in form.identifiers" :key="i"
                class="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
                <GripVertical class="w-3 h-3 text-gray-300 shrink-0" />
                <span class="text-[11px] text-gray-400 w-4">{{ i + 1 }}</span>
                <input v-model="ident.header" placeholder="Header name" class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 font-mono" />
                <select v-model="ident.type" class="px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 w-28">
                  <option v-for="it in identTypes" :key="it.value" :value="it.value">{{ it.label }}</option>
                </select>
                <label class="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer whitespace-nowrap" :title="t.apps.required">
                  <input v-model="ident.required" type="checkbox" class="rounded border-gray-300 w-3 h-3" />必填
                </label>
                <label class="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer whitespace-nowrap" :title="t.apps.track">
                  <input v-model="ident.track" type="checkbox" class="rounded border-gray-300 w-3 h-3" />跟踪
                </label>
                <button @click="moveIdentifier(form, i, -1)" :disabled="i === 0" class="text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronUp class="w-3 h-3" /></button>
                <button @click="moveIdentifier(form, i, 1)" :disabled="i === form.identifiers.length - 1" class="text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronDown class="w-3 h-3" /></button>
                <button @click="removeIdentifier(form, i)" class="text-gray-300 hover:text-red-500"><Trash2 class="w-3 h-3" /></button>
              </div>
              <div v-if="!form.identifiers?.length" class="text-xs text-gray-400 py-2 text-center">{{ t.apps.noIdentifiers }}</div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">{{ t.apps.allowedProfiles }}</label>
            <div class="flex flex-wrap gap-1.5">
              <label v-for="p in profileNames" :key="p"
                :class="['px-2.5 py-1 text-xs rounded border cursor-pointer transition-colors',
                  form.allowedProfiles.includes(p) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400']">
                <input type="checkbox" :checked="form.allowedProfiles.includes(p)" @change="toggleProfile(p)" class="hidden" />{{ p }}
              </label>
            </div>
          </div>

          <div class="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
            <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input v-model="form.requireAppSecret" type="checkbox" class="rounded border-gray-300" />{{ t.apps.requireAppSecret }}
            </label>
            <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input v-model="form.autoRegisterDevices" type="checkbox" class="rounded border-gray-300" />{{ t.apps.autoRegisterDevices }}
            </label>
            <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input v-model="form.allowAnonymousDevices" type="checkbox" class="rounded border-gray-300" />{{ t.apps.allowAnonymousDevices }}
            </label>
            <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-auto">
              <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300" />{{ t.apps.enabled }}
            </label>
          </div>

          <div class="flex items-center gap-2">
            <button @click="saveApp(app.appId)" class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800"><Save class="w-3 h-3" />{{ t.save }}</button>
            <button @click="cancelEdit" class="px-3 py-1.5 text-xs text-gray-500">{{ t.cancel }}</button>
          </div>
        </div>

        <!-- Collapsed summary -->
        <div v-else class="px-4 py-2.5 text-sm text-gray-500 flex items-center gap-4 flex-wrap">
          <span v-if="app.requireAppSecret">{{ t.apps.requireAppSecret }}: ON</span>
          <span>{{ t.apps.allowedProfiles }}: {{ app.allowedProfiles.join(', ') || 'none' }}</span>
          <span class="text-gray-400">| 识别码: {{ summarizeIdentifiers(app.identifiers) }}</span>
          <span v-if="app.perDeviceDailyQuota">日: {{ app.perDeviceDailyQuota }}</span>
          <span v-if="app.perDeviceRateLimitPerMinute">{{ app.perDeviceRateLimitPerMinute }}/min</span>
        </div>
      </div>
    </div>

    <ConfirmDialog :open="!!deleteTarget" :title="t.apps.deleteTitle" :message="deleteMessage"
      :confirmLabel="t.dialog.delete" danger @confirm="confirmDelete" @cancel="deleteTarget = null" />
  </AppLayout>
</template>
