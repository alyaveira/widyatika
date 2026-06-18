/**
 * chatbot.js — Widy AI Chatbot Module
 * =============================================================================
 * Modul logika chatbot untuk dashboard guru.
 * 
 * CATATAN KEAMANAN:
 *   API Key Gemini di-inject dari backend/environment, BUKAN hardcoded di sini.
 *   Browser tidak boleh mengirim request langsung ke Gemini API dengan API key.
 *   
 * ALUR AMAN:
 *   1. Browser → POST ke /api/chat (endpoint backend)
 *   2. Backend menerima user message
 *   3. Backend → POST ke Gemini API (dengan API key aman di backend)
 *   4. Backend → return response ke browser
 *   5. Browser menampilkan response
 * 
 * Untuk development lokal tanpa backend, gunakan FALLBACK_MODE = true,
 * namun JANGAN lakukan ini di production.
 * =============================================================================
 */

export class WidyaChatbot {
  constructor(options = {}) {
    this.config = {
      fallbackMode: options.fallbackMode ?? false,
      backendUrl: options.backendUrl ?? '/api/chat',
      maxTokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.75,
      enableLogging: options.enableLogging ?? false,
    };

    this.chatHistory = [];
    this.isLoading = false;
    this.callbacks = {
      onMessage: options.onMessage || (() => {}),
      onError: options.onError || (() => {}),
      onLoadingStart: options.onLoadingStart || (() => {}),
      onLoadingEnd: options.onLoadingEnd || (() => {}),
    };
  }

  /**
   * Kirim pesan ke chatbot dan dapatkan respons
   * @param {string} userMessage - Pesan dari user
   * @param {object} context - Konteks guru (nama, kelas, siswa, skor)
   * @returns {Promise<string>} Respons dari AI
   */
  async sendMessage(userMessage, context = {}) {
    if (!userMessage || !userMessage.trim()) {
      throw new Error('Pesan tidak boleh kosong');
    }

    if (this.isLoading) {
      throw new Error('Chatbot sedang memproses pesan sebelumnya');
    }

    this.isLoading = true;
    this.callbacks.onLoadingStart();

    try {
      // Tambahkan pesan user ke history
      this.chatHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      });

      // Kirim ke backend atau fallback
      const response = this.config.fallbackMode
        ? await this.sendMessageViaFallback(userMessage, context)
        : await this.sendMessageViaBackend(userMessage, context);

      // Simpan response di history
      this.chatHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });

      this.callbacks.onMessage({
        role: 'assistant',
        content: response,
      });

      return response;

    } catch (error) {
      this.log('Error in sendMessage:', error);
      this.callbacks.onError(error);
      throw error;
    } finally {
      this.isLoading = false;
      this.callbacks.onLoadingEnd();
    }
  }

  /**
   * Kirim pesan ke backend API (RECOMMENDED)
   * Backend endpoint harus berada di /api/chat (atau sesuaikan di config)
   * @private
   */
  async sendMessageViaBackend(userMessage, context) {
    const response = await fetch(this.config.backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        message: userMessage,
        context: context,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Backend Error: ${errorMsg}`);
    }

    const data = await response.json();
    if (!data.success || !data.response) {
      throw new Error(data.error || 'Response tidak valid dari backend');
    }

    return data.response;
  }

  /**
   * Kirim pesan via fallback mode (hanya untuk development)
   * JANGAN GUNAKAN DI PRODUCTION
   * @private
   */
  async sendMessageViaFallback(userMessage, context) {
    this.log('⚠️ FALLBACK MODE - Hanya untuk development!');

    // Simulasi delay processing
    await new Promise(resolve => setTimeout(resolve, 800));

    // Response sederhana berdasarkan keyword
    const lowerMsg = userMessage.toLowerCase();

    if (lowerMsg.includes('skor')) {
      return `Rata-rata skor siswa Anda adalah ${context.rataSkor || 0} poin. Coba tingkatkan dengan strategi Number Talks yang lebih interaktif.`;
    }
    if (lowerMsg.includes('number talks')) {
      return `Number Talks adalah metode pembelajaran di mana siswa menemukan banyak cara berbeda untuk mencapai satu target angka. Contoh: mencapai angka 10 bisa dengan 5+5, 6+4, 7+3, dll. Ini membangun fleksibilitas numerasi!`;
    }
    if (lowerMsg.includes('kelas')) {
      return `Anda memiliki ${context.totalKelas || 0} kelas dengan total ${context.totalSiswa || 0} siswa. Bagaimana strategi pembelajaran di kelas Anda?`;
    }

    return `Saya Widy, asisten pedagogis Widyatika. Maaf, dalam mode fallback saya hanya bisa menjawab soal skor, Number Talks, atau kelas. Untuk fitur lengkap, aktifkan backend API.`;
  }

  /**
   * Reset chat history
   */
  resetHistory() {
    this.chatHistory = [];
  }

  /**
   * Dapatkan history chat
   * @returns {Array} Array of chat messages
   */
  getHistory() {
    return [...this.chatHistory];
  }

  /**
   * Logging utility
   * @private
   */
  log(message, data) {
    if (this.config.enableLogging) {
      console.log(`[WidyaChat] ${message}`, data);
    }
  }
}

export default WidyaChatbot;
