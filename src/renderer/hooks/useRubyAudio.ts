import { useState, useEffect, useRef, useCallback } from 'react'
import { wakeWordService } from '../services/wakeWordService'

export interface AudioSettings {
  language: string
  wakeWordEnabled: boolean
  wakeWordSensitivity: number
  voiceIndex: number
  speechRate: number
  speechPitch: number
  volume: number
  autoTtsEnabled: boolean
}

export interface UseRubyAudioProps {
  settings?: Partial<AudioSettings>
  onSpeechResult?: (transcript: string) => void
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onTtsStart?: () => void
  onTtsEnd?: () => void
  onWakeWordDetected?: () => void
}

export function useRubyAudio({
  settings: initialSettings,
  onSpeechResult,
  onSpeechStart,
  onSpeechEnd,
  onTtsStart,
  onTtsEnd,
  onWakeWordDetected,
}: UseRubyAudioProps = {}) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const recognitionRef = useRef<any>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const settings: AudioSettings = {
    language: 'id-ID',
    wakeWordEnabled: false,
    wakeWordSensitivity: 0.7,
    voiceIndex: 0,
    speechRate: 1.0,
    speechPitch: 1.0,
    volume: 1.0,
    autoTtsEnabled: false,
    ...initialSettings,
  }

  // Load available system TTS voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const availableVoices = window.speechSynthesis.getVoices()
        setVoices(availableVoices)
      }
    }

    updateVoices()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  // Setup Wake Word service
  useEffect(() => {
    wakeWordService.setSensitivity(settings.wakeWordSensitivity)
    wakeWordService.setEnabled(settings.wakeWordEnabled)

    wakeWordService.onWake((kw) => {
      console.log('[RubyAudio] Wake word detected:', kw)
      onWakeWordDetected?.()
      startListening()
    })

    return () => {
      wakeWordService.stop()
    }
  }, [settings.wakeWordEnabled, settings.wakeWordSensitivity])

  // Setup Tauri global shortcut listener
  useEffect(() => {
    let unlistenShortcut: (() => void) | null = null

    const initTauriEvent = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const unlisten = await listen('ruby://toggle-listen', () => {
          if (isListening) {
            stopListening()
          } else {
            startListening()
          }
        })
        unlistenShortcut = unlisten
      } catch {
        // Not running in Tauri or mock mode
      }
    }

    initTauriEvent()

    // DOM fallback keyboard shortcut: Ctrl/Cmd + Shift + R
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        if (isListening) {
          stopListening()
        } else {
          startListening()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlistenShortcut?.()
    }
  }, [isListening])

  // Speech Recognition (STT) methods
  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API tidak didukung di browser ini.')
      return
    }

    // Stop ongoing TTS when user starts speaking
    stopSpeaking()

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore
      }
    }

    const recognition = new SpeechRecognition()
    recognition.lang = settings.language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
      onSpeechStart?.()
    }

    recognition.onresult = (event: any) => {
      let currentResult = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentResult += event.results[i][0].transcript
      }
      setTranscript(currentResult)
      if (event.results[0]?.isFinal) {
        onSpeechResult?.(currentResult)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[RubyAudio] Recognition error:', event.error)
      setIsListening(false)
      onSpeechEnd?.()
    }

    recognition.onend = () => {
      setIsListening(false)
      onSpeechEnd?.()
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      console.error('[RubyAudio] Failed to start recognition:', err)
      setIsListening(false)
    }
  }, [settings.language, onSpeechStart, onSpeechResult, onSpeechEnd])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
      setIsListening(false)
      onSpeechEnd?.()
    }
  }, [onSpeechEnd])

  // Text-To-Speech (TTS) methods
  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis API tidak didukung.')
        return
      }

      window.speechSynthesis.cancel() // Cancel previous

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = settings.language
      utterance.rate = settings.speechRate
      utterance.pitch = settings.speechPitch
      utterance.volume = settings.volume

      // Auto-pick Indonesian voice if available
      const indonesianVoice =
        voices.find((v) => v.lang.includes('id') || v.lang.includes('ID')) ||
        voices[settings.voiceIndex] ||
        null

      if (indonesianVoice) {
        utterance.voice = indonesianVoice
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
        onTtsStart?.()
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        onTtsEnd?.()
      }

      utterance.onerror = (e) => {
        console.warn('[RubyAudio] TTS Error:', e)
        setIsSpeaking(false)
        onTtsEnd?.()
      }

      currentUtteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [settings, voices, onTtsStart, onTtsEnd]
  )

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      onTtsEnd?.()
    }
  }, [onTtsEnd])

  return {
    isListening,
    isSpeaking,
    transcript,
    voices,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
