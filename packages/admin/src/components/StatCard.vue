<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  description?: string
}>()
</script>

<template>
  <div class="bg-white border border-gray-200 rounded px-4 py-3 shadow-subtle">
    <div class="text-xs text-gray-500 font-medium uppercase tracking-wide">{{ title }}</div>
    <div class="text-2xl font-semibold text-gray-900 mt-1">{{ value }}</div>
    <div v-if="description" class="text-xs text-gray-400 mt-0.5">{{ description }}</div>
  </div>
</template>
