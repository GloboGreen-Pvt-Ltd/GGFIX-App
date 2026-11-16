/**
 * Single source of truth for the customer bottom tab bar's size — mirrors the
 * partner app's tabBarMetrics.ts so both apps' bars read the same numbers.
 * Shared between `CustomTabBar` (CustomerNavigator.js) and any screen that
 * needs to reserve scroll space below the bar.
 */
import { rs } from '../utils/responsive';

export const TABLET_BREAKPOINT = 600;
// Compact bar (icon + label on every tab, active one in a pill).
export const TAB_BAR_HEIGHT_PHONE = 50;
export const TAB_BAR_HEIGHT_TABLET = 56;
/** Floor applied to `insets.bottom` so a device reporting 0 (old Android
 * 3-button nav) still gets a little breathing room above the nav buttons. */
export const MIN_SAFE_BOTTOM = 8;
/** Clearance kept between the bar and the system navigation when there is one. */
export const BAR_NAV_GAP = 4;

/** Space between the bar and the bottom edge / system navigation. The bar must
 * sit fully ABOVE the inset: on Android 3-button nav the opaque nav bar covers
 * anything inside it, which clipped the capsule's rounded bottom edge + shadow. */
export function getTabBarBottomGap(insetBottom) {
  return insetBottom > 0 ? insetBottom + BAR_NAV_GAP : MIN_SAFE_BOTTOM;
}

export function isTabletWidth(width) {
  return width >= TABLET_BREAKPOINT;
}

/** Tab row height only — excludes the safe-area bottom inset. */
export function getTabBarContentHeight(isTablet) {
  return rs(isTablet ? TAB_BAR_HEIGHT_TABLET : TAB_BAR_HEIGHT_PHONE);
}

/** Full on-screen height of the bar, inset included — what a screen behind it must clear. */
export function getTabBarTotalHeight(isTablet, insetBottom) {
  return getTabBarContentHeight(isTablet) + getTabBarBottomGap(insetBottom);
}
