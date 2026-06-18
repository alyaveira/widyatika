# 🧪 API Testing Guide

## Backend Endpoint: `/api/chat`

### Base Configuration
```
Protocol: HTTPS (Production) / HTTP (Local Dev)
Method: POST
Content-Type: application/json
Auth: None (API key in env)
```

---

## Mode 1: Chat Mode

User mengirim pesan, Widy merespons pertanyaan.

### Request Example
```json
POST /api/chat
Content-Type: application/json

{
  "mode": "chat",
  "message": "Bagaimana cara meningkatkan skor siswa yang rendah?",
  "context": {
    "nama_lengkap": "Ibu Ani",
    "totalKelas": 2,
    "totalSiswa": 40,
    "rataSkor": 75
  }
}
```

### Response Example (Success)
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "response": "Untuk meningkatkan skor siswa yang rendah, Ibu Ani, berikut beberapa strategi yang dapat diterapkan:\n\n1. **Identifikasi Kesulitan Spesifik**: Lakukan asesmen diagnostik untuk memahami konsep mana yang belum dikuasai siswa.\n\n2. **Implementasi Number Talks**: Gunakan Number Talks untuk membangun pemahaman konsep numerasi yang kuat dan fleksibel dalam berhitung.\n\n3. **Pembelajaran Diferensiasi**: Kelompokkan siswa berdasarkan level kemampuan dan berikan bahan pembelajaran yang sesuai.\n\n4. **Repetisi dan Praktek**: Siswa yang berkembang lambat membutuhkan lebih banyak praktek terstruktur.\n\n5. **Libatkan Orang Tua**: Komunikasikan progres dan minta dukungan di rumah.\n\nBerapa banyak siswa yang perlu perhatian khusus saat ini? Kami bisa membuat strategi yang lebih spesifik."
}
```

### Response Example (Error)
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": "Pesan tidak boleh kosong."
}
```

---

## Mode 2: Analysis Mode

Widy menganalisis dashboard data dan memberikan insights.

### Request Example
```json
POST /api/chat
Content-Type: application/json

{
  "mode": "analyse",
  "context": {
    "nama_lengkap": "Ibu Ani",
    "totalKelas": 2,
    "totalSiswa": 40,
    "rataSkor": 75,
    "highestClass": "Kelas 3A (Skor: 82)",
    "lowestClass": "Kelas 2B (Skor: 68)"
  }
}
```

### Response Example (Success)
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "response": "📊 **Analisis Performa Dashboard Ibu Ani:**\n\n**Ringkasan Data:**\n- Total Kelas: 2\n- Total Siswa: 40\n- Rata-rata Skor: 75 poin\n- Kisaran Performa: 68-82 poin (variasi 14 poin)\n\n**1. Siswa/Kelas yang Perlu Perhatian Khusus:**\nKelas 2B memiliki skor terendah (68 poin) dengan gap 7 poin di bawah rata-rata. Ini menunjukkan bahwa siswa di kelas ini memerlukan intervensi pedagogis yang lebih intensif.\n\n**2. Strategi yang Bisa Diterapkan:**\n- **Number Talks intensif**: Terapkan 3x per minggu di Kelas 2B untuk memperkuat pemahaman konsep\n- **Peer tutoring**: Manfaatkan siswa Kelas 3A untuk membantu teman di Kelas 2B\n- **Diagnostic feedback**: Identifikasi kesulitan spesifik (penjumlahan, pengurangan, konsep bilangan)\n- **Parent engagement**: Libatkan orangtua dengan homework yang terstruktur\n\n**3. Pola Pembelajaran yang Perlu Diubah:**\n- Kelas 3A sudah menunjukkan performa bagus (82), pertahankan momentum\n- Kelas 2B butuh fokus pada konsep dasar - jangan terburu-buru ke materi advanced\n- Rata-rata 75 masih di bawah target ideal (80+), ada ruang untuk improvement di kedua kelas\n\n**Rekomendasi Aksi:**\n✅ Tingkatkan frekuensi Number Talks di Kelas 2B\n✅ Monitor progress siswa lemah minggu ini\n✅ Kolaborasi dengan orang tua untuk dukungan di rumah\n✅ Review strategi dalam 2 minggu\n\nApakah ada siswa spesifik yang Anda khawatirkan? Saya bisa memberikan rekomendasi yang lebih personal."
}
```

### Response Example (Error)
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": "Mode harus \"chat\" atau \"analyse\"."
}
```

---

## Testing with cURL

### Test 1: Chat Mode (Local)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "message": "Apa itu Number Talks?",
    "context": {
      "nama_lengkap": "Test Teacher",
      "totalKelas": 1,
      "totalSiswa": 20,
      "rataSkor": 70
    }
  }'
```

### Test 2: Analysis Mode (Local)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "analyse",
    "context": {
      "nama_lengkap": "Test Teacher",
      "totalKelas": 2,
      "totalSiswa": 40,
      "rataSkor": 75,
      "highestClass": "Kelas 3A",
      "lowestClass": "Kelas 2B"
    }
  }'
```

### Test 3: Chat Mode (Production)
```bash
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "message": "Bagaimana cara mengajar Number Talks?",
    "context": {
      "nama_lengkap": "Ibu Guru",
      "totalKelas": 2,
      "totalSiswa": 35,
      "rataSkor": 76
    }
  }'
```

---

## Testing with JavaScript (Browser Console)

### Test 1: Chat in Console
```javascript
// Open browser console on dashboard
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'chat',
    message: 'Apa rekomendasi untuk siswa yang kesulitan?',
    context: {
      nama_lengkap: 'Test',
      totalKelas: 2,
      totalSiswa: 30,
      rataSkor: 70
    }
  })
});
const data = await response.json();
console.log(data);
```

### Test 2: Analysis in Console
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'analyse',
    context: {
      nama_lengkap: 'Test',
      totalKelas: 2,
      totalSiswa: 30,
      rataSkor: 70,
      highestClass: 'Kelas 3A (80)',
      lowestClass: 'Kelas 2B (60)'
    }
  })
});
const data = await response.json();
console.log(data);
```

---

## Expected Behavior Timeline

### Timeline: Chat Mode
```
1. User types message & clicks send
   ↓
2. Browser shows typing indicator ("..." animation)
   ↓
3. Browser sends fetch('/api/chat', { mode: 'chat', message, context })
   ↓
4. Backend receives request (~50ms)
   ↓
5. Backend builds prompt & calls Gemini (~2-3 seconds)
   ↓
6. Gemini processes request (~1-2 seconds)
   ↓
7. Backend receives response from Gemini (~1 second)
   ↓
8. Backend returns JSON to browser (~50ms)
   ↓
9. Browser removes typing indicator
   ↓
10. Browser displays AI response in chat
    ↓
11. User sees complete message (Total: ~4-7 seconds)
```

### Timeline: Analysis Mode
```
1. Dashboard finishes loading
   ↓
2. JavaScript auto-calls analyseDashboard() after 500ms delay
   ↓
3. Typing indicator appears ("..." animation)
   ↓
4. Browser sends fetch('/api/chat', { mode: 'analyse', context })
   ↓
5. Backend builds analysis prompt from context data
   ↓
6. Backend calls Gemini with dashboard data
   ↓
7. Gemini generates analysis (2-3 seconds)
   ↓
8. Response returned to browser
   ↓
9. "📊 **Analisis Dashboard:**" message appears with insights
   ↓
10. User sees recommendations & insights (Total: ~4-7 seconds)
```

---

## Error Scenarios & Responses

### Error 1: Invalid Mode
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode": "invalid"}'
```

**Response:**
```json
{
  "success": false,
  "error": "Mode harus \"chat\" atau \"analyse\"."
}
```

### Error 2: Chat Mode Without Message
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode": "chat", "context": {}}'
```

**Response:**
```json
{
  "success": false,
  "error": "Pesan tidak boleh kosong."
}
```

### Error 3: Method Not Allowed
```bash
curl -X GET http://localhost:3000/api/chat
```

**Response:**
```json
HTTP/1.1 405 Method Not Allowed

{
  "success": false,
  "error": "Method not allowed. Gunakan POST."
}
```

### Error 4: Invalid API Key (Production)
If GEMINI_API_KEY in Vercel env is wrong:

**Response:**
```json
{
  "success": false,
  "error": "Failed to call Gemini API: 401 Unauthorized"
}
```

**Fix:** Update Vercel environment variable with valid GEMINI_API_KEY

### Error 5: Network Timeout
If backend/Gemini slow or unresponsive:

**Response:**
```json
{
  "success": false,
  "error": "Gemini API request timeout after 30 seconds"
}
```

**Fix:** Check internet connection, Gemini API status, Vercel logs

---

## Performance Metrics

### Expected Response Times
| Component | Time |
|-----------|------|
| Browser → Backend | 50ms |
| Backend processing | 200ms |
| Backend → Gemini | 500ms |
| Gemini processing | 1-3 seconds |
| Gemini → Backend | 500ms |
| Backend → Browser | 50ms |
| Browser rendering | 100-200ms |
| **Total** | **2-5 seconds** |

### Typical Response Sizes
| Mode | Request Size | Response Size |
|------|-------------|---------------|
| chat | 300-500 bytes | 1-3 KB |
| analyse | 200-400 bytes | 2-5 KB |

---

## Advanced Testing Scenarios

### Scenario 1: Different Student Data
```javascript
// Test with high performers
{
  "mode": "analyse",
  "context": {
    "nama_lengkap": "Ibu Guru",
    "totalKelas": 3,
    "totalSiswa": 60,
    "rataSkor": 88,  // High score
    "highestClass": "Kelas 4 (94)",
    "lowestClass": "Kelas 3 (82)"
  }
}

// Test with low performers
{
  "mode": "analyse",
  "context": {
    "nama_lengkap": "Ibu Guru",
    "totalKelas": 2,
    "totalSiswa": 35,
    "rataSkor": 45,  // Low score
    "highestClass": "Kelas 3 (55)",
    "lowestClass": "Kelas 2 (35)"
  }
}

// Test with single class
{
  "mode": "analyse",
  "context": {
    "nama_lengkap": "Ibu Guru",
    "totalKelas": 1,
    "totalSiswa": 25,
    "rataSkor": 72
  }
}
```

### Scenario 2: Different User Questions
```javascript
// Practical question
{
  "mode": "chat",
  "message": "Siswa saya tidak mengerti konsep penjumlahan dengan regrouping. Apa strategi yang bagus?",
  "context": { "nama_lengkap": "Ibu Ani", "totalKelas": 2, "totalSiswa": 40, "rataSkor": 70 }
}

// Theory question
{
  "mode": "chat",
  "message": "Jelaskan prinsip-prinsip Number Talks berdasarkan teori Piaget",
  "context": { "nama_lengkap": "Ibu Ani", "totalKelas": 2, "totalSiswa": 40, "rataSkor": 70 }
}

// Classroom management question
{
  "mode": "chat",
  "message": "Bagaimana mengelola siswa yang ramai saat Number Talks?",
  "context": { "nama_lengkap": "Ibu Ani", "totalKelas": 2, "totalSiswa": 40, "rataSkor": 70 }
}
```

---

## Verification Checklist

- [ ] Local dev server running (`vercel dev`)
- [ ] `.env` has valid `GEMINI_API_KEY`
- [ ] Can call `/api/chat` with mode='chat'
- [ ] Can call `/api/chat` with mode='analyse'
- [ ] Responses contain success & response fields
- [ ] Error responses contain success=false & error message
- [ ] Dashboard auto-triggers analysis on load
- [ ] Manual "📊 Analisis Dashboard" button works
- [ ] Chat messages appear with typing indicator
- [ ] Response times are reasonable (<5 seconds)
- [ ] No API key visible in browser DevTools
- [ ] No errors in browser console

---

## Troubleshooting Testing Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 error | Endpoint not found | Check route is `/api/chat`, not `/api/chat.js` |
| 405 error | Wrong HTTP method | Use POST, not GET |
| 401 error | Invalid API key | Check .env GEMINI_API_KEY is correct |
| Timeout | Backend too slow | Check internet, restart Vercel dev |
| Empty response | Parsing error | Check response is valid JSON |
| "Message is undefined" | Missing message in chat mode | Provide message field for chat mode |

---

**Status:** Ready for API Testing ✅
**Next:** Copy-paste examples above and test! 🧪
