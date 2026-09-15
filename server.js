require('dotenv').config();

const express = require('express');
const path = require('path');
const virtualTryOn = require('./services/virtualTryOn');

const app = express();

// Photos arrive as base64 data URIs, which are bigger than the raw file —
// 15mb keeps typical phone photos working without choking the server.
app.use(express.json({ limit: '15mb' }));

// Serves public/index.html (and any other static files) at "/"
app.use(express.static(path.join(__dirname, 'public')));

// The ONLY place the frontend talks to. The FASHN key never reaches the browser.
app.post('/api/tryon', async (req, res) => {
  const { personImage, garmentImage, category } = req.body || {};

  if (!personImage || !garmentImage) {
    return res.status(400).json({ error: 'Person aur garment dono photos chahiye.' });
  }

  try {
    const result = await generateTryOn({ personImage, garmentImage, category });
    return res.json(result);
  } catch (err) {
    console.error('[POST /api/tryon] failed:', err.message);
    return res.status(502).json({
      error: err.message || 'Virtual try-on generate nahi ho paya. Dobara try karein.',
    });
  }
});

// Handy to sanity-check which mode the server is running in without exposing the key itself
app.get('/api/status', (req, res) => {
  res.json({ provider: getProvider().name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Virtual Try-On server running: http://localhost:${PORT}`);
  console.log(`Mode: ${getProvider().name === 'fashn' ? 'REAL AI (FASHN v1.6)' : 'DEMO MODE (no FASHN_API_KEY set)'}`);
});
