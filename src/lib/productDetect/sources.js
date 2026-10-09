// Customer-app I/O for the shared product detector (./index.js, ./core.js):
// existing APIs only — master-data Google Vision identify, the optional
// visual-search service, and the cached search catalogue.
import { identifyDevice } from '../../api/masterData';
import { VISUAL_SEARCH_BASE, visualSearchDevice } from '../../api/visualSearch';
import { loadCatalog } from '../../utils/searchCatalog';

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Named function, not an async arrow inside a ternary: that shape breaks
// Metro's Hermes transform ("Property id of VariableDeclarator …").
async function visual(photo, { ocrText } = {}) {
  // Wide net (20): the detector then keeps the recognised brand / device type.
  const r = await visualSearchDevice(photo, { limit: 20, ocrText });
  return { ok: true, confidence: r.confidence, matches: [r.bestMatch, ...(r.matches || [])].filter(Boolean), ocrText: r.ocrText || '' };
}

export default {
  async identify(photo) {
    const r = await identifyDevice(photo, { limit: 8 });
    if (!r.configured || r.error) return { ok: false, error: r.error || 'not configured' };
    return {
      ok: true,
      confidence: r.confidence,
      label: r.recognisedAs || null,
      brand: r.brand || null,
      labels: r.labels || [],
      matches: [r.bestMatch, ...(r.matches || [])].filter(Boolean),
    };
  },
  visual: VISUAL_SEARCH_BASE ? visual : null,
  async catalog() {
    const c = await loadCatalog();
    return (c?.models || []).map((m) => ({
      id: m.id,
      brand: m.brandName,
      name: m.name,
      category: c.catById?.get(m.categoryId)?.name,
      modelNumbers: [...list(m.modelNumber), ...list(m.otherNumber)],
      ref: m,
    }));
  },
};
