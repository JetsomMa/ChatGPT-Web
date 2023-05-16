import { computed } from 'vue'
import { useChatStore } from '@/store'

export function useQueryMethod() {
  const chatStore = useChatStore()
  const querymethod = computed<string>(() => chatStore.querymethod)

  function setQueryMethod(querymethod: string) {
    chatStore.setQueryMethod(querymethod)
  }

  return {
    querymethod,
    setQueryMethod,
  }
}
