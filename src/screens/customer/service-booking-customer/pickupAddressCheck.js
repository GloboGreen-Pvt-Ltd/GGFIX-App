// Final pickup serviceability check against the ACTUAL pickup address (its own
// verified coords, cross-checked with its PIN area) — not the search PIN.
// Shared by Shop Details (Continue) and Review & Confirm (submit).
import { getShop } from '../../../api/shops';
import { listAddresses } from '../../../api/customer';
import { eligiblePickupShops, PICKUP_MAX_KM } from '../../../utils/pickupDistance';
import { checkAddressLocation } from '../../../utils/pinGeocode';

// → { ok: true, address } | { ok: false, title, message, needAddress }
export async function verifyPickupAddress(addressId, shopId) {
  const list = await listAddresses().catch(() => []);
  const a = (list || []).find((x) => String(x.id) === String(addressId))
    || (addressId == null ? ((list || []).find((x) => x.isDefault) || (list || [])[0]) : null);
  if (!a) return { ok: false, needAddress: true, title: 'Select Pickup Address', message: 'Choose a pickup address to continue.' };
  const loc = await checkAddressLocation(a);
  if (!loc.coords || !loc.trusted) {
    return {
      ok: false, needAddress: true, title: 'Verify Pickup Address',
      message: loc.coords
        ? "This address's map location does not match its PIN code. Edit the address and set its exact location."
        : 'This address has no map location. Edit it to set the exact location, or choose another address.',
    };
  }
  if (!shopId) return { ok: true, address: a };
  const shop = await getShop(shopId, { lat: loc.coords.lat, lng: loc.coords.lng });
  // Recompute from verified coords; never trust a server distance.
  const elig = eligiblePickupShops([shop], loc.coords, PICKUP_MAX_KM);
  if (!elig.length) {
    return { ok: false, needAddress: true, title: 'Pickup unavailable', message: `Pickup is available only within ${PICKUP_MAX_KM} km of the shop. Please choose another address.` };
  }
  return { ok: true, address: a };
}
