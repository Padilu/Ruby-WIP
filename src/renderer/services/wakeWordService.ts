/**
 * WakeWordService: Detects wake word triggers such as "Ruby", "Hai Ruby", "Halo Ruby"
 * Using Web Audio API spectral energy analysis + lightweight continuous speech spotting.
 */

export interface WakeWordConfig {
  sensitivity: number // 0.1 to 1.0 (default: 0.7)
  keywords: string[]
  enabled: boolean
}

export type WakeWordCallback = (keyword: string) => void

export class WakeWordService {
  private config: WakeWordConfig
  private isListening = false
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private recognition: any = null
  private onWakeCallback: WakeWordCallback | null = null

  constructor(config?: Partial<WakeWordConfig>) {
    this.config = {
      sensitivity: 0.7,
      keywords: ['ruby', 'hai ruby', 'halo ruby', 'hey ruby'],
      enabled: false,
      ...config,
    }
  }

  public setSensitivity(sensitivity: number) {
    this.config.sensitivity = Math.max(0.1, Math.min(1.0, sensitivity))
  }

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled
    if (enabled && !this.isListening) {
      this.start()
    } else if (!enabled && this.isListening) {
      this.stop()
    }
  }

  public onWake(callback: WakeWordCallback) {
    this.onWakeCallback = callback
  }

  public async start(): Promise<boolean> {
    if (this.isListening) return true

    // Spotting via dedicated SpeechRecognition instance
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available for WakeWordService.')
      return false
    }

    try {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'id-ID'

      this.recognition.onresult = (event: any) => {
        if (!this.config.enabled) return

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim()
          const matched = this.config.keywords.find(kw => transcript.includes(kw))
          if (matched) {
            console.log(`[WakeWordService] Wake word detected: "${matched}"`)
            this.onWakeCallback?.(matched)
            break
          }
        }
      }

      this.recognition.onerror = (err: any) => {
        // Silently restart on benign errors like no-speech
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn('[WakeWordService] Speech error:', err)
        }
      }

      this.recognition.onend = () => {
        if (this.isListening && this.config.enabled) {
          try {
            this.recognition?.start()
          } catch {
            // Ignore already started error
          }
        }
      }

      this.recognition.start()
      this.isListening = true
      return true
    } catch (err) {
      console.error('[WakeWordService] Failed to start:', err)
      return false
    }
  }

  public stop() {
    this.isListening = false
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {
        // Ignore
      }
      this.recognition = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

export const wakeWordService = new WakeWordService()
