<script setup lang="ts">
import { useLocale } from '../locales'

const { messages: t } = useLocale()

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div class="fixed inset-0 bg-black/30" @click="emit('cancel')" />
      <div class="relative bg-white rounded border border-gray-200 shadow-lg p-6 w-96 max-w-[90vw]">
        <h3 class="text-sm font-semibold text-gray-900">{{ title }}</h3>
        <p class="text-sm text-gray-500 mt-1.5">{{ message }}</p>
        <div class="flex justify-end gap-2 mt-4">
          <button
            @click="emit('cancel')"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            {{ t.dialog.cancel }}
          </button>
          <button
            @click="emit('confirm')"
            :class="[
              'px-3 py-1.5 text-xs font-medium text-white rounded transition-colors',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
            ]"
          >
            {{ confirmLabel || (danger ? t.dialog.delete : t.dialog.confirm) }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
