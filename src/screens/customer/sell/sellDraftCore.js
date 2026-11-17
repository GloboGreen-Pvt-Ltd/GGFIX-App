// Pure Sell-draft logic (no React Native imports, unit-tested with a mocked storage).
// Storage layout: one key per signed-in customer → { [draftId]: draft }.
export const LEGACY_KEY = 'ggfix.sellDraft.v1'; // old single, unscoped draft: dropped (owner unknown)
export const draftsKey = (userId) => (userId ? `ggfix.sellDrafts.v2.${userId}` : null);

// Device-selection screens (before step 1) and the 5 sell steps.
export const PICK_ROUTES = ['SelectCategory', 'SelectBrand', 'SelectSeries', 'SelectModel', 'SelectVariant', 'SellSelectDevice'];
const STEP_OF = {
  SellCondition: 1, SellScreening: 2, SellScreenCondition: 2, SellFunctional: 2,
  SellDeviceConfig: 3, SellAccessoriesWarranty: 3, SellImages: 4, SellAddress: 5, SellComplete: 5,
};
export const TOTAL_STEPS = 5;
export const stepOf = (name) => STEP_OF[name] || 0;
export const isFlowRoute = (name) => PICK_ROUTES.includes(name) || !!STEP_OF[name];

export const plain = (v) => { try { return JSON.parse(JSON.stringify(v ?? null)); } catch (_) { return null; } };
const stripParams = (p) => { const { draftState, ...rest } = p || {}; return plain(rest) || {}; };

export const deviceId = (p) => {
  const d = p?.device || {};
  const id = [d.categoryId || d.categoryCode || p?.categoryId, d.brandId || d.brandName, d.modelId || d.modelName, d.ramOptionId || d.ramLabel, d.storageOptionId || d.storageLabel, d.color]
    .filter(Boolean).map(String).join(':');
  return id || (d.id ? `dev:${d.id}` : 'sell');
};
export const deviceName = (p) => {
  const d = p?.device || {};
  return d.modelName || d.name || [d.brandName, d.modelLabel].filter(Boolean).join(' ') || d.categoryName || p?.categoryName || 'Your device';
};

/** Skip edit / owner-listing flows. */
export const isDraftable = (params) => !(params?.editSellOrderId || params?.flow === 'OWNER_LIST');

/** Flow routes of a stack (from the first flow screen up to `uptoKey`), params without draftState. */
export function trailOf(routes, uptoKey) {
  const out = [];
  for (const r of routes || []) {
    if (isFlowRoute(r.name)) out.push({ name: r.name, params: stripParams(r.params) });
    else out.length = 0; // a non-flow screen in between starts a new trail
    if (r.key === uptoKey) break;
  }
  return out;
}

/**
 * Merge one step save into the drafts map (returns a new map).
 * opts.leaving: the screen is being removed (Back) → current step becomes the previous trail entry.
 */
export function mergeDraft(map, { name, params, state, trail }, opts = {}, now = Date.now()) {
  const p = stripParams(params);
  const id = deviceId(p);
  const prev = (map || {})[id] || {};
  const steps = { ...(prev.steps || {}), [name]: plain(state) };
  let t = trail && trail.length ? trail : (prev.trail || [{ name, params: p }]);
  let routeName = name;
  let routeParams = p;
  if (opts.leaving) {
    const i = t.map((x) => x.name).lastIndexOf(name);
    if (i >= 0) t = t.slice(0, i);
    if (!t.length) t = prev.trail?.length ? prev.trail.slice(0, -1) : [];
    const last = t[t.length - 1];
    if (!last) { routeName = name; } else { routeName = last.name; routeParams = last.params; }
  }
  const d = p.device || {};
  const st = steps.SellImages || {};
  const draft = {
    id,
    routeName,
    params: routeParams,
    state: steps[routeName] ?? null,
    steps,
    trail: t,
    deviceName: deviceName(p),
    category: d.categoryName || p.categoryName || d.categoryCode || p.categoryCode || null,
    categoryId: d.categoryId || p.categoryId || null,
    brand: d.brandName || p.brandName || null,
    model: d.modelName || p.modelName || null,
    imageUrl: d.imageUrl || p.modelImage || null,
    condition: steps.SellCondition?.condition ?? p.condition ?? prev.condition ?? null,
    issues: steps.SellScreening?.answers ?? steps.SellScreening?.selected ?? prev.issues ?? null,
    images: st.images ?? prev.images ?? null,
    video: st.images?.video ?? prev.video ?? null,
    price: p.expectedPrice ?? p.price ?? prev.price ?? null,
    step: stepOf(routeName),
    totalSteps: TOTAL_STEPS,
    updatedAt: now,
  };
  return { ...(map || {}), [id]: draft };
}

export const removeDraft = (map, id) => { const m = { ...(map || {}) }; delete m[id]; return m; };
export const listDrafts = (map) => Object.values(map || {}).filter((d) => d?.routeName).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

/** Storage wrapper with serialized read-modify-write (storage: getItem/setItem/removeItem, async). */
export function createDraftStore(storage, getUserId) {
  let chain = Promise.resolve();
  let legacyDone = false;
  const read = async (key) => { try { return JSON.parse(await storage.getItem(key)) || {}; } catch (_) { return {}; } };
  const run = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  const update = (fn) => run(async () => {
    if (!legacyDone) { legacyDone = true; try { await storage.removeItem(LEGACY_KEY); } catch (_) {} }
    const key = draftsKey(getUserId());
    if (!key) return null;
    const next = fn(await read(key));
    if (!Object.keys(next).length) await storage.removeItem(key);
    else await storage.setItem(key, JSON.stringify(next));
    return next;
  });
  return {
    list: () => run(async () => { const key = draftsKey(getUserId()); return key ? listDrafts(await read(key)) : []; }),
    save: (entry, opts) => update((m) => mergeDraft(m, entry, opts)),
    remove: (id) => update((m) => removeDraft(m, id)),
  };
}
