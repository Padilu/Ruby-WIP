# CONTEXT.md — Status Proyek Ruby AI Assistant

Dokumen ini merangkum seluruh status proyek, arsitektur teknis, struktur berkas yang telah dibangun, serta *master prompt* spesifikasi implementasi untuk AI Assistant desktop **"Ruby"**.

---

## 1. Ringkasan Status Proyek

- **Nama Aplikasi**: Ruby AI Assistant
- **Bentuk Aplikasi**: Desktop floating overlay (anchored pada macOS Notch & Windows System Tray / Taskbar).
- **Status Build**: ✅ **Production-Ready & Error-Free** (`tsc && vite build` sukses dengan kode keluar `0`).
- **Framework & Backend**:
  - **Tauri v2** (`src-tauri/`): Rust backend dengan dukungan multi-platform (macOS 12+ Apple Silicon/Intel & Windows 10+).
  - **Frontend**: React 18, TypeScript, Vite, Tailwind CSS via `pnpm`.
- **Integrasi Avatar**: Menggunakan 4 berkas avatar 3D procedural SVG eksisting di root (`avatar-runtime.ts`, `ruby.avatar.ts`, `ruby.index.ts`, `Ruby.tsx`) dengan 23 ekspresi/pose animasi.
- **Audio & Percakapan**: Web Speech API (`id-ID`) untuk STT dan TTS, Wake Word spotter "Ruby", dan global shortcut `Cmd/Ctrl + Shift + R`.
- **Keuangan & Excel**: `exceljs` untuk append transaksi keuangan otomatis tanpa merusak formula, font style, dan merged cells.
- **AI Engine**: Provider-agnostic adapter (`llmService.ts`) mendukung OpenAI, Anthropic Claude, Google Gemini, Ollama (local), dan Custom Endpoints.
- **Penyimpanan State**: `tauri-plugin-store` dengan fallback `localStorage` untuk penyimpanan pengaturan dan API Key.

---

## 2. Struktur Berkas Lengkap

```text
D:\Ruby\
├── avatar-runtime.ts                    # Procedural 3D SVG engine internal Ruby
├── ruby.avatar.ts                       # Definisi 23 animasi & morfologi Ruby
├── ruby.index.ts                        # Re-export komponen avatar & tipe
├── Ruby.tsx                             # Komponen utama React avatar
├── package.json                         # Dependensi (React 18, Tauri v2 plugins, ExcelJS, Tailwind, Lucide)
├── tsconfig.json                        # Konfigurasi TypeScript & path alias (@/*, @root/*)
├── vite.config.ts                       # Konfigurasi Vite & Tauri v2 port
├── index.html                           # Entry HTML transparan untuk window overlay
├── tailwind.config.js                   # Konfigurasi utility Tailwind CSS
├── postcss.config.js                    # PostCSS processor (Tailwind & Autoprefixer)
├── CONTEXT.md                           # Dokumentasi status & ringkasan proyek
├── src-tauri/
│   ├── Cargo.toml                       # Dependensi Rust backend Tauri v2, Win32 & Cocoa
│   ├── build.rs                         # Build script Tauri v2
│   ├── tauri.conf.json                  # Konfigurasi window overlay (frameless, transparent, alwaysOnTop)
│   └── src/
│       ├── main.rs                      # Setup Tauri builder, plugins, & IPC command handlers
│       ├── notch.rs                     # Deteksi safeAreaInsets macOS Notch & Work Area Taskbar Windows
│       ├── tray.rs                      # System Tray builder & context menu
│       └── shortcuts.rs                 # Registrasi shortcut global (Cmd/Ctrl + Shift + R)
└── src/
    └── renderer/
        ├── index.tsx                    # React 18 createRoot entry point
        ├── App.tsx                      # Orkestrator utama Ruby (Avatar, Audio, LLM, Excel, Windowing)
        ├── styles/
        │   └── index.css                # Style sheet & animasi halo status indicator
        ├── components/
        │   ├── RubyAvatar.tsx           # Wrapper komponen <Ruby /> dengan visual status border ring
        │   ├── animationMap.ts          # Pemetaan 23 animasi ke 4 status & 6 emotion trigger
        │   ├── ChatWindow.tsx           # Floating notch capsule & expandable chat window
        │   └── SettingsPanel.tsx        # UI modal Pengaturan 4 Tab (Posisi, Audio, AI, Excel)
        ├── hooks/
        │   ├── useRubyController.ts     # State machine avatar (status, rotasi pool, emotion crossfade)
        │   └── useRubyAudio.ts          # Integrasi STT (id-ID), TTS multi-voice, hotkey, wake word
        └── services/
            ├── excelService.ts          # Operasi berkas Excel (.xlsx) menjaga formula & merged cells
            ├── llmService.ts            # Adapter pattern untuk OpenAI, Anthropic, Gemini, Ollama, Custom
            ├── wakeWordService.ts       # Deteksi kata kunci bangun "Ruby" dengan sensitivity slider
            └── storeService.ts          # Persistence tauri-plugin-store dengan fallback localStorage
```

---

## 3. Rincian Modul & Fitur yang Selesai

### Modul 1: Native Windowing & OS (`src-tauri/`)
- **macOS Notch:** Menggunakan Cocoa/AppKit untuk query `NSScreen.safeAreaInsets.top > 0.0`. Bila notch terdeteksi, window diposisikan presisi di center atas layar (`x = (screen_w - win_w)/2`, `y = 0`). Memiliki window level `NSFloatingWindowLevel` dan atribut `NSWindowCollectionBehaviorCanJoinAllSpaces`.
- **Windows Taskbar:** Membaca work area via Win32 API (`SPI_GETWORKAREA`) dan memposisikan window di kanan bawah di atas taskbar.
- **Preset Ukuran & Custom:** Small (180x32), Medium (240x42), Large (320x56), Expanded (360x480) dengan dukungan kustom koordinat offset.

### Modul 2: Avatar Ruby Controller (`src/renderer/components/` & `hooks/`)
- Mengontrol 23 pose/animasi dari [`Ruby.tsx`](file:///d:/Ruby/Ruby.tsx):
  - **Rotasi Status:**
    - `idle` (8s): `['idle', 'bored', 'drowsy', 'curious']`
    - `listening`: pose statis `'listening'`
    - `processing` (1.5s): `['thinking', 'searching', 'working', 'confused']`
    - `speaking` (0.8s): `['happy', 'excited', 'playful', 'laughing']`
  - **Emotion Triggers (One-Shot):**
    - `wakeWordDetected` $\rightarrow$ `'surprised'`
    - `excelSuccess` $\rightarrow$ `'celebrate'`
    - `error` $\rightarrow$ `'sad'`
    - `compliment` $\rightarrow$ `'shy'`
    - `greeting` $\rightarrow$ `'waking'`
    - `idleLong` $\rightarrow$ `'sleeping'` (setelah 60 detik tidak ada aktivitas)

### Modul 3: Audio & Speech Engine (`src/renderer/hooks/useRubyAudio.ts`)
- **STT:** `webkitSpeechRecognition` bahasa Indonesia (`id-ID`) dengan streaming interim transcript.
- **TTS:** `SpeechSynthesisUtterance` dengan pencarian otomatis suara berbahasa Indonesia, pengatur kecepatan bicara dan pitch.
- **Triggers:**
  - Global hotkey `Cmd/Ctrl + Shift + R` via `tauri-plugin-global-shortcut`.
  - Tombol mikrofon UI.
  - Wake word "Ruby" via audio stream analyzer dengan slider sensitivitas (10% - 100%).

### Modul 4: Laporan Keuangan Excel (`src/renderer/services/excelService.ts`)
- Menggunakan pustaka `exceljs`.
- Kolom tabel: **Tanggal (ISO 8601)**, **Kategori**, **Nominal (IDR #,##0)**, dan **Keterangan**.
- Menjaga seluruh formula eksisting, format sel, font, dan area merged cells.
- Menangani proteksi file lock / `EBUSY` jika file sedang dibuka pengguna di software lain.

### Modul 5: Multi-Provider LLM (`src/renderer/services/llmService.ts`)
- Pola arsitektur `LLMAdapter` yang mencakup:
  - **OpenAI** (`gpt-4o-mini`, dll.)
  - **Anthropic** (`claude-3-5-haiku`, `claude-3-5-sonnet`)
  - **Google Gemini** (`gemini-1.5-flash`, dll.)
  - **Ollama** (Lokal `http://localhost:11434`)
  - **Custom Endpoint** (OpenAI-compatible REST API)
- Ekstraksi transaksi otomatis dari teks percakapan bebas ke JSON terstruktur.
- Mode fallback offline cerdas saat API key belum dikonfigurasi.

### Modul 6: Pengaturan & UI Overlay (`src/renderer/components/SettingsPanel.tsx`)
- Panel modal dengan 4 tab:
  1. **Posisi & Ukuran**: Preset, anchor, offset koordinat, dan toggle always-on-top.
  2. **Audio & Suara**: Selector suara TTS, slider speed & pitch, toggle & sensitivitas wake word.
  3. **AI Provider**: Pilihan provider, input API Key dengan show/hide, Base URL, nama model, dan tombol uji koneksi.
  4. **Excel Keuangan**: File path picker, nama target sheet, auto-categorize toggle, dan tombol uji tulis transaksi.

---

## 4. Master Prompt Terakhir (Spesifikasi Asli)

Di bawah ini adalah teks *master prompt* spesifikasi yang digunakan sebagai acuan pengembangan fondasi proyek ini:

```markdown
[ROLE & PURPOSE]
Kamu adalah Senior Full-Stack Architect & Developer spesialis Tauri v2, Rust, React 18, TypeScript, dan Three.js.
Tugas utama: Bangun fondasi kode produksi yang lengkap dan bebas error untuk AI Assistant bernama "Ruby" — aplikasi desktop melayang (overlay) yang menempel di Notch macOS dan System Tray Windows.

[STACK TEKNIS & KETENTUAN MUTLAK]
- Framework: Tauri v2 (Rust backend) + React 18 / TypeScript / Vite via `pnpm`. (BUKAN Electron).
- OS Target: macOS 12+ (Apple Silicon & Intel) dan Windows 10+.
- Component Avatar: Manfaatkan 4 berkas avatar eksisting yang berada di root folder (`avatar-runtime.ts`, `ruby.avatar.ts`, `ruby.index.ts`, `Ruby.tsx`). Komponen `<Ruby />` mengontrol 23 pose/animasi avatar.
- Audio: Web Speech API (`id-ID`) untuk STT & TTS. Wake word "Ruby" opsional via Porcupine/openWakeWord.
- Excel: `exceljs` untuk membaca/menulis `.xlsx` (Wajib menjaga formula, cell style, dan merged cells).
- LLM Provider: Provider-agnostic adapter pendukung OpenAI, Anthropic, Gemini, Ollama (lokal), dan Custom Endpoint.
- State Persistence: Konfigurasi dan API Key disimpan terenkripsi via `tauri-plugin-store`.

[DESKRIPSI ARSITEKTUR & MODUL]

1. MODUL 1: Native Windowing & OS (Notch macOS & Taskbar Windows)
   - macOS Notch: Deteksi `NSScreen.safeAreaInsets.top > 0` di Rust (`src-tauri/src/notch.rs`), posisikan window di x = center, y = 0. Jika tanpa notch, fallback ke top-center.
   - Windows Taskbar: Posisikan di kanan bawah (screen_w - window_w - 8, screen_h - taskbar_h - window_h - 8).
   - Window Properties: Frameless, transparent, alwaysOnTop, skipTaskbar (Windows), NSFloatingWindowLevel + CanJoinAllSpaces (macOS).
   - Position Override: Dukung preset (Small 180x32, Medium 240x42, Large 320x56) dan Custom Offset via Settings.

2. MODUL 2: Integrasi Avatar Ruby Eksisting (`src/renderer/components/RubyAvatar.tsx`)
   - Impor komponen `<Ruby />` dan runtime avatar dari root (`/Ruby.tsx`, `/ruby.avatar.ts`, `/ruby.index.ts`, `/avatar-runtime.ts`).
   - Prop status: 'idle' | 'listening' | 'processing' | 'speaking'.
   - Pemetaan Animasi / Pose pada runtime Ruby:
     * idle (rotasi 8s): primary 'idle' -> ['idle', 'bored', 'drowsy', 'curious']
     * listening: 'listening'
     * processing (rotasi 1.5s): primary 'thinking' -> ['thinking', 'searching', 'working', 'confused']
     * speaking (rotasi 0.8s): primary 'happy' -> ['happy', 'excited', 'playful', 'laughing']
   - Emotion Triggers (one-shot 400ms crossfade): wakeWordDetected ('surprised'), excelSuccess ('celebrate'), error ('sad'), compliment ('shy'), greeting ('waking'), idleLong ('sleeping').

3. MODUL 3: Audio (STT, TTS, Wake Word & Hotkey)
   - STT & TTS: Integrasi `webkitSpeechRecognition` dan `SpeechSynthesisUtterance` (`id-ID`).
   - Trigger Listening:
     1. Global Hotkey (`Cmd/Ctrl + Shift + R`) via `tauri-plugin-global-shortcut`.
     2. Tombol Mic UI.
     3. Wake Word "Ruby" via `wakeWordService.ts` (opsional dengan sensitivity slider).

4. MODUL 4: Laporan Keuangan Excel (`excelService.ts`)
   - Membaca & menambah baris baru di sheet target `.xlsx` milik user.
   - Kolom: Tanggal (ISO 8601), Kategori, Nominal (IDR integer), Keterangan.
   - Ekstraksi data dari teks percakapan menggunakan `llmService` (bukan regex).
   - Tangani error jika file sedang dibuka oleh pengguna.

5. MODUL 5: Multi-Provider LLM (`llmService.ts`)
   - Arsitektur Adapter interface `LLMAdapter` untuk OpenAI, Anthropic, Gemini, Ollama (localhost:11434), dan Custom Endpoint.
   - Menangani 2 kasus penggunaan: Chat completion respons Ruby & Ekstraksi JSON transaksi keuangan.

6. MODUL 6: Pengaturan UI (`SettingsPanel.tsx`)
   - Tab Posisi & Ukuran, Tab Audio (mic, voice ID, wake word), Tab AI Provider (API key, base URL, model), Tab Excel (path picker & sheet name).

[STRUKTUR DIREKTORI PROYEK]
ruby-assistant/
├── avatar-runtime.ts           # Runtime internal avatar Ruby
├── ruby.avatar.ts              # Definisi & konfigurasi avatar
├── ruby.index.ts               # Entry/export avatar
├── Ruby.tsx                    # Komponen utama avatar React
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── notch.rs
│       ├── tray.rs
│       └── shortcuts.rs
└── src/
    ├── renderer/
    │   ├── index.tsx
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── RubyAvatar.tsx  # Wrapper yang memanggil <Ruby /> dari root
    │   │   ├── animationMap.ts
    │   │   ├── ChatWindow.tsx
    │   │   └── SettingsPanel.tsx
    │   ├── hooks/
    │   │   ├── useRubyController.ts
    │   │   └── useRubyAudio.ts
    │   └── services/
    │       ├── excelService.ts
    │       ├── llmService.ts
    │       └── wakeWordService.ts

[ALUR EKSEKUSI]
Gunakan komponen `<Ruby />` dari file eksisting di root (`/Ruby.tsx`), lalu hubungkan dengan `useRubyController` untuk mengubah pose animasi sesuai status percakapan. Hasilkan seluruh struktur berkas dan implementasi kode lengkap (production-ready tanpa skrip terpotong).
```
