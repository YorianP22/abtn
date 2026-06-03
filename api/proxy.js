// api/proxy.js
// Proxy untuk Google Apps Script – versi robust dengan error handling lengkap

const GAS_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbySON46_F7D-HEwoDWo3Z68Z2l-DZ7-OjMMkHa_r8ETBtJxCXHlgSZsPPfytfA9BrgFzw/exec';

// Helper untuk parse body (karena Vercel tidak selalu parse otomatis)
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // Set CORS untuk keamanan
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method GET untuk test kesehatan proxy
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'proxy aktif', time: new Date().toISOString() });
  }

  // Hanya POST yang diproses
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body secara manual
    const body = await parseBody(req);
    const { action, data } = body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Missing action parameter' });
    }

    console.log(`[Proxy] Forwarding action: ${action}`);

    // Kirim ke GAS dengan timeout 25 detik (Vercel max 10s, tapi kita kasih 9s saja)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(GAS_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Proxy] GAS error HTTP ${response.status}`);
      return res.status(502).json({
        success: false,
        message: `Backend GAS error: HTTP ${response.status}`,
      });
    }

    // Baca response GAS (teks dulu, lalu parse JSON)
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('[Proxy] GAS returned non-JSON:', text.substring(0, 200));
      return res.status(502).json({
        success: false,
        message: 'Backend GAS mengirim response tidak valid (bukan JSON)',
      });
    }

    // Kirim balik ke frontend
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Timeout koneksi ke backend (9s)' });
    }
    return res.status(500).json({
      success: false,
      message: 'Proxy internal error: ' + error.message,
    });
  }
}
