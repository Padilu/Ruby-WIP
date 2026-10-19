import type { LLMConfig } from './llmService'
import type { AudioSettings } from '../hooks/useRubyAudio'

export interface AppSettings {
  // Position & Window
  anchor: 'notch' | 'tray' | 'top_center' | 'custom'
  preset: 'small' | 'medium' | 'large' | 'expanded' | 'custom'
  width: number
  height: number
  offsetX: number
  offsetY: number
  alwaysOnTop: boolean

  // Audio & Speech
  audio: AudioSettings

  // LLM Configuration
  llm: LLMConfig

  // Excel Configuration
  excel: {
    filePath: string
    sheetName: string
    autoCategorize: boolean
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  anchor: 'notch',
  preset: 'medium',
  width: 240,
  height: 42,
  offsetX: 0,
  offsetY: 0,
  alwaysOnTop: true,
  audio: {
    language: 'id-ID',
    wakeWordEnabled: false,
    wakeWordSensitivity: 0.7,
    voiceIndex: 0,
    speechRate: 1.0,
    speechPitch: 1.0,
    volume: 1.0,
  },
  llm: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
  },
  excel: {
    filePath: 'C:\\Users\\User\\Documents\\Ruby_Keuangan.xlsx',
    sheetName: 'Pengeluaran',
    autoCategorize: true,
  },
}

const LOCAL_STORAGE_KEY = 'ruby_app_settings_v1'

export class StoreService {
  private store: any = null

  private async getTauriStore() {
    if (this.store) return this.store
    try {
      const { Store } = await import('@tauri-apps/plugin-store')
      this.store = await Store.load('ruby-settings.json')
      return this.store
    } catch {
      return null
    }
  }

  public async loadSettings(): Promise<AppSettings> {
    try {
      const tauriStore = await this.getTauriStore()
      if (tauriStore) {
        const saved = (await tauriStore.get('settings')) as AppSettings | null
        if (saved) return { ...DEFAULT_SETTINGS, ...saved }
      }
    } catch (e) {
      console.warn('[StoreService] Tauri store error, fallback to localStorage', e)
    }

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      }
    } catch {
      // Ignore
    }

    return DEFAULT_SETTINGS
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const tauriStore = await this.getTauriStore()
      if (tauriStore) {
        await tauriStore.set('settings', settings)
        await tauriStore.save()
      }
    } catch (e) {
      console.warn('[StoreService] Failed to save in Tauri store:', e)
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore
    }
  }
}

export const storeService = new StoreService()
