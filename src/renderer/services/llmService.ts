/**
 * Multi-Provider LLM Service Architecture
 * Supports OpenAI, Anthropic, Google Gemini, Ollama (local), and Custom Endpoints
 */

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom'

export interface LLMConfig {
  provider: LLMProviderType
  apiKey?: string
  baseUrl?: string
  model: string
  temperature?: number
}

export interface FinancialTransaction {
  tanggal: string // ISO 8601 (YYYY-MM-DD)
  kategori: string // e.g. Makanan & Minuman, Transportasi, Tagihan, Belanja, Gaji
  nominal: number // IDR integer
  keterangan: string
  tipe: 'pengeluaran' | 'pemasukan'
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  generateChat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  extractTransaction(text: string, config: LLMConfig): Promise<FinancialTransaction | null>
}

const RUBY_SYSTEM_PROMPT = `Kamu adalah "Ruby", asisten AI desktop yang melayang ramah, cerdas, efisien, dan bersahabat.
Kamu berbicara dalam Bahasa Indonesia yang alami, santai tapi sopan, singkat dan jelas (karena kamu berada di floating overlay kecil).
Jika pengguna meminta mencatat keuangan atau belanja, responlah dengan antusias bahwa catatan sudah diproses ke Excel.
Jawablah pertanyaan secara ringkas, to the point, dan hindari jawaban bertele-tele kecuali jika diminta penjelasan mendalam.`

const FINANCIAL_EXTRACTION_PROMPT = `Tugasmu adalah menganalisis teks percakapan bahasa Indonesia dan mengekstrak transaksi keuangan ke dalam format JSON.
Tanggal saat ini adalah ${new Date().toISOString().split('T')[0]}.
Jika ada nominal seperti "28rb", "28 ribu", "28k", ubah menjadi angka bulat 28000.
Kategori standar: Makanan & Minuman, Transportasi, Tagihan & Utilitas, Belanja, Hiburan, Kesehatan, Gaji & Pendapatan, Investasi, Lain-lain.
Format JSON yang WAJIB dihasilkan:
{
  "tanggal": "YYYY-MM-DD",
  "kategori": "Nama Kategori",
  "nominal": 50000,
  "keterangan": "Rincian singkat transaksi",
  "tipe": "pengeluaran" atau "pemasukan"
}
Jika teks tersebut BUKAN transaksi keuangan atau tidak ada angka/nominal, kembalikan JSON null (kata 'null' tanpa quotes).
Kembalikan HANYA format JSON valid tanpa markdown, tanpa penjelasan pembuka/penutup.`

// 1. OpenAI Adapter
class OpenAIAdapter implements LLMAdapter {
  async generateChat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = (config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1') + '/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || ''}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [{ role: 'system', content: RUBY_SYSTEM_PROMPT }, ...messages],
        temperature: config.temperature ?? 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI Error (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.choices[0]?.message?.content || ''
  }

  async extractTransaction(text: string, config: LLMConfig): Promise<FinancialTransaction | null> {
    const url = (config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1') + '/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || ''}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: FINANCIAL_EXTRACTION_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices[0]?.message?.content?.trim()
    return parseJsonTransaction(content)
  }
}

// 2. Anthropic Adapter
class AnthropicAdapter implements LLMAdapter {
  async generateChat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = (config.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com/v1') + '/messages'
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }))

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        system: RUBY_SYSTEM_PROMPT,
        messages: anthropicMessages,
        max_tokens: 1024,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic Error (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  async extractTransaction(text: string, config: LLMConfig): Promise<FinancialTransaction | null> {
    const url = (config.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com/v1') + '/messages'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        system: FINANCIAL_EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: text }],
        max_tokens: 512,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const content = data.content?.[0]?.text?.trim()
    return parseJsonTransaction(content)
  }
}

// 3. Google Gemini Adapter
class GeminiAdapter implements LLMAdapter {
  async generateChat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const model = config.model || 'gemini-1.5-flash'
    const base = config.baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com/v1beta'
    const url = `${base}/models/${model}:generateContent?key=${config.apiKey || ''}`

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: RUBY_SYSTEM_PROMPT }] },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini Error (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  async extractTransaction(text: string, config: LLMConfig): Promise<FinancialTransaction | null> {
    const model = config.model || 'gemini-1.5-flash'
    const base = config.baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com/v1beta'
    const url = `${base}/models/${model}:generateContent?key=${config.apiKey || ''}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: text }] }],
        systemInstruction: { parts: [{ text: FINANCIAL_EXTRACTION_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return parseJsonTransaction(raw)
  }
}

// 4. Ollama Adapter (Local)
class OllamaAdapter implements LLMAdapter {
  async generateChat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const base = config.baseUrl?.replace(/\/$/, '') || 'http://localhost:11434'
    const url = `${base}/api/chat`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3:latest',
        messages: [{ role: 'system', content: RUBY_SYSTEM_PROMPT }, ...messages],
        stream: false,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Ollama Error (${res.status}): ${err}`)
    }

    const data = await res.json()
    return data.message?.content || ''
  }

  async extractTransaction(text: string, config: LLMConfig): Promise<FinancialTransaction | null> {
    const base = config.baseUrl?.replace(/\/$/, '') || 'http://localhost:11434'
    const url = `${base}/api/chat`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3:latest',
        messages: [
          { role: 'system', content: FINANCIAL_EXTRACTION_PROMPT },
          { role: 'user', content: text },
        ],
        format: 'json',
        stream: false,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return parseJsonTransaction(data.message?.content)
  }
}

// 5. Custom OpenAI-compatible Adapter
class CustomEndpointAdapter extends OpenAIAdapter {}

function parseJsonTransaction(raw: string | undefined): FinancialTransaction | null {
  if (!raw || raw === 'null') return null
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.nominal || typeof parsed.nominal !== 'number') return null
    return {
      tanggal: parsed.tanggal || new Date().toISOString().split('T')[0],
      kategori: parsed.kategori || 'Pengeluaran Umum',
      nominal: Math.round(parsed.nominal),
      keterangan: parsed.keterangan || 'Catatan transaksi',
      tipe: parsed.tipe === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
    }
  } catch {
    return null
  }
}

export class LLMService {
  private adapters: Record<LLMProviderType, LLMAdapter> = {
    openai: new OpenAIAdapter(),
    anthropic: new AnthropicAdapter(),
    gemini: new GeminiAdapter(),
    ollama: new OllamaAdapter(),
    custom: new CustomEndpointAdapter(),
  }

  public async chat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    // If no API key and not Ollama, provide intelligent offline companion response
    if (config.provider !== 'ollama' && (!config.apiKey || config.apiKey.trim() === '')) {
      const lastUser = messages.filter(m => m.role === 'user').pop()?.content || ''
      return this.offlineFallbackResponse(lastUser)
    }

    const adapter = this.adapters[config.provider] || this.adapters.openai
    return adapter.generateChat(messages, config)
  }

  public async extractFinancialTransaction(
    text: string,
    config: LLMConfig
  ): Promise<FinancialTransaction | null> {
    // If offline fallback mode, handle common financial patterns gracefully
    if (config.provider !== 'ollama' && (!config.apiKey || config.apiKey.trim() === '')) {
      return this.fallbackRegexExtraction(text)
    }

    const adapter = this.adapters[config.provider] || this.adapters.openai
    return adapter.extractTransaction(text, config)
  }

  private offlineFallbackResponse(query: string): string {
    const q = query.toLowerCase()
    if (q.includes('halo') || q.includes('hai')) {
      return 'Halo! Aku Ruby, siap membantu kamu di desktop!'
    }
    if (q.includes('siapa kamu')) {
      return 'Aku Ruby, AI Assistant melayang untuk macOS Notch & Windows Tray.'
    }
    if (q.includes('catat') || q.includes('beli') || q.includes('bayar')) {
      return 'Siap! Aku bisa mencatat transaksi langsung ke Excel. Masukkan API Key di Pengaturan agar aku bisa mengekstrak data otomatis!'
    }
    return `Aku menerima pesanmu: "${query}". Untuk percakapan penuh AI, silakan konfigurasikan API Key di menu Pengaturan ya!`
  }

  private fallbackRegexExtraction(text: string): FinancialTransaction | null {
    // Fallback extraction when user hasn't configured an LLM API key yet
    const nominalMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k|juta|jt)?/i)
    if (!nominalMatch) return null

    let rawNum = parseFloat(nominalMatch[1].replace(/,/g, ''))
    const lower = text.toLowerCase()
    if (lower.includes('jt') || lower.includes('juta')) rawNum *= 1000000
    else if (lower.includes('rb') || lower.includes('ribu') || lower.includes('k')) rawNum *= 1000

    return {
      tanggal: new Date().toISOString().split('T')[0],
      kategori: lower.includes('kopi') || lower.includes('makan') ? 'Makanan & Minuman' : 'Pengeluaran',
      nominal: Math.round(rawNum),
      keterangan: text,
      tipe: lower.includes('gaji') || lower.includes('masuk') ? 'pemasukan' : 'pengeluaran',
    }
  }
}

export const llmService = new LLMService()
