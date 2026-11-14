import { useEffect, useState } from 'react';
import { getDeviceCategories, getModel } from '../api/masterData';
import { resolveSpecCategory, SPEC_CATEGORY } from './deviceSpecs';

/** An IMEI is exactly 15 digits — the one rule every IMEI field uses. */
export const IMEI_LENGTH = 15;
/** For an IMEI field's onChangeText: digits only, capped at 15. */
export const cleanImei = (v) => String(v || '').replace(/\D/g, '').slice(0, IMEI_LENGTH);
export const isValidImei = (v) => /^\d{15}$/.test(String(v || ''));
/** Message for a partly typed IMEI, '' when empty or valid. */
export function imeiError(v) {
  const n = String(v || '').replace(/\D/g, '').length;
  return n && n !== IMEI_LENGTH ? `IMEI must be exactly 15 digits (${n} entered). Dial *#06# to see it.` : '';
}

/**
 * IMEI applies to mobile phones only — tablets, laptops, smartwatches and audio
 * devices have no IMEI to capture, so their IMEI field, row and "IMEI required"
 * gates are skipped. When the category can't be worked out at all, the old
 * (mobile) behaviour is kept so a phone never silently loses its IMEI step.
 *
 * Tickets in production don't carry a device category, so records fall back
 * to their model's categoryId → master device category (both cached).
 */
export function imeiApplies(category) {
  return category == null || category === SPEC_CATEGORY.MOBILE;
}

let categoriesPromise = null;
const modelCategory = new Map(); // modelId -> Promise<spec category | null>

async function categoryFromId(categoryId) {
  if (!categoryId) return null;
  if (!categoriesPromise) {
    categoriesPromise = getDeviceCategories().catch(() => {
      categoriesPromise = null;
      return [];
    });
  }
  const c = ((await categoriesPromise) || []).find((x) => x.id === categoryId);
  return resolveSpecCategory(c?.code, c?.name);
}

const directCategory = (src) => resolveSpecCategory(src?.deviceCategory, src?.categoryCode, src?.categoryName);

/** Seed the cache from model rows a screen already fetched (e.g. getModelsByBrand). */
export function primeModelCategory(model) {
  if (model?.id && model.categoryId && !modelCategory.has(model.id)) {
    modelCategory.set(model.id, categoryFromId(model.categoryId));
  }
}

/** Spec category of a ticket / listing / booking-flow params, or null when unknown. */
export function resolveRecordCategory(src) {
  const direct = directCategory(src);
  if (direct || !src?.modelId) return Promise.resolve(direct);
  if (!modelCategory.has(src.modelId)) {
    modelCategory.set(
      src.modelId,
      getModel(src.modelId)
        .then((m) => categoryFromId(m?.categoryId))
        .catch(() => {
          modelCategory.delete(src.modelId);
          return null;
        }),
    );
  }
  return modelCategory.get(src.modelId);
}

/** Hook form of imeiApplies(resolveRecordCategory(src)); true until resolved. */
export function useImeiApplies(src) {
  const [category, setCategory] = useState(() => directCategory(src));
  const deviceCategory = src?.deviceCategory;
  const categoryCode = src?.categoryCode;
  const categoryName = src?.categoryName;
  const modelId = src?.modelId;

  useEffect(() => {
    let alive = true;
    resolveRecordCategory({ deviceCategory, categoryCode, categoryName, modelId }).then((c) => {
      if (alive) setCategory(c);
    });
    return () => { alive = false; };
  }, [deviceCategory, categoryCode, categoryName, modelId]);

  return imeiApplies(category);
}
