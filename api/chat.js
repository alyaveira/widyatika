/**
 * api/chat.js — Vercel Serverless Function untuk Chatbot Widy & Dashboard Analysis
 * 
 * Endpoint ini menerima pesan dari browser (dashboard) dan memanggil Google Gemini API.
 * API Key disimpan aman di environment variable (bukan di browser).
 * 
 * Modes:
 *   1. chat: Pesan dari user → response dari Gemini
 *   2. analyse: Analisis dashboard data → insights & rekomendasi dari Gemini
 * 
 * Usage:
 *   POST /api/chat
 *   Body: {
 *     mode: 'chat' | 'analyse',
 *     message?: string,
 *     context?: { totalKelas, totalSiswa, rataSkor, ... }
 *   }
 *   Response: { success: boolean, response: string, error?: string }
 */

export default async function handler(req, res) {
  // ========================================
  // 1. VALIDASI HTTP METHOD
  // ========================================
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Gunakan POST.',
    });
  }

  // ========================================
  // 2. VALIDASI API KEY
  // ========================================
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Chat API] GEMINI_API_KEY tidak dikonfigurasi di environment.');
    return res.status(500).json({
      success: false,
      error: 'API Key tidak tersedia. Hubungi administrator.',
    });
  }

  // ========================================
  // 3. PARSE REQUEST
  // ========================================
  const { mode = 'chat', message, context = {} } = req.body;

  if (mode !== 'chat' && mode !== 'analyse') {
    return res.status(400).json({
      success: false,
      error: 'Mode harus "chat" atau "analyse".',
    });
  }

  if (mode === 'chat' && (!message || typeof message !== 'string' || !message.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Pesan tidak boleh kosong.',
    });
  }

  // ========================================
  // 4. BUILD SYSTEM PROMPT & USER MESSAGE
  // ========================================
  const systemPrompt = `Kamu adalah Widy, asisten pedagogis AI untuk platform Widyatika, platform asesmen diagnostik numerasi berbasis game untuk siswa Sekolah Dasar (SD).

Platform ini mengimplementasikan metode Number Talks — di mana siswa menemukan banyak cara berbeda untuk mencapai satu angka target.

Data konteks guru yang sedang login:
- Nama guru: ${context.nama_lengkap || 'Guru'}
- Total kelas: ${context.totalKelas || 0}
- Total siswa: ${context.totalSiswa || 0}
- Rata-rata skor siswa: ${context.rataSkor || 0} poin

Tugasmu:
1. Membantu guru memahami data dan progres siswa
2. Memberikan saran pedagogis berbasis bukti untuk meningkatkan kemampuan numerasi
3. Menjelaskan konsep Number Talks dengan bahasa yang mudah dipahami
4. Merekomendasikan strategi diferensiasi untuk siswa dengan berbagai kemampuan
5. Menjawab pertanyaan umum tentang asesmen diagnostik matematika SD

Selalu gunakan Bahasa Indonesia yang hangat, profesional, dan ramah.
Jawaban harus singkat, actionable, dan relevan dengan konteks SD.
Jika ditanya di luar topik pendidikan/numerasi, tolak dengan sopan dan kembalikan ke topik yang relevan.`;

  // Build user message berdasarkan mode
  let userMessage = message;
  if (mode === 'analyse') {
    userMessage = `Berikan analisis ringkas dan rekomendasi actionable berdasarkan data kelas saya:
- Total kelas: ${context.totalKelas || 0}
- Total siswa: ${context.totalSiswa || 0}
- Rata-rata skor: ${context.rataSkor || 0} poin
- Kelas dengan skor tertinggi: ${context.highestClass || '-'}
- Kelas dengan skor terendah: ${context.lowestClass || '-'}

Fokus pada:
1. Siswa/kelas mana yang perlu perhatian khusus?
2. Strategi apa yang bisa diterapkan untuk meningkatkan skor?
3. Apakah ada pola pembelajaran yang perlu diubah?`;
  }

  // ========================================
  // 5. CALL GEMINI API
  // ========================================
  try {
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    const payload = {
      system: systemPrompt,
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    // ========================================
    // 6. HANDLE GEMINI RESPONSE
    // ========================================
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Gemini API Error: ${response.status}`;
      console.error('[Chat API] Gemini Error:', errorMsg);

      return res.status(response.status).json({
        success: false,
        error: `Gemini API error: ${errorMsg}`,
      });
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      console.error('[Chat API] No candidates in response:', data);
      return res.status(500).json({
        success: false,
        error: 'Tidak ada respons dari Gemini API.',
      });
    }

    const aiText = data.candidates[0]?.content?.parts?.[0]?.text
      || 'Maaf, saya tidak dapat menghasilkan respons. Coba ulangi pertanyaan Anda.';

    // ========================================
    // 7. RETURN SUCCESS RESPONSE
    // ========================================
    return res.status(200).json({
      success: true,
      response: aiText,
    });

  } catch (error) {
    console.error('[Chat API] Exception:', error);
    return res.status(500).json({
      success: false,
      error: `Terjadi kesalahan: ${error.message}`,
    });
  }
}
