export interface WeightedItem<T> {
  item: T
  weight: number
}

export function weightedRandomSelect<T>(items: T[], weightFn: (item: T) => number): T {
  if (items.length === 0) {
    throw new Error('Cannot select from empty array')
  }

  const totalWeight = items.reduce((sum, item) => sum + weightFn(item), 0)
  if (totalWeight <= 0) {
    throw new Error('Total weight must be positive')
  }

  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= weightFn(item)
    if (random <= 0) {
      return item
    }
  }

  // Fallback to last item (handles floating point edge cases)
  return items[items.length - 1]
}
