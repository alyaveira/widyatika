# PANDUAN KEAMANAN CHATBOT WIDY AI - INTEGRASI GEMINI API

## 🚨 MASALAH KEAMANAN: Mengapa Tidak Boleh Hardcode API Key di Browser?

### Risiko Saat Ini (Dashboard.html)
```javascript
// ❌ BAHAYA - Jangan lakukan ini!
const GEMINI_API_KEY = 'sk-123456...'; // Terlihat di sumber HTML/Network tab
const GEMINI_URL = `https://...?key=${GEMINI_API_KEY}`;
```

**Masalah:**
1. **API Key terlihat di Network tab** - Siapa saja bisa buka DevTools F12 dan lihat key
2. **API Key bisa di-scrape dari HTML** - Bot bisa otomatis ekstrak key dari halaman
3. **Unlimited quota abuse** - Penyerang bisa menggunakan key untuk request unlimited sampai kehabisan quota
4. **Biaya tidak terduga** - Penyerang bisa membuat ribuan request → tagihan besar di Google Cloud

---

## ✅ SOLUSI: 3 Pendekatan Aman

### Solusi 1: Backend Proxy (RECOMMENDED) ⭐⭐⭐
**Konsep:** Browser NOT mengirim API key langsung. Semua request via backend.

```
┌─────────────────┐         ┌──────────────────┐         ┌───────────────────┐
│    Browser      │         │   Backend        │         │  Google Gemini    │
│  (dashboard)    │────────→│  (Node.js/API)   │────────→│      API           │
│                 │         │                  │         │                   │
│  No API key! ✓  │←────────│  API key stored! │←────────│   Response        │
└─────────────────┘         └──────────────────┘         └───────────────────┘
```

**Keuntungan:**
- ✅ API key TIDAK terlihat di browser
- ✅ Bisa limitasi rate per user
- ✅ Bisa log semua request untuk audit
- ✅ Bisa add validation/filtering

**Backend dengan Node.js + Express (untuk Vercel):**
```javascript
// api/chat.js - Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Dari .env.local atau Vercel Environment

  if (!apiKey) {
    return res.status(500).json({ error: 'API key tidak dikonfigurasi' });
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ],
      }),
    });

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons';

    res.status(200).json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

**Langkah setup di Vercel:**
1. Buat file `api/chat.js` di root proyek
2. Deploy ke Vercel
3. Di Vercel Dashboard → Settings → Environment Variables
4. Tambah: `GEMINI_API_KEY = sk-...`
5. Browser kirim request ke `https://yourproject.vercel.app/api/chat`

---

### Solusi 2: Environment Variable + Build Tool (Semi-Aman)
**Cocok jika:** Hanya frontend, tidak ada backend.

**Setup:**
1. Pakai build tool (Vite, Next.js, webpack)
2. Simpan key di `.env.local` dengan prefix `VITE_` (untuk Vite) atau `NEXT_PUBLIC_` (untuk Next.js)
3. Build tool embed key ke bundle saat build

**Contoh Vite (.env.local):**
```
VITE_GEMINI_API_KEY=sk-123456...
```

**Di code JavaScript:**
```javascript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

**Kelemahan:**
- ⚠️ Key masih terlihat di browser (di file `.js` bundle)
- ⚠️ Harus setup .gitignore dengan benar
- ⚠️ Kurang aman dibanding backend proxy

---

### Solusi 3: Google Cloud API Key + Restriction (Kurang Aman)
**Konsep:** Buat API Key dengan domain/IP restriction.

**Setup:**
1. Google Cloud Console → API Keys
2. Edit key → Application restrictions → HTTP referrers
3. Izinkan hanya domain `yourdomain.vercel.app`

**Kelemahan:**
- ⚠️ Restriction bisa di-bypass dari DevTools
- ⚠️ Masih terlihat di Network tab
- ⚠️ Hanya untuk perlindungan minimal

---

## 🚀 IMPLEMENTASI TERBAIK: Backend Proxy + Environment Variable

**Untuk Vercel Deployment:**
```
Lokal (Development):
  .env.local → GEMINI_API_KEY=sk-...
  api/chat.js membaca dari process.env.GEMINI_API_KEY

Vercel (Production):
  Environment Variables di Dashboard
  GEMINI_API_KEY = sk-...
  api/chat.js membaca dari process.env.GEMINI_API_KEY
```

**Browser (dashboard.html):**
```javascript
// ✅ AMAN - Request ke backend, bukan Gemini langsung
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userMessage, context: guru }),
});

const data = await response.json();
const aiResponse = data.response;
```

---

## 📋 CHECKLIST SETUP KEAMANAN

### Development (Lokal)
- [ ] Buat `.env.local` dengan `GEMINI_API_KEY=sk-...`
- [ ] Add `.env.local` ke `.gitignore`
- [ ] Buat file `api/chat.js` untuk backend endpoint
- [ ] Update `dashboard.html` atau `js/chatbot.js` untuk POST ke `/api/chat` (bukan langsung Gemini)
- [ ] Test di localhost → pastikan response bekerja

### Production (Vercel)
- [ ] Deploy ke Vercel (git push)
- [ ] Buka Vercel Dashboard → Project Settings
- [ ] Ke tab "Environment Variables"
- [ ] Tambah: `GEMINI_API_KEY = sk-...` (copy dari `.env.local`)
- [ ] Redeploy project
- [ ] Test di production → pastikan chatbot bekerja

---

## ⚙️ REKOMENDASI AKHIR

1. **Setup Backend Proxy** (api/chat.js) ← Paling aman
2. **Use Environment Variable di Backend** (process.env.GEMINI_API_KEY)
3. **Deploy ke Vercel** dengan Environment Variables
4. **Browser hanya kirim request ke /api/chat** (bukan Gemini langsung)
5. **Jangan pernah hardcode API key** di HTML/JavaScript

---

## 🔗 REFERENSI
- Google Gemini API Docs: https://ai.google.dev/docs
- Vercel Environment Variables: https://vercel.com/docs/concepts/environment-variables
- Node.js + Express Setup: https://expressjs.com/
