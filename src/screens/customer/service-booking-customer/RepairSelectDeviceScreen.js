import { useLayoutEffect } from 'react';
import { setBookingContact } from './bookingContact';
import { clearCartDevices } from './bookingCart';

// Friendly names for a category code passed from a Home tile.
const CATEGORY_NAMES = {
  SMARTPHONE: 'Smartphones',
  LAPTOP: 'Laptops',
  SMARTWATCH: 'Smartwatches',
  TABLET: 'Tablets',
  AUDIO: 'Audio Devices',
  SPEAKER: 'Speakers',
};

/**
 * Repair booking entry ("RepairSelectDevice" — every Book Repair / category
 * tile / banner / search result still navigates here). The Customer Details
 * step was removed: this starts a fresh booking (signed-in customer, empty
 * device list) and replaces itself with Device Details — the Category screen,
 * with a category from a Home tile pre-selected.
 */
export default function RepairSelectDeviceScreen({ navigation, route }) {
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    const params = route?.params || {};
    const presetCategoryId = params.categoryId || null;
    // A Home tile's categoryId may be a code ('SMARTPHONE') rather than a UUID.
    const categoryCode = typeof presetCategoryId === 'string' && !/^[0-9a-f-]{36}$/i.test(presetCategoryId)
      ? presetCategoryId.toUpperCase()
      : (params.categoryCode || null);
    const categoryName = params.categoryName || (categoryCode && CATEGORY_NAMES[categoryCode]) || null;
    clearCartDevices();
    setBookingContact(null);
    navigation.replace('DeviceDetails', {
      flow: 'REPAIR',
      ...(presetCategoryId ? { categoryId: presetCategoryId, categoryCode, categoryName } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
