import type { AnimationName } from '@root/Ruby'

export type RubyStatus = 'idle' | 'listening' | 'processing' | 'speaking'

export type EmotionTrigger =
  | 'wakeWordDetected'
  | 'excelSuccess'
  | 'error'
  | 'compliment'
  | 'greeting'
  | 'idleLong'

export interface StatusAnimationConfig {
  primary: AnimationName
  pool: AnimationName[]
  rotationIntervalMs: number
}

/**
 * Mapping status to animation cycles and rotation intervals
 */
export const STATUS_ANIMATION_MAP: Record<RubyStatus, StatusAnimationConfig> = {
  idle: {
    primary: 'idle',
    pool: ['idle', 'bored', 'drowsy', 'curious'],
    rotationIntervalMs: 8000, // 8s rotation
  },
  listening: {
    primary: 'listening',
    pool: ['listening'],
    rotationIntervalMs: 0, // static pose during listening
  },
  processing: {
    primary: 'thinking',
    pool: ['thinking', 'searching', 'working', 'confused'],
    rotationIntervalMs: 1500, // 1.5s fast rotation
  },
  speaking: {
    primary: 'happy',
    pool: ['happy', 'excited', 'playful', 'laughing'],
    rotationIntervalMs: 800, // 0.8s lively rotation
  },
}

/**
 * One-shot emotion animations mapped to triggers
 */
export const EMOTION_TRIGGER_MAP: Record<EmotionTrigger, AnimationName> = {
  wakeWordDetected: 'surprised',
  excelSuccess: 'celebrate',
  error: 'sad',
  compliment: 'shy',
  greeting: 'waking',
  idleLong: 'sleeping',
}

/**
 * Default duration for one-shot emotions before returning to base status
 */
export const EMOTION_DEFAULT_DURATION_MS: Record<EmotionTrigger, number> = {
  wakeWordDetected: 1800,
  excelSuccess: 2600,
  error: 2200,
  compliment: 2400,
  greeting: 2000,
  idleLong: 8000,
}
