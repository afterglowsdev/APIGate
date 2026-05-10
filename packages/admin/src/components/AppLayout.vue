<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar />
    <main class="flex-1 bg-gray-50">
      <div class="px-8 py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
