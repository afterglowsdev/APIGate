<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { LayoutDashboard, Cpu, Users, Settings, Terminal } from 'lucide-vue-next'

const route = useRoute()
const auth = useAuthStore()

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profiles', label: 'Profiles', icon: Cpu },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/playground', label: 'Playground', icon: Terminal },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <aside class="w-56 bg-gray-950 text-gray-300 flex flex-col min-h-screen">
    <div class="px-5 py-4 border-b border-gray-800">
      <h1 class="text-sm font-semibold text-white tracking-wide">LLM Gateway</h1>
      <p class="text-xs text-gray-500 mt-0.5">Admin Console</p>
    </div>

    <nav class="flex-1 px-3 py-4 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          'flex items-center gap-2.5 px-3 py-2 text-sm rounded transition-colors',
          isActive(item.to)
            ? 'bg-gray-800 text-white font-medium'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        ]"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </router-link>
    </nav>

    <div class="px-5 py-3 border-t border-gray-800">
      <button
        @click="auth.logout()"
        class="text-xs text-gray-500 hover:text-gray-300 transition-colors w-full text-left"
      >
        Sign out
      </button>
    </div>
  </aside>
</template>
