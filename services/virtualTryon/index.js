/**
 * Virtual Try-On service — provider-agnostic entry point.
 *
 * The rest of the app (server.js) only ever calls generateTryOn() below.
 * It never talks to FASHN (or any provider) directly, and it never sees
 * an API key. This is what lets us swap FASHN for another provider later
 * without touching server.js or the frontend.
 */

const demoProvider = require('./providers/demo');
const fashnProvider = require('./providers/fashn');

function getProvider() {
  const hasFashnKey = Boolean(process.env.FASHN_API_KEY && process.env.FASHN_API_KEY.trim());

  if (hasFashnKey) {
    return fashnProvider;
  }

  // No key configured -> fall back to Demo Mode. Never silently fake an
  // AI result under the real provider's name.
  return demoProvider;
}

async function generateTryOn({ personImage, garmentImage, category }) {
  if (!personImage || !garmentImage) {
    throw new Error('Person aur garment dono photos chahiye.');
  }
  const provider = getProvider();
  return provider.generate({ personImage, garmentImage, category });
}

module.exports = { generateTryOn, getProvider };
