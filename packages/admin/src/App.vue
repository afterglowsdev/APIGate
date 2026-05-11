<script setup lang="ts">
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
setUnauthorizedHandler(() => auth.handleUnauthorized())
</script>

<template>
  <router-view />
</template>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
