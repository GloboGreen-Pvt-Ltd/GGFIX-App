/**
 * Which app shell a signed-in session may enter.
 *
 * Deliberately free of React / React Native imports so it can be reasoned about
 * — and tested — on its own. navigation/RootNavigator is the only consumer.
 *
 * Three products ship in this one binary and the sign-in chooser decides which
 * one the user is authenticating into:
 *
 *   Customer Login -> POST /auth/customer-login  (customer_users, roles ['CUSTOMER'])
 *   Shop Login     -> POST /auth/login           (loginType SHOP_OWNER | SHOP_LOGIN)
 *   Employee Login -> POST /auth/login           (loginType EMPLOYEE)
 */

// The backend collapses TECHNICIAN / STAFF / PICKUP_PERSON into
// loginType=EMPLOYEE, but keeps the specific role in `roles` — so both signals
// are checked and either one is enough.
export const EMPLOYEE_ROLES = ['TECHNICIAN', 'STAFF', 'PICKUP_PERSON'];

// Back-office identities that sign in on the ADMIN WEB dashboard, never in the
// mobile app. Verified against auth-service: AuthService.loginTypeForRole maps
// entity/Roles.isAdmin (SUPER_ADMIN, ADMIN) to loginType SUPER_ADMIN and
// isMarketPerson to MARKET_PERSON — so MARKET_PERSON is a real value the wire
// can carry and must be recognised here, or it falls through to "unknown role"
// and the user is told the wrong thing about why they're blocked.
export const WEB_ONLY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MARKET_PERSON'];
export const WEB_ONLY_LOGIN_TYPES = ['SUPER_ADMIN', 'MARKET_PERSON'];

/**
 * What KIND of account this session belongs to, independent of which button the
 * user tapped on the chooser. Ordered most-privileged first so an owner who also
 * carries a technician role is never demoted into the employee shell.
 *
 * Returns 'ADMIN' | 'SHOP' | 'EMPLOYEE' | 'CUSTOMER' | null.
 */
export function accountKind(session) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  const loginType = session?.loginType;
  if (WEB_ONLY_LOGIN_TYPES.includes(loginType) || roles.some((r) => WEB_ONLY_ROLES.includes(r))) return 'ADMIN';
  if (loginType === 'SHOP_OWNER' || loginType === 'SHOP_LOGIN' || roles.includes('SHOP_OWNER')) return 'SHOP';
  if (loginType === 'EMPLOYEE' || roles.some((r) => EMPLOYEE_ROLES.includes(r))) return 'EMPLOYEE';
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  return null;
}

// Which account kinds each chooser entry is allowed to admit. Shop Login also
// accepts employees because the shop product has always served in-shop
// technicians (see shop/src/navigation/TechnicianNavigator) — they land on that
// stack rather than the owner one.
export const ENTRY_ACCEPTS = {
  CUSTOMER: ['CUSTOMER'],
  SHOP: ['SHOP', 'EMPLOYEE'],
  EMPLOYEE: ['EMPLOYEE'],
};

export const ENTRY_LABEL = {
  CUSTOMER: 'Customer Login',
  SHOP: 'Shop Login',
  EMPLOYEE: 'Employee Login',
};

export const KIND_LABEL = {
  ADMIN: 'an admin-web account',
  SHOP: 'a shop account',
  EMPLOYEE: 'an employee account',
  CUSTOMER: 'a customer account',
};

/** The chooser entry an account of this kind SHOULD have used. */
export function suggestedEntry(kind) {
  if (kind === 'SHOP') return 'SHOP';
  if (kind === 'EMPLOYEE') return 'EMPLOYEE';
  return 'CUSTOMER';
}

/**
 * Pick the app shell for a signed-in session.
 *
 * `session.loginShell` records which chooser entry was used and is persisted
 * with the session, so a cold start restores the same shell rather than
 * re-deriving one. It is validated against the account's real kind on every
 * resolve — a stale or hand-edited tag can never grant a shell the roles don't
 * allow. Sessions created before the chooser existed carry no tag and fall
 * through to pure role inference, which is also what a shop switch relies on
 * (switchShop re-saves the raw login response and drops the tag).
 *
 * Returns { shell, kind, chosen } where shell is one of
 * 'CUSTOMER' | 'SHOP_OWNER' | 'SHOP_TECHNICIAN' | 'EMPLOYEE' | 'MISMATCH' | 'UNSUPPORTED'.
 */
export function resolveShell(session) {
  const kind = accountKind(session);
  const chosen = session?.loginShell || null;

  if (kind === null || kind === 'ADMIN') return { shell: 'UNSUPPORTED', kind, chosen };
  if (chosen && !(ENTRY_ACCEPTS[chosen] || []).includes(kind)) {
    return { shell: 'MISMATCH', kind, chosen };
  }
  if (kind === 'CUSTOMER') return { shell: 'CUSTOMER', kind, chosen };
  if (kind === 'SHOP') return { shell: 'SHOP_OWNER', kind, chosen };
  // EMPLOYEE kind: Shop Login keeps the shop app's in-shop technician stack;
  // Employee Login (and legacy untagged sessions) get the employee product with
  // its attendance geofence.
  return { shell: chosen === 'SHOP' ? 'SHOP_TECHNICIAN' : 'EMPLOYEE', kind, chosen };
}
