<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLocale } from '../locales'
import { LayoutDashboard, Cpu, MonitorSmartphone, TabletSmartphone, Settings, Terminal, Languages } from 'lucide-vue-next'

const route = useRoute()
const auth = useAuthStore()
const { messages: t, locale, toggle } = useLocale()

const navItems = [
  { to: '/dashboard', label: () => t.value.sidebar.dashboard, icon: LayoutDashboard },
  { to: '/profiles', label: () => t.value.sidebar.profiles, icon: Cpu },
  { to: '/apps', label: () => t.value.sidebar.apps, icon: MonitorSmartphone },
  { to: '/devices', label: () => t.value.sidebar.devices, icon: TabletSmartphone },
  { to: '/settings', label: () => t.value.sidebar.settings, icon: Settings },
  { to: '/playground', label: () => t.value.sidebar.playground, icon: Terminal },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <aside class="w-56 bg-gray-950 text-gray-300 flex flex-col h-full">
    <div class="px-5 py-4 border-b border-gray-800">
      <h1 class="text-sm font-semibold text-white tracking-wide">{{ t.app.title }}</h1>
      <p class="text-xs text-gray-500 mt-0.5">{{ t.app.subtitle }}</p>
    </div>

    <nav class="flex-1 px-3 py-4 space-y-1">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to"
        :class="['flex items-center gap-2.5 px-3 py-2 text-sm rounded transition-colors',
          isActive(item.to) ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800/50']">
        <component :is="item.icon" class="w-4 h-4" />{{ item.label() }}
      </router-link>
    </nav>

    <div class="px-3 py-2 border-t border-gray-800 space-y-1">
      <button @click="toggle" class="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 rounded transition-colors w-full"
        :title="locale === 'zh' ? 'Switch to English' : '切换到中文'">
        <Languages class="w-3.5 h-3.5" />{{ locale === 'zh' ? 'English' : '中文' }}
      </button>
      <button @click="auth.logout()" class="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full">
        {{ t.sidebar.logout }}
      </button>
    </div>
  </aside>
</template>
