// api/chat.js — Vercel Serverless Function untuk Gemini AI

export default async function handler(req, res) {
  // =============================================
  // 1. SET CORS HEADERS
  // =============================================
  const allowedOrigins = [
    'https://widyatika.vercel.app', // ganti dengan domain Anda
    'http://localhost:3000',
    'http://localhost:5500',
    'http://localhost:5501',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // untuk debug (tidak aman di production)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  // =============================================
  // 2. HANDLE PREFLIGHT (OPTIONS)
  // =============================================
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // =============================================
  // 3. VALIDASI METHOD
  // =============================================
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // =============================================
  // 4. VALIDASI API KEY
  // =============================================
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Chat API] GEMINI_API_KEY tidak diset di environment Vercel.');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: missing API key.',
    });
  }

  // =============================================
  // 5. PARSE BODY
  // =============================================
  let body;
  try {
    body = req.body; // Vercel sudah parse JSON
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  const { mode = 'chat', message, context = {} } = body;

  if (mode !== 'chat' && mode !== 'analyse') {
    return res.status(400).json({ success: false, error: 'Mode harus "chat" atau "analyse"' });
  }

  if (mode === 'chat' && (!message || typeof message !== 'string' || !message.trim())) {
    return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong' });
  }

  // =============================================
  // 6. BUILD PROMPT
  // =============================================
  const systemPrompt = `Kamu adalah Widy, asisten pedagogis AI untuk platform Widyatika, platform asesmen diagnostik numerasi berbasis game untuk siswa Sekolah Dasar (SD).

Platform ini mengimplementasikan metode Number Talks — di mana siswa menemukan banyak cara berbeda untuk mencapai satu angka target.

Data konteks guru yang sedang login:
- Nama guru: ${context.nama_lengkap || 'Guru'}
- Total kelas: ${context.totalKelas || 0}
- Total siswa: ${context.totalSiswa || 0}
- Rata-rata skor siswa: ${context.rataSkor || 0} poin
- Kelas dengan skor tertinggi: ${context.highestClass || '-'}
- Kelas dengan skor terendah: ${context.lowestClass || '-'}

Tugasmu:
1. Membantu guru memahami data dan progres siswa
2. Memberikan saran pedagogis berbasis bukti untuk meningkatkan kemampuan numerasi
3. Menjelaskan konsep Number Talks dengan bahasa yang mudah dipahami
4. Merekomendasikan strategi diferensiasi untuk siswa dengan berbagai kemampuan
5. Menjawab pertanyaan umum tentang asesmen diagnostik matematika SD

Selalu gunakan Bahasa Indonesia yang hangat, profesional, dan ramah.
Jawaban harus singkat, actionable, dan relevan dengan konteks SD.
Jika ditanya di luar topik pendidikan/numerasi, tolak dengan sopan dan kembalikan ke topik yang relevan.`;

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

  // =============================================
  // 7. PANGGIL GEMINI API
  // =============================================
  try {
    // Gunakan model gemini-1.5-flash dengan API key di URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.9,
        topK: 40,
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
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Chat API] Gemini error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || 'Gemini API error',
      });
    }

    // Ambil teks dari response
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak dapat memberikan respons.';

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