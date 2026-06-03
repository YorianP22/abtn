// api/proxy.js
const GAS_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbySON46_F7D-HEwoDWo3Z68Z2l-DZ7-OjMMkHa_r8ETBtJxCXHlgSZsPPfytfA9BrgFzw/exec';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'proxy ok', time: new Date().toISOString() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await parseBody(req);
    const { action, data } = body;
    if (!action) return res.status(400).json({ success: false, message: 'Missing action' });

    console.log(`[Proxy] action=${action}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(GAS_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // ⭐ Ambil raw response sebagai teks
    const rawText = await response.text();

    // Coba parse JSON
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error('[Proxy] GAS response BUKAN JSON:', rawText.substring(0, 500));
      // Kirim error + raw response ke frontend agar terlihat penyebabnya
      return res.status(502).json({
        success: false,
        message: 'Backend GAS mengirim response tidak valid (bukan JSON)',
        debug_raw_response: rawText.substring(0, 1000), // bantu debugging
        hint: 'Cek apakah GAS Web App sudah dipublikasikan dengan akses "Anyone" dan tidak error.'
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
