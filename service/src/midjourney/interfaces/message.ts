export interface MJMessage {
  localurl: string
  uri: string
  content: string
  id?: string
  hash?: string
  progress?: string
}

export type LoadingHandler = (uri: string, progress: string) => void

export interface WaitMjEvent {
  type: 'imagine' | 'upscale' | 'variation' | 'info'
  nonce: string
  prompt?: string
  id?: string
  index?: number
}
export interface WsEventMsg {
  error?: Error
  message?: MJMessage
}
export type ImageEventType = 'imagine' | 'upscale' | 'variation'

export interface MJInfo {
  subscription: string
  jobMode: string
  visibilityMode: string
  fastTimeRemaining: string
  lifetimeUsage: string
  relaxedUsage: string
  queuedJobsFast: string
  queuedJobsRelax: string
  runningJobs: string
}
