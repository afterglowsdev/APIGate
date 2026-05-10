import { ref, computed, watchEffect } from 'vue'
import zh from './zh'
import en from './en'

export type Locale = 'zh' | 'en'
export type Messages = typeof zh

const current = ref<Locale>((localStorage.getItem('locale') as Locale) || 'zh')

export function useLocale() {
  const messages = computed<Messages>(() => current.value === 'zh' ? zh : en)

  function toggle() {
    current.value = current.value === 'zh' ? 'en' : 'zh'
    localStorage.setItem('locale', current.value)
  }

  function setLocale(locale: Locale) {
    current.value = locale
    localStorage.setItem('locale', locale)
  }

  return { locale: current, messages, toggle, setLocale }
}
