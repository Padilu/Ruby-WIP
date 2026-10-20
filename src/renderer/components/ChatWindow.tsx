import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RubyAvatar } from './RubyAvatar'
import type { RubyStatus } from './animationMap'
import type { AnimationName } from '@root/Ruby'
import type { FinancialTransaction } from '../services/llmService'
import {
  Mic,
  MicOff,
  Settings,
  Send,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Volume2,
  Sparkles,
} from 'lucide-react'

export interface MessageItem {
  id: string
  sender: 'ruby' | 'user'
  text: string
  transaction?: FinancialTransaction
  timestamp: string
}

export interface ChatWindowProps {
  status: RubyStatus
  activeAnimation: AnimationName
  isListening: boolean
  isSpeaking: boolean
  liveTranscript: string
  messages: MessageItem[]
  onToggleListen: () => void
  onSendMessage: (text: string) => void
  onOpenSettings: () => void
  onToggleExpand: (expanded: boolean) => void
  isExpanded: boolean
  onSpeakMessage?: (text: string) => void
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  status,
  activeAnimation,
  isListening,
  isSpeaking,
  liveTranscript,
  messages,
  onToggleListen,
  onSendMessage,
  onOpenSettings,
  onToggleExpand,
  isExpanded,
  onSpeakMessage,
}) => {
  const [inputText, setInputText] = useState('')
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isExpanded, liveTranscript])

  // Reset playing message indicator when speech finishes
  useEffect(() => {
    if (!isSpeaking) {
      setPlayingMessageId(null)
    }
  }, [isSpeaking])

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText)
    setInputText('')
  }

  const handleManualSpeak = (msg: MessageItem) => {
    if (playingMessageId === msg.id && isSpeaking) {
      // Toggle off
      setPlayingMessageId(null)
      onSpeakMessage?.('')
    } else {
      setPlayingMessageId(msg.id)
      onSpeakMessage?.(msg.text)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-start select-none font-sans">
      {/* 1. COMPACT NOTCH / TRAY CAPSULE BAR WITH SPRING PHYSICS & DRAG */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        drag
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={0.06}
        className={`w-full flex items-center justify-between px-3 py-1 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl relative group ${
          isListening
            ? 'ring-2 ring-red-500/60 shadow-red-500/20'
            : isSpeaking
              ? 'ring-2 ring-emerald-500/60 shadow-emerald-500/20'
              : status === 'processing'
                ? 'ring-2 ring-amber-500/60 shadow-amber-500/20'
                : 'hover:border-white/20'
        }`}
        style={{
          minHeight: '38px',
          height: isExpanded ? '46px' : '100%',
        }}
      >
        {/* Left: Avatar with interactive click */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onToggleExpand(!isExpanded)}
          title="Klik untuk buka / tutup percakapan Ruby"
        >
          <div className="w-8 h-8 flex items-center justify-center -ml-1">
            <RubyAvatar
              status={status}
              animation={activeAnimation}
              size={32}
              showStatusIndicator={true}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1">
              Ruby
              {status === 'speaking' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </span>
            <span className="text-[9px] text-slate-400 font-mono capitalize leading-none">
              {isListening
                ? 'Mendengarkan...'
                : status === 'processing'
                  ? 'Berpikir...'
                  : status === 'speaking'
                    ? 'Bicara'
                    : 'Siap'}
            </span>
          </div>
        </div>

        {/* Center: Live Wave / Transcript snippet */}
        <div
          className="flex-1 mx-2 flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={() => onToggleExpand(!isExpanded)}
        >
          {isListening ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-red-400 text-[11px] font-medium truncate"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="truncate">{liveTranscript || 'Katakan sesuatu...'}</span>
            </motion.div>
          ) : isSpeaking ? (
            <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium truncate">
              <Volume2 size={12} className="animate-bounce" />
              <span className="truncate">Ruby sedang berbicara...</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 hover:text-slate-200 transition truncate max-w-[140px]">
              {messages.length > 0 ? messages[messages.length - 1].text : 'Tanya atau catat keuangan'}
            </div>
          )}
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-1">
          {/* Mic Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleListen}
            className={`p-1.5 rounded-full transition ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={isListening ? 'Hentikan Mendengar' : 'Mulai Mendengar (Cmd/Ctrl+Shift+R)'}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </motion.button>

          {/* Expand/Collapse Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onToggleExpand(!isExpanded)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            title={isExpanded ? 'Tutup Panel' : 'Perluas Chat'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </motion.button>

          {/* Settings Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onOpenSettings}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Pengaturan"
          >
            <Settings size={14} />
          </motion.button>
        </div>
      </motion.div>

      {/* 2. EXPANDED CHAT PANEL WITH FRAMER MOTION TRANSITION */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="chat-expanded-panel"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="w-full flex-1 mt-2 bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Messages History */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 space-y-2">
                  <Sparkles size={24} className="text-emerald-400/60 animate-pulse" />
                  <p className="text-xs font-medium text-slate-300">Hai! Ada yang bisa Ruby bantu?</p>
                  <div className="text-[10px] space-y-1 text-slate-500">
                    <p>• "Catat beli makan siang 35.000"</p>
                    <p>• "Tadi bayar parkir 5 ribu"</p>
                    <p>• "Berapa kurs dollar hari ini?"</p>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl leading-relaxed text-xs ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600/90 text-white rounded-br-none shadow-md shadow-emerald-950/50 border border-emerald-500/30'
                          : 'bg-slate-900/80 text-slate-200 border border-white/10 rounded-bl-none shadow-md shadow-black/40 backdrop-blur-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Financial Transaction Badge */}
                      {msg.transaction && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <FileSpreadsheet size={12} />
                            {msg.transaction.kategori}
                          </span>
                          <span className="font-bold text-amber-300">
                            Rp {msg.transaction.nominal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata: Timestamp & Manual Audio Speaker Button */}
                    <div className="flex items-center gap-1.5 px-1 mt-0.5">
                      <span className="text-[9px] text-slate-500 font-mono">{msg.timestamp}</span>

                      {/* Manual Speaker Button for AI reply */}
                      {msg.sender === 'ruby' && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleManualSpeak(msg)}
                          title={
                            playingMessageId === msg.id && isSpeaking
                              ? 'Hentikan Suara'
                              : 'Putar Suara (TTS)'
                          }
                          className={`p-1 rounded-full transition flex items-center gap-1 ${
                            playingMessageId === msg.id && isSpeaking
                              ? 'text-emerald-400 bg-emerald-500/20'
                              : 'text-slate-500 hover:text-emerald-400 hover:bg-white/10'
                          }`}
                        >
                          <Volume2
                            size={11}
                            className={
                              playingMessageId === msg.id && isSpeaking ? 'animate-bounce' : ''
                            }
                          />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Live speech interim bubble */}
              {isListening && liveTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-end"
                >
                  <div className="max-w-[85%] px-3 py-2 rounded-xl bg-red-600/30 border border-red-500/50 text-red-200 text-xs italic animate-pulse">
                    {liveTranscript}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Input Bar */}
            <form
              onSubmit={handleSend}
              className="p-2 border-t border-white/10 bg-slate-900/60 backdrop-blur-xl flex items-center gap-1.5"
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Tulis pesan atau 'Catat kopi 25rb'..."
                className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-bold transition flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <Send size={14} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChatWindow
