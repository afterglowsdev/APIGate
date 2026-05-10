<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto bg-gray-50">
      <div class="px-8 py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
