# ⚡ Quick Start: Chatbot Secure & Dashboard Analysis

## 🎯 Apa yang Berhasil Diimplementasikan?

### ✅ Security Fix
```
BEFORE (❌ UNSAFE):
  dashboard.html → hardcoded GEMINI_API_KEY → Gemini API
  Problem: API key terlihat di DevTools, bisa dicuri

AFTER (✅ SAFE):
  dashboard.html → /api/chat backend → Gemini API
  Security: API key tersimpan aman di backend environment variable
```

### ✅ New Features
1. **Dashboard Auto-Analysis** 📊
   - Saat dashboard load, Widy otomatis menganalisis performa siswa
   - Menampilkan insights & rekomendasi di chat

2. **Manual Analysis Button** 🔍
   - Button "📊 Analisis Dashboard" di suggestion chips
   - Klik kapan saja untuk analisis ulang

3. **Two Operating Modes**
   - `chat mode`: User berbicara dengan Widy, Widy menjawab
   - `analyse mode`: Widy menganalisis data dashboard

---

## 🚀 Cara Testing (3 Langkah Mudah)

### Step 1: Update `.env`
```bash
# Buka file: .env
# Ganti:
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Dengan API key Anda dari:
# https://aistudio.google.com/
```

**Cara dapatkan API key:**
1. Buka https://aistudio.google.com/
2. Klik "Get API Key" di sidebar
3. Pilih atau buat project
4. Copy & paste API key ke `.env`

### Step 2: Test Locally (Optional)
```bash
# Terminal 1: Jalankan local dev server
vercel dev

# Terminal 2: Test endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "analyse",
    "context": {
      "nama_lengkap": "Ibu Guru",
      "totalKelas": 2,
      "totalSiswa": 30,
      "rataSkor": 75
    }
  }'

# Expected: Widy memberikan analisis performa siswa
```

### Step 3: Deploy & Test Production
```bash
# 1. Add GEMINI_API_KEY ke Vercel
#    - https://vercel.com/dashboard
#    - Project Settings → Environment Variables
#    - Add GEMINI_API_KEY = [API key Anda]

# 2. Deploy
git push origin main
# Vercel auto-deploy

# 3. Test
# - Buka https://[project].vercel.app/dashboard
# - Login sebagai guru
# - Lihat auto-analysis muncul di chat
# - Klik "📊 Analisis Dashboard" untuk test manual
```

---

## 📊 Architecture Overview

```
┌──────────────────────────────────────┐
│   Dashboard (Guru login)             │
│  "📊 Analisis Dashboard" button      │
└────────────┬─────────────────────────┘
             │ click()
             ↓
┌──────────────────────────────────────┐
│   analyseDashboard() function        │
│   - Collect dashboard stats          │
│   - Send to /api/chat (mode=analyse) │
└────────────┬─────────────────────────┘
             │ fetch('/api/chat')
             ↓
┌──────────────────────────────────────┐
│   Backend (Vercel /api/chat.js)      │
│   - Parse mode='analyse'             │
│   - Build analysis prompt            │
│   - Read GEMINI_API_KEY from env ✅  │
│   - Call Gemini API                  │
└────────────┬─────────────────────────┘
             │ https://generativelanguage.googleapis.com
             ↓
┌──────────────────────────────────────┐
│   Google Gemini API                  │
│   - Process request                  │
│   - Generate insights & recommendations
│   - Return response                  │
└────────────┬─────────────────────────┘
             │ JSON response
             ↓
┌──────────────────────────────────────┐
│   Backend (Vercel /api/chat.js)      │
│   - Extract AI response              │
│   - Return to browser                │
└────────────┬─────────────────────────┘
             │ { success: true, response: "..." }
             ↓
┌──────────────────────────────────────┐
│   Dashboard (Browser)                │
│   - Display: "📊 Analisis Dashboard:" │
│   - Show AI insights                 │
│   - Add to chat history              │
└──────────────────────────────────────┘
```

**Key Point:** ✅ API key HANYA ada di backend, TIDAK di browser!

---

## 🔍 Testing Endpoints

### Test 1: Chat Mode
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "message": "Bagaimana cara meningkatkan skor siswa yang rendah?",
    "context": {
      "nama_lengkap": "Ibu Ani",
      "totalKelas": 2,
      "totalSiswa": 40,
      "rataSkor": 75
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "response": "Untuk meningkatkan skor siswa yang rendah, Anda bisa..."
}
```

### Test 2: Analysis Mode
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "analyse",
    "context": {
      "nama_lengkap": "Ibu Ani",
      "totalKelas": 2,
      "totalSiswa": 40,
      "rataSkor": 75,
      "highestClass": "Kelas 3A (Skor: 82)",
      "lowestClass": "Kelas 2B (Skor: 68)"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "response": "Analisis performa kelas Anda:\n\n1. Siswa yang perlu perhatian: Kelas 2B memiliki skor terendah...\n\n2. Strategi yang dapat diterapkan: Fokus pada pemahaman konsep dasar...\n\n3. Rekomendasi: Terapkan Number Talks lebih intensif..."
}
```

---

## 📝 What Changed?

### Files Updated
1. **api/chat.js** ← Backend proxy
   - Added `mode` parameter support
   - Added dynamic prompt building
   - Support `analyse` mode

2. **dashboard.html** ← Frontend UI
   - Removed hardcoded `GEMINI_API_KEY`
   - Updated `sendMessage()` function
   - Added `analyseDashboard()` function
   - Added "📊 Analisis Dashboard" button
   - Auto-trigger analysis on load

3. **.env** ← Configuration
   - Added `GEMINI_API_KEY` template

4. **Documentation**
   - INTEGRATION_SECURE_CHATBOT.md
   - DEPLOYMENT_CHECKLIST.md

### No Changes Needed
- ✅ Supabase config (already working)
- ✅ Student/class management (already working)
- ✅ Game logic (already working)

---

## ✨ User Experience Flow

### Before (Hardcoded API)
```
User clicks "Analisis Dashboard"
  ↓
browser tries to call Gemini directly
  ↓
❌ "YOUR_GEMINI_API_KEY_HERE" error or
❌ API key exposed in Network tab or
❌ CORS error
```

### After (Backend Proxy) ✅
```
User clicks "📊 Analisis Dashboard"
  ↓
Browser sends: fetch('/api/chat', { mode: 'analyse', context: {...} })
  ↓
Backend validates & processes securely
  ↓
Backend calls Gemini with SAFE API key
  ↓
Backend returns: { success: true, response: "📊 Analisis Dashboard:\n\n..." }
  ↓
✅ Chat shows: "📊 **Analisis Dashboard:**\n\nKelas 3A memiliki performa terbaik..."
✅ User mendapat insights
✅ API key tetap AMAN di server
```

---

## 🔐 Security Guarantees

✅ **API Key Not in Browser**
- DevTools Console → NO API KEY
- Network tab → NO API KEY in requests
- Page Source → NO API KEY

✅ **API Key Not in GitHub**
- .env protected by .gitignore
- No hardcoded secrets in code

✅ **Backend-Only Secrets**
- GEMINI_API_KEY stored as Vercel environment variable
- Only backend can access

✅ **Safe Communication**
- HTTPS encrypted
- Backend proxy validates all inputs
- No direct Gemini API calls from browser

---

## 🎓 Learning Points

1. **Backend Proxy Pattern**
   - Frontend sends data to backend
   - Backend handles sensitive operations
   - Backend returns results

2. **Environment Variables**
   - .env for local dev
   - Vercel dashboard for production
   - .gitignore protects secrets

3. **API Integration**
   - Modes support flexibility
   - Context helps AI understand user data
   - Error handling improves UX

---

## ❓ FAQ

**Q: Kenapa perlu backend proxy?**
A: Untuk menjaga API key tetap rahasia. Jika API key di frontend, bisa dicuri dari DevTools.

**Q: Bagaimana cara mendapatkan API key?**
A: Buka https://aistudio.google.com/ → Get API Key → Follow Google steps

**Q: Apakah harus menggunakan Vercel?**
A: Tidak harus. Bisa pakai backend apapun (Node.js, Python, dll) selama env variable tersupport.

**Q: Bagaimana jika butuh multiple API keys?**
A: Add lebih banyak env variables ke .env dan Vercel dashboard.

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Gagal menghubungi server" | Check .env GEMINI_API_KEY, restart server |
| "HTTP 401" | API key tidak valid, dapatkan dari aistudio.google.com |
| Analysis tidak muncul | Check browser console untuk errors, verify backend running |
| Chat history kosong | Normal, fresh session, akan bertambah saat chat |

---

## 📚 Learn More

- [INTEGRATION_SECURE_CHATBOT.md](./INTEGRATION_SECURE_CHATBOT.md) - Complete guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Setup checklist
- [Gemini API Docs](https://ai.google.dev/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Status:** ✅ Ready to Test!
**Last Updated:** 2024
**Next:** Follow Step 1 in "Cara Testing" section above ⬆️
