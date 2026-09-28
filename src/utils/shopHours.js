/**
 * Live "is this shop open right now?" from its opening/closing time + working
 * days, evaluated in the shop's timezone.
 *
 * The backend (auth-service PickupShopView) sends:
 *   openingTime: "10:00 AM"   closingTime: "09:00 PM"
 *   workingDays: "MON_FRI" | "MON_SAT" | "MON_SUN"
 *   timezone:    "Asia/Kolkata"
 *
 * isShopOpen() returns true / false, or null when the hours aren't configured
 * (older shops / pre-deploy) so callers can fall back to their previous default.
 */

// Working-day presets → inclusive weekday range (0 = Sun … 6 = Sat).
const DAY_RANGES = {
  MON_FRI: [1, 5],
  MON_SAT: [1, 6],
  MON_SUN: [0, 6],
};

// "10:00 AM" / "9:00 PM" / "09:00 PM" → minutes since midnight; null if unparseable.
function toMinutes(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'AM') { if (h === 12) h = 0; }
  else if (ap === 'PM') { if (h !== 12) h += 12; }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Current { minutes, weekday } in `timeZone`. Uses Intl when the engine supports
// named time zones; otherwise falls back to device-local time (the app is
// India-only and shops are Asia/Kolkata, so device local ≈ shop local).
function nowInZone(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    let hour = parseInt(get('hour'), 10);
    if (hour === 24) hour = 0; // some engines emit "24" at midnight
    const minute = parseInt(get('minute'), 10);
    const weekday = WD[get('weekday')];
    if (!Number.isNaN(hour) && !Number.isNaN(minute) && weekday != null) {
      return { minutes: hour * 60 + minute, weekday };
    }
  } catch (_) { /* Intl time zone unsupported — fall through to device local */ }
  const now = new Date();
  return { minutes: now.getHours() * 60 + now.getMinutes(), weekday: now.getDay() };
}

/**
 * @returns {true|false|null} true = open now, false = closed now,
 *          null = hours unknown (caller decides the fallback).
 */
export function isShopOpen(shop) {
  if (!shop) return null;
  const open = toMinutes(shop.openingTime);
  const close = toMinutes(shop.closingTime);
  if (open == null || close == null) return null;

  const { minutes, weekday } = nowInZone(shop.timezone);

  const range = DAY_RANGES[String(shop.workingDays || '').toUpperCase()];
  if (range && !(weekday >= range[0] && weekday <= range[1])) return false;

  // Normal same-day window, and the overnight case (close past midnight).
  return close > open
    ? (minutes >= open && minutes < close)
    : (minutes >= open || minutes < close);
}
