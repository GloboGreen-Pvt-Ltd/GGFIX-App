// Devices already finished on Devices & Repair ("Add Another Device") while
// the customer goes on to pick the next one. Review & Confirm books each of
// them — same shop, address and pickup slot — before the current device, and
// Customer Details (the booking's first step) starts with an empty list.
// Entry: { entryId, device, services, media, bookingExtras }.
let entries = [];

export function getCartDevices() {
  return entries;
}

// Add or replace (same entryId) — going Back and adding again never duplicates.
export function upsertCartDevice(entry) {
  entries = [...entries.filter((e) => e.entryId !== entry.entryId), entry];
}

export function removeCartDevice(entryId) {
  entries = entries.filter((e) => e.entryId !== entryId);
}

export function clearCartDevices() {
  entries = [];
}
