import { useState, useEffect, useRef, useCallback } from 'react'
import type { AnimationName } from '@root/Ruby'
import {
  STATUS_ANIMATION_MAP,
  EMOTION_TRIGGER_MAP,
  EMOTION_DEFAULT_DURATION_MS,
  type RubyStatus,
  type EmotionTrigger,
} from '../components/animationMap'

export interface UseRubyControllerOptions {
  initialStatus?: RubyStatus
  prolongedIdleTimeoutMs?: number // e.g. 60000ms -> sleeping
}

export function useRubyController({
  initialStatus = 'idle',
  prolongedIdleTimeoutMs = 60000,
}: UseRubyControllerOptions = {}) {
  const [status, setStatusState] = useState<RubyStatus>(initialStatus)
  const [activeAnimation, setActiveAnimation] = useState<AnimationName>(
    STATUS_ANIMATION_MAP[initialStatus].primary
  )
  const [currentEmotion, setCurrentEmotion] = useState<EmotionTrigger | null>(null)

  const poolIndexRef = useRef<number>(0)
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const emotionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleInactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clear all timers helper
  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current)
      rotationTimerRef.current = null
    }
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (idleInactivityTimerRef.current) {
      clearTimeout(idleInactivityTimerRef.current)
      idleInactivityTimerRef.current = null
    }

    if (status === 'idle') {
      idleInactivityTimerRef.current = setTimeout(() => {
        // Trigger prolonged idle sleeping pose
        triggerEmotion('idleLong')
      }, prolongedIdleTimeoutMs)
    }
  }, [status, prolongedIdleTimeoutMs])

  // Trigger temporary one-shot emotion
  const triggerEmotion = useCallback(
    (trigger: EmotionTrigger, customDurationMs?: number) => {
      const emotionAnim = EMOTION_TRIGGER_MAP[trigger]
      const duration = customDurationMs ?? EMOTION_DEFAULT_DURATION_MS[trigger]

      setCurrentEmotion(trigger)
      setActiveAnimation(emotionAnim)

      if (emotionTimerRef.current) {
        clearTimeout(emotionTimerRef.current)
      }

      emotionTimerRef.current = setTimeout(() => {
        setCurrentEmotion(null)
        // Revert back to primary or current pool of active status
        const config = STATUS_ANIMATION_MAP[status]
        setActiveAnimation(config.pool[poolIndexRef.current] || config.primary)
        emotionTimerRef.current = null
      }, duration)
    },
    [status]
  )

  // Status changer with automatic rotation setup
  const setStatus = useCallback((newStatus: RubyStatus) => {
    setStatusState(newStatus)
    poolIndexRef.current = 0
  }, [])

  // Handle animation rotation when not locked by a one-shot emotion
  useEffect(() => {
    if (currentEmotion) return // pause standard rotation while emotion is playing

    const config = STATUS_ANIMATION_MAP[status]
    poolIndexRef.current = 0
    setActiveAnimation(config.primary)

    clearRotationTimer()

    if (config.rotationIntervalMs > 0 && config.pool.length > 1) {
      rotationTimerRef.current = setInterval(() => {
        poolIndexRef.current = (poolIndexRef.current + 1) % config.pool.length
        setActiveAnimation(config.pool[poolIndexRef.current])
      }, config.rotationIntervalMs)
    }

    resetInactivityTimer()

    return () => {
      clearRotationTimer()
    }
  }, [status, currentEmotion, clearRotationTimer, resetInactivityTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRotationTimer()
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current)
      if (idleInactivityTimerRef.current) clearTimeout(idleInactivityTimerRef.current)
    }
  }, [clearRotationTimer])

  return {
    status,
    setStatus,
    activeAnimation,
    currentEmotion,
    triggerEmotion,
    resetInactivityTimer,
  }
}
