/**
 * FASHN Virtual Try-On v1.6 provider.
 *
 * Docs: https://docs.fashn.ai/api-reference/tryon-v1-6
 * Flow: POST /v1/run (submit)  ->  poll GET /v1/status/:id  ->  output URL
 *
 * This file is the ONLY place in the whole project that knows about FASHN's
 * request/response shape. Swapping providers later means adding a new file
 * here (e.g. providers/otherprovider.js) and pointing services/virtualTryOn/index.js
 * at it — server.js and the frontend never change.
 */

const BASE_URL = 'https://api.fashn.ai/v1';
const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 45000; // FASHN v1.6 normally finishes in 5-17s; 45s is a safety ceiling

// Our app's categories -> FASHN's category enum (auto | tops | bottoms | one-pieces)
const CATEGORY_MAP = {
  Kurti: 'tops',
  Shirt: 'tops',
  'T-Shirt': 'tops',
  Pant: 'bottoms',
  Jeans: 'bottoms',
  Dress: 'one-pieces',
  Other: 'auto',
};

function mapCategory(category) {
  return CATEGORY_MAP[category] || 'auto';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generate({ personImage, garmentImage, category }) {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) {
    // Should never happen (index.js only routes here when a key exists),
    // but guard anyway so we never call FASHN without auth.
    throw new Error('FASHN_API_KEY set nahi hai.');
  }

  // ---- 1. Submit the prediction ----
  let submitRes;
  try {
    submitRes = await fetch(`${BASE_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: personImage, // data URI (base64) — matches FASHN's "image URL | data URI" input
          garment_image: garmentImage,
          category: mapCategory(category),
          mode: 'balanced',
          output_format: 'jpeg',
        },
      }),
    });
  } catch (networkErr) {
    throw new Error('FASHN API tak pahunch nahi paye. Internet/server connection check karein.');
  }

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => '');
    throw new Error(`FASHN ne request reject ki (status ${submitRes.status}). ${text.slice(0, 200)}`);
  }

  const submitData = await submitRes.json();
  if (submitData.error) {
    throw new Error(submitData.error.message || 'FASHN request error.');
  }
  const predictionId = submitData.id;
  if (!predictionId) {
    throw new Error('FASHN ne prediction id nahi bheji.');
  }

  // ---- 2. Poll for the result ----
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    let statusRes;
    try {
      statusRes = await fetch(`${BASE_URL}/status/${predictionId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (networkErr) {
      continue; // transient network hiccup — keep polling until MAX_WAIT_MS
    }

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();

    if (statusData.status === 'completed') {
      const output = Array.isArray(statusData.output) ? statusData.output[0] : null;
      if (!output) throw new Error('FASHN se result image nahi mili.');
      return { provider: 'fashn', demo: false, imageUrl: output, predictionId };
    }

    if (statusData.status === 'failed' || statusData.status === 'canceled') {
      const msg = (statusData.error && statusData.error.message) || 'Virtual try-on fail ho gaya.';
      throw new Error(msg);
    }

    // status is starting / in_queue / processing -> keep polling
  }

  throw new Error('Virtual try-on timeout ho gaya (45 second se zyada laga). Dobara try karein.');
}

module.exports = { name: 'fashn', generate };
