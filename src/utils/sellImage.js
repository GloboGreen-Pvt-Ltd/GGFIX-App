// Device image for a sell order — same priority as Sell Device Details
// (useSellOrder): catalogue model image, then the customer's own front photo.
// Relative keys resolve against the media CDN; anything else invalid → null.
export const MEDIA_BASE = 'https://media.ggfix.in';

export function mediaUri(v) {
  const s = v == null ? '' : String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  if (/^(https?:|data:image\/|file:|content:)/i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (/^[A-Za-z0-9+/=]{200,}$/.test(s)) return `data:image/png;base64,${s}`;
  return `${MEDIA_BASE}/${s.replace(/^\/+/, '')}`;
}

export function sellOrderImage(so, model) {
  const b64 = model?.imageBase64 ? String(model.imageBase64).trim() : '';
  return mediaUri(model?.imageUrl)
    || (b64 ? (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`) : null)
    || mediaUri(so?.images?.front) || mediaUri(so?.frontImageUrl)
    || mediaUri(Array.isArray(so?.imageUrls) ? so.imageUrls[0] : null)
    || mediaUri(so?.imageUrl) || mediaUri(so?.device?.imageUrl) || null;
}
