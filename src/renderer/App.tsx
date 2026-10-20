import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { ChatWindow, type MessageItem } from './components/ChatWindow'
import { SettingsPanel } from './components/SettingsPanel'
import { useRubyController } from './hooks/useRubyController'
import { useRubyAudio } from './hooks/useRubyAudio'
import { storeService, type AppSettings, DEFAULT_SETTINGS } from './services/storeService'
import { llmService } from './services/llmService'
import { excelService } from './services/excelService'

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean
    version?: string
    body?: string
    updateObj?: any
    isDownloading?: boolean
    downloadProgress?: number
  } | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'ruby',
      text: 'Halo! Aku Ruby, AI Assistant pribadimu. Tekan Ctrl/Cmd+Shift+R atau klik mic untuk bicara.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  // Ruby animation & emotion state controller
  const {
    status,
    setStatus,
    activeAnimation,
    triggerEmotion,
    resetInactivityTimer,
  } = useRubyController({
    initialStatus: 'idle',
    prolongedIdleTimeoutMs: 60000,
  })

  // Apply window resize & position through Tauri
  const applyWindowDimensions = useCallback(
    async (expanded: boolean, customConfig?: any) => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const cfg = customConfig || {
          anchor: settings.anchor,
          preset: expanded ? 'expanded' : settings.preset,
          width: expanded ? 360 : settings.width,
          height: expanded ? 480 : settings.height,
          offset_x: settings.offsetX,
          offset_y: settings.offsetY,
        }

        await invoke('position_overlay', {
          config: {
            anchor: cfg.anchor,
            preset: cfg.preset,
            width: cfg.width,
            height: cfg.height,
            offset_x: cfg.offset_x ?? cfg.offsetX ?? 0,
            offset_y: cfg.offset_y ?? cfg.offsetY ?? 0,
          },
        })
      } catch {
        // Mock / Web development preview mode
      }
    },
    [settings]
  )

  // Load persistent settings on mount
  useEffect(() => {
    storeService.loadSettings().then(loaded => {
      setSettings(loaded)
      applyWindowDimensions(false, loaded)
    })
  }, [])

  // Auto-updater check on startup
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update?.available) {
          setUpdateInfo({
            available: true,
            version: update.version,
            body: update.body,
            updateObj: update,
          })
        }
      } catch {
        // Silently ignore in dev/offline
      }
    }

    checkForUpdates()
  }, [])

  const handleInstallUpdate = async () => {
    if (!updateInfo?.updateObj) return
    try {
      setUpdateInfo(prev => (prev ? { ...prev, isDownloading: true, downloadProgress: 0 } : null))
      let downloaded = 0
      let contentLength = 0
      await updateInfo.updateObj.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              setUpdateInfo(prev =>
                prev ? { ...prev, downloadProgress: Math.round((downloaded / contentLength) * 100) } : null
              )
            }
            break
          case 'Finished':
            break
        }
      })
      try {
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      } catch {
        window.location.reload()
      }
    } catch (err) {
      console.error('[Updater] Install error:', err)
      setUpdateInfo(null)
    }
  }

  // Listen to Tauri system tray events
  useEffect(() => {
    let unlistenSettings: (() => void) | null = null

    const bindTauriEvents = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const unlisten = await listen('ruby://open-settings', () => {
          setShowSettings(true)
          setIsExpanded(true)
          applyWindowDimensions(true)
        })
        unlistenSettings = unlisten
      } catch {
        // Not in Tauri
      }
    }

    bindTauriEvents()
    return () => {
      unlistenSettings?.()
    }
  }, [applyWindowDimensions])

  // Toggle chat expand
  const handleToggleExpand = (expand: boolean) => {
    setIsExpanded(expand)
    applyWindowDimensions(expand)
  }

  // Audio Hook integration
  const {
    isListening,
    isSpeaking,
    transcript: liveTranscript,
    voices,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useRubyAudio({
    settings: settings.audio,
    onSpeechStart: () => {
      setStatus('listening')
      resetInactivityTimer()
    },
    onSpeechEnd: () => {
      if (status === 'listening') {
        setStatus('idle')
      }
    },
    onTtsStart: () => {
      setStatus('speaking')
    },
    onTtsEnd: () => {
      setStatus('idle')
      resetInactivityTimer()
    },
    onWakeWordDetected: () => {
      triggerEmotion('wakeWordDetected') // One-shot 'surprised'
      setIsExpanded(true)
      applyWindowDimensions(true)
    },
    onSpeechResult: (finalText) => {
      if (finalText.trim()) {
        handleUserQuery(finalText.trim())
      }
    },
  })

  // Emotion sentiment detection for complimentary / greeting phrases
  const analyzeEmotionTriggers = (query: string): boolean => {
    const q = query.toLowerCase()
    if (
      q.includes('terima kasih') ||
      q.includes('makasih') ||
      q.includes('pintar') ||
      q.includes('hebat') ||
      q.includes('cantik') ||
      q.includes('keren') ||
      q.includes('lucu')
    ) {
      triggerEmotion('compliment') // One-shot 'shy'
      return true
    }
    if (
      q.includes('halo ruby') ||
      q.includes('hai ruby') ||
      q.includes('selamat pagi') ||
      q.includes('selamat siang') ||
      q.includes('selamat malam')
    ) {
      triggerEmotion('greeting') // One-shot 'waking'
      return true
    }
    return false
  }

  // Central query handler (Financial extraction & conversational chat)
  const handleUserQuery = async (queryText: string) => {
    resetInactivityTimer()
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Append user message
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: now,
    }
    setMessages(prev => [...prev, userMsg])

    // Analyze emotional response
    analyzeEmotionTriggers(queryText)

    setStatus('processing')

    try {
      // Step 1: Check for financial transaction extraction via LLM
      const tx = await llmService.extractFinancialTransaction(queryText, settings.llm)

      if (tx && tx.nominal > 0) {
        // Append to Excel file
        const excelRes = await excelService.appendTransaction(
          settings.excel.filePath,
          settings.excel.sheetName,
          tx
        )

        if (excelRes.success) {
          triggerEmotion('excelSuccess') // One-shot 'celebrate'
          const replyText = `Berhasil! ${excelRes.message}`
          const rubyMsg: MessageItem = {
            id: `ruby-${Date.now()}`,
            sender: 'ruby',
            text: replyText,
            transaction: tx,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          setMessages(prev => [...prev, rubyMsg])
          if (settings.audio.autoTtsEnabled) {
            speak(`Siap! Transaksi sebesar ${tx.nominal.toLocaleString('id-ID')} rupiah untuk ${tx.kategori} sudah dicatat ke Excel.`)
          }
        } else {
          triggerEmotion('error') // One-shot 'sad'
          const errorMsg: MessageItem = {
            id: `ruby-${Date.now()}`,
            sender: 'ruby',
            text: `⚠️ ${excelRes.message}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          setMessages(prev => [...prev, errorMsg])
          if (settings.audio.autoTtsEnabled) {
            speak(excelRes.isLocked ? 'File Excel sedang dibuka, tolong tutup terlebih dahulu ya.' : 'Maaf, terjadi kesalahan saat menulis ke Excel.')
          }
        }
        return
      }

      // Step 2: Regular conversational LLM completion
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }))
      conversationHistory.push({ role: 'user', content: queryText })

      const reply = await llmService.chat(conversationHistory, settings.llm)

      const rubyMsg: MessageItem = {
        id: `ruby-${Date.now()}`,
        sender: 'ruby',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, rubyMsg])
      if (settings.audio.autoTtsEnabled) {
        speak(reply)
      }
    } catch (err: any) {
      triggerEmotion('error') // One-shot 'sad'
      const errorMsg: MessageItem = {
        id: `ruby-${Date.now()}`,
        sender: 'ruby',
        text: `Maaf, terjadi kendala: ${err.message || 'Gagal memproses pesan.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, errorMsg])
      if (settings.audio.autoTtsEnabled) {
        speak('Maaf, ada kendala saat memproses jawaban.')
      }
    }
  }

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings)
    storeService.saveSettings(newSettings)
  }

  return (
    <div className="w-full h-full p-1.5 flex flex-col justify-start items-center relative">
      <ChatWindow
        status={status}
        activeAnimation={activeAnimation}
        isListening={isListening}
        isSpeaking={isSpeaking}
        liveTranscript={liveTranscript}
        messages={messages}
        onToggleListen={() => {
          if (isListening) stopListening()
          else startListening()
        }}
        onSendMessage={handleUserQuery}
        onOpenSettings={() => {
          setShowSettings(true)
          if (!isExpanded) {
            setIsExpanded(true)
            applyWindowDimensions(true)
          }
        }}
        onToggleExpand={handleToggleExpand}
        isExpanded={isExpanded}
        onSpeakMessage={text => {
          if (text) speak(text)
          else stopSpeaking()
        }}
      />

      {/* Auto-Updater Banner */}
      <AnimatePresence>
        {updateInfo?.available && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="w-full mt-1.5 p-2 bg-emerald-950/90 border border-emerald-500/40 rounded-xl shadow-xl backdrop-blur-xl flex items-center justify-between gap-2 text-xs text-emerald-100"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={13} className="text-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate text-[10px]">
                {updateInfo.isDownloading
                  ? `Mengunduh update... ${updateInfo.downloadProgress ?? 0}%`
                  : `Versi v${updateInfo.version} tersedia!`}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleInstallUpdate}
                disabled={updateInfo.isDownloading}
                className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold transition disabled:opacity-50"
              >
                {updateInfo.isDownloading ? 'Memasang...' : 'Perbarui'}
              </button>
              <button
                onClick={() => setUpdateInfo(null)}
                className="px-1 text-emerald-400/70 hover:text-white text-[10px]"
                title="Tutup pemberitahuan"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            settings={settings}
            availableVoices={voices}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            onApplyPosition={cfg => applyWindowDimensions(isExpanded, cfg)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
