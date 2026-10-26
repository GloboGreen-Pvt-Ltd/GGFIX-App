// Soft per-category tile tint behind category artwork (Buy + Sell tabs), the
// same values the Partner app uses, so a category reads as one colour in both.
const CODE_TINT = {
  MOBILE: '#E6F7E3', SMARTPHONE: '#E6F7E3',
  LAPTOP: '#F3ECFF',
  TABLET: '#EAF3FF',
  SMARTWATCH: '#EAF7F2', SMARTWATCHES: '#EAF7F2', WATCH: '#EAF7F2',
  AUDIO: '#FFF0F2', AUDIO_DEVICE: '#FFF0F2', AUDIO_DEVICES: '#FFF0F2',
};
const DEFAULT_TINT = '#F3F5F4';

export function tintFor(code) {
  return CODE_TINT[String(code || '').toUpperCase()] || DEFAULT_TINT;
}
