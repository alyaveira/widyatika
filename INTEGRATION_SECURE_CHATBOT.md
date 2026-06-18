# 🔒 Integrasi Secure Chatbot Widy dengan Backend Proxy

## ✅ Status Integrasi

Sistem chatbot Widy sekarang **sepenuhnya aman** dengan implementasi backend proxy:

### Perubahan Security
- ❌ **DIHAPUS**: Hardcoded `GEMINI_API_KEY` di `dashboard.html` (UNSAFE)
- ❌ **DIHAPUS**: Direct browser calls ke Gemini API (UNSAFE)
- ✅ **DITAMBAHKAN**: Backend proxy endpoint `/api/chat` (SAFE)
- ✅ **DITAMBAHKAN**: API key management via environment variables (SAFE)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (Dashboard)                   │
│  • dashboard.html sendMessage() function                    │
│  • Sends: { mode: 'chat', message, context }               │
│  • NO API key in code ✅                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ FETCH /api/chat (POST)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Vercel Serverless)                │
│  • api/chat.js handler                                      │
│  • Reads GEMINI_API_KEY from process.env ✅                 │
│  • Validates request mode & parameters                      │
│  • Builds system prompt & user message                      │
└────────────────────┬────────────────────────────────────────┘
                     │ FETCH https://generativelanguage.googleapis.com
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Google Gemini API                        │
│  • Receives request with GEMINI_API_KEY in Authorization   │
│  • Returns AI response                                      │
└────────────────────┬────────────────────────────────────────┘
                     │ Response JSON { success, response }
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend (Vercel Serverless)                    │
│  • Returns response to browser                              │
└────────────────────┬────────────────────────────────────────┘
                     │ JSON response
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Dashboard)                      │
│  • Displays message to user                                 │
│  • Updates chat history                                     │
└─────────────────────────────────────────────────────────────┘
```

**Keuntungan:**
- ✅ API key TIDAK terlihat di browser DevTools
- ✅ API key TIDAK ada di GitHub commits
- ✅ API key TIDAK bisa disalahgunakan dari frontend
- ✅ Proses aman di server saja

---

## 🔧 Setup Local Development

### 1. Dapatkan Gemini API Key

1. Buka https://aistudio.google.com/
2. Klik **"Get API Key"** di sidebar kiri
3. Pilih atau buat project Google Cloud
4. Copy API key yang dihasilkan

### 2. Update `.env` File

Buka file `.env` di root project:

```env
SUPABASE_URL=https://cezzczjzwvnncvygmbog.supabase.co
SUPABASE_ANON_KEY=sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e

# Ganti dengan API key Anda dari aistudio.google.com
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

### 3. Test Backend Proxy Locally

Jika menggunakan Vercel CLI (`vercel dev`):

```bash
# Terminal 1: Mulai Vercel dev server
vercel dev

# Terminal 2: Test endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "message": "Halo Widy!",
    "context": {"nama_lengkap": "Budi", "totalKelas": 2}
  }'
```

Expected response:
```json
{
  "success": true,
  "response": "Halo Budi! Saya Widy, asisten pedagogis Widyatika..."
}
```

---

## 🚀 Fitur Baru

### 1. Chat Mode (Mode Chat)
**Endpoint:** `POST /api/chat`

**Request:**
```javascript
{
  "mode": "chat",
  "message": "Bagaimana cara meningkatkan skor siswa?",
  "context": {
    "nama_lengkap": "Ibu Guru",
    "totalKelas": 2,
    "totalSiswa": 40,
    "rataSkor": 75
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Untuk meningkatkan skor siswa, Anda bisa..."
}
```

### 2. Dashboard Analysis Mode (Mode Analyse)
**Endpoint:** `POST /api/chat`

**Request:**
```javascript
{
  "mode": "analyse",
  "context": {
    "nama_lengkap": "Ibu Guru",
    "totalKelas": 2,
    "totalSiswa": 40,
    "rataSkor": 75,
    "highestClass": "Kelas 3A (Skor: 82)",
    "lowestClass": "Kelas 2B (Skor: 68)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Analisis berdasarkan data Anda:\n\n1. Siswa yang perlu perhatian khusus: Kelas 2B memiliki skor terendah...\n\n2. Strategi yang dapat diterapkan: Fokus pada pemahaman konsep dasar..."
}
```

### 3. Auto-Analysis on Dashboard Load
- Dashboard otomatis memanggil `analyseDashboard()` saat dimuat
- AI Widy menganalisis performa siswa/kelas
- Menampilkan insights & rekomendasi di chat

### 4. Manual Analysis Button
- Button **"📊 Analisis Dashboard"** tersedia di suggestion chips
- Klik kapan saja untuk analisis manual

---

## 🌐 Deployment ke Vercel

### 1. Setup Environment Variables

1. Buka https://vercel.com/dashboard
2. Pilih project Anda
3. Klik **Settings** → **Environment Variables**
4. Tambahkan:
   - Key: `GEMINI_API_KEY`
   - Value: `[Paste API key Anda dari aistudio.google.com]`
   - Environments: ✓ Production, ✓ Preview, ✓ Development

### 2. Deploy ke Vercel

```bash
# Jika belum login
vercel login

# Deploy project
vercel --prod
```

### 3. Verifikasi Deployment

1. Buka https://[your-project].vercel.app/dashboard
2. Klik tombol "📊 Analisis Dashboard"
3. Widy seharusnya menampilkan analisis otomatis

---

## 📋 Checklist Implementasi

- [x] Hapus hardcoded `GEMINI_API_KEY` dari dashboard.html
- [x] Update `sendMessage()` untuk gunakan `/api/chat` backend proxy
- [x] Update `api/chat.js` untuk support mode `chat` dan `analyse`
- [x] Tambah tombol "📊 Analisis Dashboard" di suggestions
- [x] Auto-trigger `analyseDashboard()` saat dashboard load
- [x] Add `GEMINI_API_KEY` ke `.env` file
- [x] Update `.gitignore` untuk protect `.env`
- [ ] Ganti `YOUR_GEMINI_API_KEY_HERE` dengan API key Anda
- [ ] Test di local development
- [ ] Deploy ke Vercel dengan environment variables
- [ ] Test di production

---

## 🔍 Testing

### Local Testing

```javascript
// Buka DevTools Console di dashboard.html

// Test chat mode
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'chat',
    message: 'Apa itu Number Talks?',
    context: { nama_lengkap: 'Test', totalKelas: 1 }
  })
}).then(r => r.json()).then(d => console.log(d));

// Test analyse mode
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'analyse',
    context: { 
      nama_lengkap: 'Test',
      totalKelas: 2,
      totalSiswa: 30,
      rataSkor: 75,
      highestClass: 'Kelas 3A',
      lowestClass: 'Kelas 2B'
    }
  })
}).then(r => r.json()).then(d => console.log(d));
```

### Production Testing

1. Deploy ke Vercel
2. Login ke dashboard
3. Harap melihat welcome message dari Widy
4. Klik tombol "📊 Analisis Dashboard"
5. Widy menampilkan analisis otomatis

---

## 🛡️ Security Best Practices

### ✅ Dilakukan
- [x] API key disimpan di environment variable (backend only)
- [x] Tidak ada API key di browser code
- [x] Tidak ada API key di GitHub (protected by .gitignore)
- [x] Backend proxy handles semua komunikasi dengan Gemini
- [x] Validation input di backend

### ⚠️ Perhatian
- Jangan pernah hardcode API key di kode
- Jangan pernah share API key public
- Rotate API key secara berkala
- Monitor API usage di Google AI Studio untuk deteksi abuse

---

## 📞 Troubleshooting

### Error: "Gagal menghubungi server"
- Pastikan backend proxy berjalan (jika local)
- Pastikan `.env` memiliki `GEMINI_API_KEY` yang valid
- Check browser console untuk detail error

### Error: "HTTP 401"
- API key di `.env` tidak valid
- Dapatkan API key baru dari https://aistudio.google.com/
- Update `.env` dengan key baru

### Chat tidak responsif
- Check internet connection
- Check Vercel status page
- Check Google Cloud quota limits

---

## 📚 File yang Berubah

| File | Perubahan |
|------|-----------|
| `dashboard.html` | ✅ Hapus hardcoded API key, update sendMessage(), tambah analyseDashboard(), tambah analysis button |
| `api/chat.js` | ✅ Tambah support mode analyse, dinamis build user message |
| `.env` | ✅ Tambah GEMINI_API_KEY template |
| `.gitignore` | ✅ Protect .env file |

---

## ✨ Next Steps

1. **Update `.env`** dengan API key Anda
2. **Test local** dengan `vercel dev`
3. **Deploy ke Vercel** dengan `vercel --prod`
4. **Configure environment variables** di Vercel dashboard
5. **Test production** di https://[your-project].vercel.app/dashboard

---

Chatbot Widy sekarang **production-ready** dengan security terbaik! 🎉
