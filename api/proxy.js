// api/proxy.js
// Vercel Serverless Function sebagai proxy ke Google Apps Script

// Ganti dengan URL backend Google Apps Script Anda yang sudah di-deploy
const GAS_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbySON46_F7D-HEwoDWo3Z68Z2l-DZ7-OjMMkHa_r8ETBtJxCXHlgSZsPPfytfA9BrgFzw/exec';

export default async function handler(req, res) {
  // Set CORS headers agar aman (opsional karena same-origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Hanya menerima POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ambil body dari request frontend
    const { action, data } = req.body;

    // Kirim request ke Google Apps Script
    const response = await fetch(GAS_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data }),
    });

    // Baca response dari GAS
    const result = await response.json();

    // Kirim balik ke frontend
    res.status(200).json(result);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ success: false, message: 'Proxy error: ' + error.message });
  }
}
