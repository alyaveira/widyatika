// api/chat.js — Fixed with CORS + OPTIONS

export default async function handler(req, res) {
  // =============================================
  // 1. SET CORS HEADERS
  // =============================================
  const allowedOrigins = [
    'https://widyatika.vercel.app',    // Ganti dengan domain Anda
    'http://localhost:3000',
    'http://localhost:5500',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Izin semua origin untuk sementara (tidak aman di production, tapi untuk debug)
    res.setHeader('Access-Control-Allow-Origin', '*');
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
    console.error('[Chat API] GEMINI_API_KEY not set');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: missing API key',
    });
  }

  // =============================================
  // 5. PARSE BODY
  // =============================================
  const { mode = 'chat', message, context = {} } = req.body || {};

  if (mode !== 'chat' && mode !== 'analyse') {
    return res.status(400).json({ success: false, error: 'Mode must be "chat" or "analyse"' });
  }

  if (mode === 'chat' && (!message || typeof message !== 'string' || !message.trim())) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  // =============================================
  // 6. BUILD PROMPT
  // =============================================
  const systemPrompt = `Kamu adalah Widy, asisten pedagogis AI untuk platform Widyatika...
  (sama seperti sebelumnya, tidak diubah)`;

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
  // 7. CALL GEMINI API
  // =============================================
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      system: systemPrompt,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 512,
      },
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Maaf, saya tidak dapat menghasilkan respons.';

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