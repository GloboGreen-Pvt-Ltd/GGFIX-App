// Client-side catalogue search for the Home search / scanner.
//
// Reads only existing public master-data endpoints (models, brands, device
// categories, repair services). The full model list is ~4 MB, so it is loaded
// once per app session on first use and kept in memory.
import { getAllModels, getBrands, getDeviceCategories, getRepairServices } from '../api/masterData';
import { resolveDeviceImageSource } from './images';

let catalogPromise = null;

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();

// If the big model list fails (slow / dropped connection) the small lists are
// still returned with `partial: true`, and nothing is cached, so the next call
// retries instead of searching an empty catalogue for the rest of the session.
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      let modelsFailed = false;
      const [models, brands, categories, services] = await Promise.all([
        getAllModels().catch(() => { modelsFailed = true; return []; }),
        getBrands().catch(() => []),
        getDeviceCategories().catch(() => []),
        getRepairServices().catch(() => []),
      ]);
      const brandById = new Map((brands || []).map((b) => [b.id, b]));
      const catById = new Map((categories || []).filter((c) => c.isActive !== false).map((c) => [c.id, c]));
      return {
        brands: (brands || []).map((b) => ({ ...b, _n: norm(b.name) })),
        categories: [...catById.values()].map((c) => ({ ...c, _n: norm(`${c.name} ${c.code}`) })),
        services: (services || []).filter((s) => s.name).map((s) => ({ ...s, _n: norm(s.name) })),
        // Skip placeholder rows (e.g. a model literally named "0").
        models: (models || []).filter((m) => m.name && /[a-z]/i.test(m.name)).map((m) => ({
          ...m,
          brandName: brandById.get(m.brandId)?.name || null,
          _n: norm(m.name),
          // Name with its brand, so "samsung galaxy s23" matches "Galaxy S23".
          _nb: norm(`${brandById.get(m.brandId)?.name || ''} ${m.name}`),
          _nums: (Array.isArray(m.modelNumber) ? m.modelNumber : [m.modelNumber]).filter(Boolean).map((x) => norm(x).replace(/ /g, '')),
        })),
        brandById,
        catById,
        partial: modelsFailed,
      };
    })().then(
      (c) => { if (c.partial) catalogPromise = null; return c; },
      (e) => { catalogPromise = null; throw e; },
    );
  }
  return catalogPromise;
}

// Intent words steer which action is offered first and are dropped from matching.
const INTENTS = {
  repair: ['repair', 'fix', 'service', 'replace', 'replacement'],
  sell: ['sell', 'selling', 'exchange'],
  buy: ['buy', 'purchase', 'refurbished', 'used', 'second'],
};
// Everyday words for device categories (matched against category name / code).
const CATEGORY_WORDS = {
  mobile: ['phone', 'phones', 'mobile', 'mobiles', 'smartphone', 'iphone', 'android'],
  laptop: ['laptop', 'laptops', 'notebook', 'macbook'],
  tablet: ['tablet', 'tablets', 'ipad', 'tab'],
  watch: ['watch', 'smartwatch', 'watches'],
  audio: ['audio', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'airpods', 'speaker'],
};

export function parseQuery(q) {
  const tokens = norm(q).split(' ').filter(Boolean);
  let intent = null;
  const rest = [];
  for (const t of tokens) {
    const hit = Object.keys(INTENTS).find((k) => INTENTS[k].includes(t));
    if (hit && !intent) intent = hit;
    else if (!hit) rest.push(t);
  }
  return { intent, tokens: rest, text: rest.join(' ') };
}

const hasWord = (hay, t) => hay === t || hay.startsWith(`${t} `) || hay.includes(` ${t}`);

// Ranked matches across the catalogue for a query.
export function searchCatalog(catalog, q, { limit = 12 } = {}) {
  const { intent, tokens, text } = parseQuery(q);
  if (!catalog || (!tokens.length && !intent)) return { intent, models: [], brands: [], categories: [], services: [] };

  const allIn = (hay) => tokens.every((t) => hasWord(hay, t));
  const compact = text.replace(/ /g, '');

  // A bare category word ("laptop", "earbuds") is answered by the category
  // actions, not by every model that happens to have the word in its name.
  const CAT_WORDS = Object.values(CATEGORY_WORDS).flat();
  const onlyCategoryWords = tokens.length > 0 && tokens.every((t) => CAT_WORDS.includes(t));
  // Exactly a brand name ("samsung") → the brand row, not an arbitrary model list.
  const exactBrand = catalog.brands.some((b) => b._n === text);

  const models = [];
  if (tokens.length && !onlyCategoryWords && !exactBrand) {
    for (const m of catalog.models) {
      let score = 0;
      if (compact.length >= 4 && m._nums.includes(compact)) score = 100;
      else if (allIn(m._nb)) {
        score = 50 - Math.min(30, m._n.length - text.length);
        if (m._n.startsWith(text)) score += 15;
        if (m._n === text || m._n.endsWith(` ${text}`)) score += 10;
      }
      if (score > 0) models.push([score, m]);
    }
    models.sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length);
  }

  const brands = tokens.length ? catalog.brands.filter((b) => tokens.some((t) => b._n.startsWith(t) || (t.length >= 3 && b._n.includes(t)))) : [];

  const catHit = (c) => {
    const words = Object.entries(CATEGORY_WORDS).find(([k]) => c._n.includes(k))?.[1] || [];
    return tokens.some((t) => c._n.split(' ').some((w) => w.startsWith(t) && t.length >= 3) || words.includes(t));
  };
  const categories = tokens.length ? catalog.categories.filter(catHit) : (intent ? catalog.categories : []);

  const services = tokens.length
    ? catalog.services.filter((s) => tokens.every((t) => t.length >= 3 && s._n.includes(t))).slice(0, 4)
    : [];

  return { intent, models: models.slice(0, limit).map(([, m]) => m), brands: brands.slice(0, 8), categories, services };
}

// Route params for a catalogue model in each flow.
export function modelRouteParams(catalog, m) {
  const cat = catalog?.catById?.get(m.categoryId);
  return {
    categoryId: m.categoryId,
    categoryCode: (cat?.code || '').toUpperCase() || undefined,
    categoryName: cat?.name,
    brandId: m.brandId,
    brandName: m.brandName || catalog?.brandById?.get(m.brandId)?.name,
    seriesId: m.seriesId || undefined,
    modelId: m.id,
    modelName: m.name,
    modelImageUrl: resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) || undefined,
  };
}
