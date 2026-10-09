// "Other" (typed) devices — a brand / model that isn't in the catalogue.
// They have no master ids, so the typed details travel in the free-text field
// the shop reads: a repair booking's issueSummary, or a sell order's
// deviceConditionSummary ("<condition> | Device (not in catalogue): …").
export const TYPED_DEVICE_TAG = 'Device (not in catalogue): ';
const SEP = ' | ';

// "Lava Blaze 2 Pro · 8 GB / 128 GB · Sea Green" (null for catalogue devices).
export function typedDeviceLine(d) {
  if (!d?.customModel) return null;
  return [
    [d.brandName, d.modelName].filter(Boolean).join(' '),
    [d.ramLabel, d.storageLabel].filter(Boolean).join(' / '),
    d.color,
  ].filter(Boolean).join(' · ') || null;
}

// Splits a stored sell condition summary back into its parts. Plain summaries
// come back unchanged as `condition`.
export function splitTypedSummary(summary) {
  const s = String(summary || '');
  const i = s.indexOf(TYPED_DEVICE_TAG);
  if (i < 0) return { condition: s || null, name: null, specs: null };
  const segs = s.slice(i + TYPED_DEVICE_TAG.length).split(' · ');
  return {
    condition: s.slice(0, i).replace(/\s*\|\s*$/, '') || null,
    name: segs[0] || null,
    specs: segs.slice(1).filter((x) => /\d\s*(GB|TB|MB)\b/i.test(x)).join(' · ') || null,
  };
}

// Sell: append the typed device to the condition summary (never twice).
export function withTypedDevice(condition, d) {
  const base = splitTypedSummary(condition).condition || 'Good';
  const line = typedDeviceLine(d);
  return line ? `${base}${SEP}${TYPED_DEVICE_TAG}${line}` : base;
}
