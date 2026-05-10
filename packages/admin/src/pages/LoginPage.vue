<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const password = ref('')
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  await auth.login(password.value)
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="bg-white border border-gray-200 rounded px-6 py-8 shadow-subtle">
        <h1 class="text-lg font-semibold text-gray-900 text-center">Gateway Admin</h1>
        <p class="text-sm text-gray-500 text-center mt-1">Sign in to manage the gateway</p>

        <form @submit.prevent="handleSubmit" class="mt-6 space-y-4">
          <div>
            <label for="password" class="block text-xs font-medium text-gray-600 mb-1">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autofocus
              placeholder="Enter admin password"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
          </div>

          <div v-if="auth.error" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {{ auth.error }}
          </div>

          <button
            type="submit"
            :disabled="loading || !password"
            class="w-full py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
