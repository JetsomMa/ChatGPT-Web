import { computed } from 'vue'
import { useChatStore } from '@/store'

export function useQueryMethod() {
  const chatStore = useChatStore()
  const querymethod = computed<string>(() => chatStore.querymethod)

  function setQueryMethod(querymethod: string) {
    chatStore.setQueryMethod(querymethod)
		// if(querymethod === '画画'){
		// 	alert('画画的结果会被同步到微信群，请不要画少儿不宜的内容！')
		// }
  }

  return {
    querymethod,
    setQueryMethod,
  }
}
