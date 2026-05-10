<script setup lang="ts" generic="T extends Record<string, unknown>">
defineProps<{
  columns: { key: string; label: string; class?: string }[]
  rows: T[]
  loading?: boolean
}>()
</script>

<template>
  <div class="bg-white border border-gray-200 rounded overflow-hidden shadow-subtle">
    <div v-if="loading" class="px-4 py-12 text-center text-sm text-gray-400">
      Loading...
    </div>
    <div v-else-if="rows.length === 0" class="px-4 py-12 text-center text-sm text-gray-400">
      No data
    </div>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 bg-gray-50">
          <th
            v-for="col in columns"
            :key="col.key"
            :class="['px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide', col.class]"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr v-for="(row, i) in rows" :key="i" class="hover:bg-gray-50 transition-colors">
          <td
            v-for="col in columns"
            :key="col.key"
            :class="['px-4 py-2.5 text-gray-700', col.class]"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
