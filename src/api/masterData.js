import { masterApi } from './client';
import { MEDIA_UPLOAD_PATH } from './config';

function unwrap(list) {
  return Array.isArray(list) ? list : (list?.content ?? list?.data ?? []);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }

// Detect MIME type from filename extension. Covers the image and video formats
// the booking flow actually uploads — the device coverage video is a .mp4 (or a
// .mov from an iPhone), and defaulting those to image/jpeg is what made them
// upload as a photo and then fail to play back.
function mimeFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'image/jpeg';
}

// Upload an image or video (expo-image-picker asset) to the media endpoint and
// return the URL. The path differs between a direct service origin and the TLS
// edge (/media/upload vs /master/media/upload), so it comes from config.
// `slot` is the device-file shot name — 'front' | 'back' | 'video' — which the
// backend uses as the filename stem under media.ggfix.in/Devicefiles/.
export async function uploadMedia(asset, folder = 'sell', { slot } = {}) {
  if (!asset?.uri) return null;
  const name = asset.fileName || asset.uri.split('/').pop() || 'upload.jpg';
  const type = asset.mimeType || mimeFromName(name);
  const res = await masterApi.upload(MEDIA_UPLOAD_PATH, {
    uri: asset.uri,
    name,
    type,
    fields: { folder, slot },
  });
  return res?.url || null;
}

// Existing
export async function getBrands() {
  return unwrap(await masterApi.get('/master/brands'));
}
export async function getModelsByBrand(brandId) {
  if (!brandId) return [];
  return unwrap(await masterApi.get(`/master/brands/${brandId}/models`));
}

/**
 * Brands mapped to a category. Accepts either the category UUID or the
 * machine-readable CODE the mobile Home tiles use.
 *
 * Returns ONLY the brands mapped to this category. We intentionally do not
 * fall back to the full brand list when a category has no mappings — that
 * surfaced unrelated brands (e.g. phone brands under Smartwatches/Audio). The
 * caller shows a "No brands mapped to this category yet" empty state instead,
 * which is the signal for the admin to add Category-Brand mappings.
 */
export async function getBrandsForCategory(categoryIdOrCode) {
  if (!categoryIdOrCode) return getBrands();
  const path = isUuid(categoryIdOrCode)
    ? `/master/categories/${categoryIdOrCode}/brands`
    : `/master/categories/by-code/${encodeURIComponent(String(categoryIdOrCode).toUpperCase())}/brands`;
  return unwrap(await masterApi.get(path).catch(() => []));
}

/**
 * Series under a (category, brand) pair. Same code/UUID handling as above.
 * Returns [] when there are no series for this pair (caller can decide to
 * skip the series step).
 */
export async function getSeriesForCategoryBrand(categoryIdOrCode, brandId) {
  if (!categoryIdOrCode || !brandId) return [];
  const path = isUuid(categoryIdOrCode)
    ? `/master/categories/${categoryIdOrCode}/brands/${brandId}/series`
    : `/master/categories/by-code/${encodeURIComponent(String(categoryIdOrCode).toUpperCase())}/brands/${brandId}/series`;
  return unwrap(await masterApi.get(path).catch(() => []));
}

/** Models under a specific series (new hierarchy). */
export async function getModelsBySeries(seriesId) {
  if (!seriesId) return [];
  return unwrap(await masterApi.get(`/master/series/${seriesId}/models`).catch(() => []));
}
export async function getRamOptions() {
  return unwrap(await masterApi.get('/master/ram-options'));
}
export async function getStorageOptions() {
  return unwrap(await masterApi.get('/master/storage-options'));
}
export async function getRepairServices() {
  return unwrap(await masterApi.get('/master/repair-services'));
}

/**
 * Issues grouped under their main category for a device category, e.g.
 *   [{ id, name, issues: [{ id, name }, ...] }, ...]
 * Used by the customer "Select Repair Service" screen (accordion + checkboxes).
 */
export async function getRepairServicesGrouped(deviceCategoryId) {
  if (!deviceCategoryId) return [];
  return unwrap(await masterApi.get('/master/repair-services/grouped', {
    query: { deviceCategoryId },
  }).catch(() => []));
}

// New: device categories, series, colors
export async function getDeviceCategories() {
  return unwrap(await masterApi.get('/master/device-categories'));
}

export async function getSeriesByBrand(brandId) {
  if (!brandId) return [];
  return unwrap(await masterApi.get(`/master/brands/${brandId}/series`));
}
export async function getColors() {
  return unwrap(await masterApi.get('/master/colors'));
}

/** Single model, incl. its inline `colors` + `ramStorage` JSON arrays. */
export async function getModel(modelId) {
  if (!modelId) return null;
  return await masterApi.get(`/master/models/${modelId}`);
}

/**
 * Resolve a device's raw Build.MODEL code (e.g. "CPH2751", "RMX3999") — or a
 * plain model name — to the catalog model via master_models.model_number.
 * Returns { id, name, imageUrl, imageBase64 } on a match, else null (404).
 * Used by the Home "Sell This Device" card to show the proper marketing name
 * and device image for whatever phone the app is running on.
 */
export async function getModelByNumber(number) {
  const num = String(number || '').trim();
  if (!num) return null;
  return await masterApi.get('/master/models/by-number', { query: { number: num } }).catch(() => null);
}

/**
 * A model's *configured* options, read from its inline JSON arrays:
 *   colors      -> ["Diamond Black","Skyline Blue"]
 *   ramStorage  -> ["6 GB + 128 GB","8 GB + 128 GB"]
 * Colours resolve to a swatch hex via the global palette (matched by name);
 * each RAM+storage label resolves to real option UUIDs when those GB values
 * exist in the master lists, so the booking/sell payloads keep their FKs. The
 * full master lists come back too so callers can fall back to them when a model
 * has nothing configured yet.
 */
export async function getModelOptions(modelId) {
  const [allColors, allRams, allStorages, model] = await Promise.all([
    getColors().catch(() => []),
    getRamOptions().catch(() => []),
    getStorageOptions().catch(() => []),
    modelId ? getModel(modelId).catch(() => null) : Promise.resolve(null),
  ]);
  const colorByName = new Map(allColors.map((c) => [String(c.name).toLowerCase(), c]));

  const rawColors = Array.isArray(model?.colors) ? model.colors : [];
  const rawSpecs = Array.isArray(model?.ramStorage) ? model.ramStorage : [];

  const colors = [];
  const seenColor = new Set();
  for (const name of rawColors) {
    const key = String(name || '').toLowerCase();
    if (!key || seenColor.has(key)) continue;
    seenColor.add(key);
    const hit = colorByName.get(key);
    colors.push({ id: hit?.id || name, name, hexCode: hit?.hexCode });
  }

  const specs = [];
  const seenSpec = new Set();
  for (const raw of rawSpecs) {
    const label = String(raw || '').trim();
    if (!label || seenSpec.has(label)) continue;
    seenSpec.add(label);
    // Two shapes share this column: a "6 GB + 128 GB" combo (has a "+") and a
    // storage-only "128 GB" (no "+"). Storage-only specs carry no RAM half, so
    // the pickers render a plain Storage grid and don't require a RAM choice.
    if (label.includes('+')) {
      const [ramPart = '', stoPart = ''] = label.split('+').map((x) => x.trim());
      const ramGb = parseInt(ramPart, 10);
      const stoGb = parseInt(stoPart, 10);
      const ramOpt = allRams.find((r) => r.valueGb === ramGb);
      const stoOpt = allStorages.find((s) => s.valueGb === stoGb);
      specs.push({
        id: label,
        storageOnly: false,
        ramOptionId: ramOpt?.id || `ram:${ramPart}`,
        storageOptionId: stoOpt?.id || `sto:${stoPart}`,
        ramLabel: ramOpt?.label || ramPart,
        storageLabel: stoOpt?.label || stoPart,
        label,
      });
    } else {
      const stoGb = parseInt(label, 10);
      const stoOpt = allStorages.find((s) => s.valueGb === stoGb);
      specs.push({
        id: label,
        storageOnly: true,
        ramOptionId: null,
        storageOptionId: stoOpt?.id || `sto:${label}`,
        ramLabel: null,
        storageLabel: stoOpt?.label || label,
        label,
      });
    }
  }

  return { colors, specs, allColors, allRams, allStorages };
}

// Repair categories
export async function getRepairCategories() {
  return unwrap(await masterApi.get('/master/repair-categories'));
}

// Sell Flow → Device Configuration: returns [{ id, name, code, options:[{id,value}] }, ...]
export async function getConfigFields(deviceCategoryId) {
  return unwrap(await masterApi.get('/master/config-fields', {
    query: isUuid(deviceCategoryId) ? { deviceCategoryId } : undefined,
  }));
}

// Sell flow master data — all category-aware: pass the device's category UUID
// to get that category's list (items with no category are shared/returned too).
export async function getScreeningQuestions(flow, deviceCategoryId) {
  const query = {};
  if (flow) query.flow = flow;
  if (isUuid(deviceCategoryId)) query.deviceCategoryId = deviceCategoryId;
  return unwrap(await masterApi.get('/master/screening-questions', { query: Object.keys(query).length ? query : undefined }));
}
export async function getConditionGroups(deviceCategoryId) {
  return unwrap(await masterApi.get('/master/condition-groups', {
    query: isUuid(deviceCategoryId) ? { deviceCategoryId } : undefined,
  }));
}
export async function getConditionOptions(groupId) {
  return unwrap(await masterApi.get(`/master/condition-groups/${groupId}/options`));
}
export async function getFunctionalIssues(deviceCategoryId) {
  return unwrap(await masterApi.get('/master/functional-issues', {
    query: isUuid(deviceCategoryId) ? { deviceCategoryId } : undefined,
  }));
}

// Content
export async function getBanners() {
  return unwrap(await masterApi.get('/master/banners'));
}
export async function getFaqItems() {
  return unwrap(await masterApi.get('/master/faq-items'));
}
export async function getAppContent(code) {
  if (code) return await masterApi.get(`/master/app-content/${code}`);
  return unwrap(await masterApi.get('/master/app-content'));
}
export async function getSupportContacts() {
  return unwrap(await masterApi.get('/master/support-contacts'));
}
