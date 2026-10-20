import React, { useState } from 'react'
import { motion } from 'framer-motion'
import type { AppSettings } from '../services/storeService'
import { llmService } from '../services/llmService'
import { excelService } from '../services/excelService'
import {
  Sliders,
  Mic,
  Cpu,
  FileSpreadsheet,
  X,
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  Volume2,
} from 'lucide-react'

export interface SettingsPanelProps {
  settings: AppSettings
  availableVoices: SpeechSynthesisVoice[]
  onSave: (newSettings: AppSettings) => void
  onClose: () => void
  onApplyPosition: (config: {
    anchor: string
    preset: string
    width: number
    height: number
    offsetX: number
    offsetY: number
  }) => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings: initialSettings,
  availableVoices,
  onSave,
  onClose,
  onApplyPosition,
}) => {
  const [activeTab, setActiveTab] = useState<'position' | 'audio' | 'ai' | 'excel'>('position')
  const [current, setCurrent] = useState<AppSettings>(initialSettings)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const handleSave = () => {
    onSave(current)
    onApplyPosition({
      anchor: current.anchor,
      preset: current.preset,
      width: current.width,
      height: current.height,
      offsetX: current.offsetX,
      offsetY: current.offsetY,
    })
    onClose()
  }

  const handlePickFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      })
      if (selected && typeof selected === 'string') {
        setCurrent(prev => ({
          ...prev,
          excel: { ...prev.excel, filePath: selected },
        }))
      }
    } catch {
      // Fallback prompt
      const manual = prompt('Masukkan path file Excel (.xlsx):', current.excel.filePath)
      if (manual) {
        setCurrent(prev => ({
          ...prev,
          excel: { ...prev.excel, filePath: manual },
        }))
      }
    }
  }

  const handleTestAI = async () => {
    setIsTesting(true)
    setTestStatus('Menguji koneksi ke provider AI (hemat token)...')
    try {
      const res = await llmService.testConnection(current.llm)
      if (res.success) {
        setTestStatus(`✅ ${res.message}`)
      } else {
        setTestStatus(`❌ ${res.message}`)
      }
    } catch (err: any) {
      setTestStatus(`❌ Gagal: ${err.message || 'Koneksi error'}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleTestExcel = async () => {
    setIsTesting(true)
    setTestStatus('Mencoba menulis transaksi uji coba ke Excel...')
    try {
      const res = await excelService.appendTransaction(
        current.excel.filePath,
        current.excel.sheetName,
        {
          tanggal: new Date().toISOString().split('T')[0],
          kategori: 'Uji Coba',
          nominal: 15000,
          keterangan: 'Tes koneksi sistem Ruby',
          tipe: 'pengeluaran',
        }
      )
      if (res.success) {
        setTestStatus(`Sukses! ${res.message}`)
      } else {
        setTestStatus(`Gagal: ${res.message}`)
      }
    } catch (err: any) {
      setTestStatus(`Error: ${err.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-lg bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[92vh] backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide text-slate-200">Pengaturan Ruby AI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-3 pt-2 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('position')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
              activeTab === 'position'
                ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders size={13} />
            Posisi & Ukuran
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
              activeTab === 'audio'
                ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic size={13} />
            Audio & Suara
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
              activeTab === 'ai'
                ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={13} />
            AI Provider
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition ${
              activeTab === 'excel'
                ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet size={13} />
            Excel Keuangan
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* TAB 1: Posisi & Ukuran */}
          {activeTab === 'position' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Anchor Lokasi Overlay</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'notch', label: 'macOS Notch (Center Top)' },
                    { id: 'tray', label: 'Windows Taskbar (Bottom Right)' },
                    { id: 'top_center', label: 'Layar Atas Tengah' },
                    { id: 'custom', label: 'Posisi Kustom' },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setCurrent({ ...current, anchor: item.id as any })}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        current.anchor === item.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Preset Ukuran Overlay</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'small', label: 'Small (180x32)' },
                    { id: 'medium', label: 'Medium (240x42)' },
                    { id: 'large', label: 'Large (320x56)' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setCurrent({ ...current, preset: preset.id as any })}
                      className={`p-2 rounded-lg border text-center transition ${
                        current.preset === preset.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">Offset X (px)</label>
                  <input
                    type="number"
                    value={current.offsetX}
                    onChange={e => setCurrent({ ...current, offsetX: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Offset Y (px)</label>
                  <input
                    type="number"
                    value={current.offsetY}
                    onChange={e => setCurrent({ ...current, offsetY: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-300">Selalu di Atas (Always on Top)</span>
                <input
                  type="checkbox"
                  checked={current.alwaysOnTop}
                  onChange={e => setCurrent({ ...current, alwaysOnTop: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Audio & Suara */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Pilihan Suara TTS (id-ID)</label>
                <select
                  value={current.audio.voiceIndex}
                  onChange={e =>
                    setCurrent({
                      ...current,
                      audio: { ...current.audio, voiceIndex: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {availableVoices.length === 0 ? (
                    <option value={0}>Suara Standar Sistem</option>
                  ) : (
                    availableVoices.map((v, i) => (
                      <option key={i} value={i}>
                        {v.name} ({v.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Kecepatan Bicara ({current.audio.speechRate}x)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.1"
                    value={current.audio.speechRate}
                    onChange={e =>
                      setCurrent({
                        ...current,
                        audio: { ...current.audio, speechRate: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Pitch Suara ({current.audio.speechPitch})
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={current.audio.speechPitch}
                    onChange={e =>
                      setCurrent({
                        ...current,
                        audio: { ...current.audio, speechPitch: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Auto TTS Toggle */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-medium">Putar Suara Otomatis (Auto TTS)</div>
                    <div className="text-slate-400 text-[10px]">
                      Jika nonaktif, kamu bisa memutar suara balasan secara manual lewat icon speaker di chat
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.audio.autoTtsEnabled ?? false}
                    onChange={e =>
                      setCurrent({
                        ...current,
                        audio: { ...current.audio, autoTtsEnabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-medium">Deteksi Wake Word ("Ruby")</div>
                    <div className="text-slate-400 text-[10px]">
                      Ruby otomatis bangun saat kamu memanggil namanya
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.audio.wakeWordEnabled}
                    onChange={e =>
                      setCurrent({
                        ...current,
                        audio: { ...current.audio, wakeWordEnabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </div>

                {current.audio.wakeWordEnabled && (
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1 text-[11px]">
                      <span>Sensitivitas Wake Word</span>
                      <span>{Math.round(current.audio.wakeWordSensitivity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={current.audio.wakeWordSensitivity}
                      onChange={e =>
                        setCurrent({
                          ...current,
                          audio: {
                            ...current.audio,
                            wakeWordSensitivity: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div className="text-slate-400 text-[11px] bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                💡 Pintasan Global: Tekan <span className="text-emerald-400 font-mono">Cmd/Ctrl + Shift + R</span> kapan saja untuk mulai berbicara.
              </div>
            </div>
          )}

          {/* TAB 3: AI Provider */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Provider AI</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['openai', 'anthropic', 'gemini', 'ollama', 'custom'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() =>
                        setCurrent({
                          ...current,
                          llm: {
                            ...current.llm,
                            provider: p,
                            model:
                              p === 'openai'
                                ? 'gpt-4o-mini'
                                : p === 'anthropic'
                                  ? 'claude-3-5-haiku-20241022'
                                  : p === 'gemini'
                                    ? 'gemini-1.5-flash'
                                    : p === 'ollama'
                                      ? 'llama3:latest'
                                      : 'custom-model',
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-center uppercase tracking-wider font-semibold text-[10px] transition ${
                        current.llm.provider === p
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Model Name</label>
                <input
                  type="text"
                  value={current.llm.model}
                  onChange={e =>
                    setCurrent({
                      ...current,
                      llm: { ...current.llm, model: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="e.g. gpt-4o-mini, gemini-1.5-flash, llama3"
                />
              </div>

              {current.llm.provider !== 'ollama' && (
                <div>
                  <label className="block text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={current.llm.apiKey || ''}
                      onChange={e =>
                        setCurrent({
                          ...current,
                          llm: { ...current.llm, apiKey: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 pr-8 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Base URL (Opsional)</label>
                <input
                  type="text"
                  value={current.llm.baseUrl || ''}
                  onChange={e =>
                    setCurrent({
                      ...current,
                      llm: { ...current.llm, baseUrl: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                  placeholder={
                    current.llm.provider === 'ollama'
                      ? 'http://localhost:11434'
                      : 'https://api.openai.com/v1'
                  }
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestAI}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Cpu size={13} />
                  {isTesting ? 'Menguji...' : 'Uji Koneksi AI'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Excel Keuangan */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Path Berkas .xlsx Target</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={current.excel.filePath}
                    onChange={e =>
                      setCurrent({
                        ...current,
                        excel: { ...current.excel, filePath: e.target.value },
                      })
                    }
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                  />
                  <button
                    onClick={handlePickFile}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1"
                  >
                    <FolderOpen size={13} />
                    Pilih
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Format tabel: Tanggal (ISO 8601), Kategori, Nominal (IDR), Keterangan.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Lembar Kerja (Sheet Name)</label>
                <input
                  type="text"
                  value={current.excel.sheetName}
                  onChange={e =>
                    setCurrent({
                      ...current,
                      excel: { ...current.excel, sheetName: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="Pengeluaran"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">Auto-Kategori Otomatis via LLM</span>
                <input
                  type="checkbox"
                  checked={current.excel.autoCategorize}
                  onChange={e =>
                    setCurrent({
                      ...current,
                      excel: { ...current.excel, autoCategorize: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestExcel}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={13} />
                  {isTesting ? 'Menguji...' : 'Uji Tulis Transaksi ke Excel'}
                </button>
              </div>
            </div>
          )}

          {/* Test Status Feedback Alert */}
          {testStatus && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-emerald-400 animate-fadeIn">
              {testStatus}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Check size={14} />
            Simpan Perubahan
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default SettingsPanel
