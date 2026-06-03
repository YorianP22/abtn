// api/proxy.js
// Proxy untuk menghindari CORS antara Vercel dan Google Apps Script

const GAS_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbySON46_F7D-HEwoDWo3Z68Z2l-DZ7-OjMMkHa_r8ETBtJxCXHlgSZsPPfytfA9BrgFzw/exec';

export default async function handler(req, res) {
  // Set CORS headers untuk keamanan (opsional karena same-origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Hanya menerima POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ambil data dari request frontend
    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Missing action parameter' });
    }

    console.log(`Proxy: forwarding action=${action}`);

    // Kirim request ke Google Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // timeout 30 detik

    const response = await fetch(GAS_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`GAS responded with HTTP ${response.status}`);
      return res.status(502).json({ 
        success: false, 
        message: `Backend error: HTTP ${response.status}` 
      });
    }

    // Baca response dari GAS
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse GAS response as JSON:', parseError);
      const text = await response.text();
      console.error('Raw response:', text.substring(0, 500));
      return res.status(502).json({ 
        success: false, 
        message: 'Invalid JSON response from backend' 
      });
    }

    // Kirim balik ke frontend
    return res.status(200).json(result);
  } catch (error) {
    console.error('Proxy error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Backend timeout (30s)' });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Proxy error: ' + error.message 
    });
  }
}
