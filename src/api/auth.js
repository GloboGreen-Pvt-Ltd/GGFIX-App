import { authApi } from './client';
import { saveSession, clearSession, getSession } from '../auth/session';

export async function login(email, { password, otp, shopSlug } = {}) {
  const body = { email };
  if (otp) body.otp = otp;
  else if (password) body.password = password;
  if (shopSlug) body.shopSlug = shopSlug;
  const data = await authApi.post('/auth/login', { body });
  await saveSession(data);
  return data;
}

export async function register(shopName, shopSlug, email, password, name) {
  const data = await authApi.post('/auth/register', {
    body: { shopName, shopSlug, email, password, name },
  });
  return data;
}

/**
 * Sign-up step 1: issue an OTP for a mobile that has NO account yet.
 *
 * Deliberately not `requestOtp` below — that one is the sign-in/reset issuer and
 * 400s for an unknown number, which is the exact opposite of what sign-up needs.
 * This endpoint is the mirror image: it 409s when the number IS already taken,
 * which is how the Create Account screen detects a duplicate.
 */
export async function requestSignupOtp(mobile) {
  return await authApi.post('/auth/customer/signup/otp/send', { body: { mobile } });
}

/**
 * Sign-up step 2: check the code without spending it, so the user can be moved
 * on to the name field while `customerRegister` still re-verifies (and consumes)
 * the same code when the account is finally created.
 */
export async function verifySignupOtp(mobile, otp) {
  return await authApi.post('/auth/customer/signup/otp/verify', { body: { mobile, otp } });
}

/**
 * Sign-up step 3. Pass the verified `otp` — there is no password: customers sign
 * in with a code, so the account is created without one (a later "forgot
 * password" can set one if it is ever needed).
 */
export async function customerRegister({ fullName, email, mobile, otp, password }) {
  const data = await authApi.post('/auth/customer-register', {
    body: { fullName, email, mobile, otp, password },
  });
  const session = {
    accessToken: data.accessToken,
    userId: data.userId,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    roles: data.roles || ['CUSTOMER'],
  };
  await saveSession(session);
  return session;
}

export async function customerLogin({ mobile, email, password, otp }) {
  const body = { mobile, email };
  if (otp) body.otp = otp;
  else if (password) body.password = password;
  const data = await authApi.post('/auth/customer-login', { body });
  const session = {
    accessToken: data.accessToken,
    userId: data.userId,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    roles: data.roles || ['CUSTOMER'],
  };
  await saveSession(session);
  return session;
}

/**
 * Request a login / password-reset OTP for a customer. Email identifiers get a
 * generated 6-digit code emailed via Resend; mobile identifiers use the default
 * 123456. The code is stored on the customer row and verified by customer-login
 * and the reset endpoint. Returns { channel, sent, target, ttlMinutes?, devOtp?, defaultOtp?, email }.
 */
export async function requestOtp(identifier) {
  const isEmail = String(identifier || '').includes('@');
  const body = isEmail ? { email: identifier } : { mobile: identifier };
  return await authApi.post('/auth/customer/otp/send', { body });
}

/**
 * Verify the OTP and set a new customer password. On success the server returns
 * a fresh customer session (auto sign-in) which we persist — the caller routes
 * via onLogin.
 */
export async function resetPassword({ identifier, otp, newPassword }) {
  const isEmail = String(identifier || '').includes('@');
  const body = { otp, password: newPassword };
  if (isEmail) body.email = identifier;
  else body.mobile = identifier;
  const data = await authApi.post('/auth/customer/forgot-password/reset', { body });
  const session = {
    accessToken: data.accessToken,
    userId: data.userId,
    fullName: data.fullName,
    email: data.email,
    mobile: data.mobile,
    roles: data.roles || ['CUSTOMER'],
  };
  await saveSession(session);
  return session;
}

/**
 * Login by SHOP MOBILE NUMBER. Returns a single-shop session — the JWT is
 * locked to one shopId (loginScope=SHOP) and the shop switcher is hidden.
 * Use this when the user wants access to only one specific shop; owner-wide
 * access still goes through `login(email, ...)`.
 */
export async function shopLogin({ mobile, password, otp }) {
  const body = { mobile };
  if (otp) body.otp = otp;
  else if (password) body.password = password;
  const data = await authApi.post('/auth/shop-login', { body });
  await saveSession(data);
  return data;
}

/** Request the dev OTP for a shop mobile (returns it in `devOtp` until a real SMS gateway is wired up). */
export async function requestShopLoginOtp(mobile) {
  return await authApi.post('/auth/shop-login/request-otp', { body: { mobile } });
}

export async function switchShop(shopId) {
  const data = await authApi.post('/auth/switch-shop', { body: { shopId } });
  await saveSession(data);
  return data;
}

/**
 * Fetch the current authenticated owner's full profile + locations from
 * /auth/me, then merge non-secret fields into the persisted session so
 * subsequent screen reads see live data (shopName, shops list, phone,
 * avatar, structured address, etc.). Returns the /auth/me payload.
 *
 * Heals old sessions taken before LoginResponse added shopName/shops.
 */
export async function fetchMe() {
  const me = await authApi.get('/auth/me');
  if (!me || !me.id) return me;
  const prev = (await getSession()) || {};
  // SHOP-scoped sessions (shop-mobile login) must stay locked to the original
  // shopId — never replace the shops list with the owner's full location set,
  // even if /auth/me returns them. Keeping the lock here so screens like the
  // dashboard see only the one shop and the switcher stays hidden.
  const shopScoped = prev.loginScope === 'SHOP';
  const locations = me.locations || [];
  const activeShop = shopScoped
    ? locations.find((s) => s.id === prev.shopId) || null
    : locations.find((s) => s.id === prev.shopId) || locations[0] || null;
  const merged = {
    ...prev,
    userId: me.id,
    name: me.name ?? prev.name,
    email: me.email ?? prev.email,
    phone: me.phone ?? prev.phone,
    secondaryMobile: me.secondaryMobile ?? prev.secondaryMobile,
    avatarUrl: me.avatarUrl ?? prev.avatarUrl,
    idProofUrl: me.idProofUrl ?? prev.idProofUrl,
    personalAddress: me.personalAddress ?? prev.personalAddress,
    addrState: me.addrState ?? prev.addrState,
    addrDistrict: me.addrDistrict ?? prev.addrDistrict,
    addrTaluk: me.addrTaluk ?? prev.addrTaluk,
    addrArea: me.addrArea ?? prev.addrArea,
    addrStreet: me.addrStreet ?? prev.addrStreet,
    addrPincode: me.addrPincode ?? prev.addrPincode,
    emailVerified: me.emailVerified,
    isActive: me.isActive,
    roles: me.role ? [me.role] : (prev.roles || []),
    shops: shopScoped
      ? (activeShop
          ? [{ id: activeShop.id, name: activeShop.name, slug: activeShop.slug, isActive: true }]
          : (prev.shops || []))
      : locations.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          isActive: activeShop ? s.id === activeShop.id : false,
        })),
    shopId: activeShop ? activeShop.id : prev.shopId,
    shopName: activeShop ? activeShop.name : prev.shopName,
    activeShop, // full active shop object: mobile, address, etc.
  };
  await saveSession(merged);
  return merged;
}

export async function logout() {
  await clearSession();
}

/**
 * Update one of the current owner's shops. PATCH semantics — only the fields
 * you include are written; everything else is preserved server-side.
 * Returns the refreshed ShopOwnerView (same shape as GET /auth/shop-owners/{id}).
 */
export async function updateOwnerShop(ownerId, shopId, patch) {
  return await authApi.patch(`/auth/shop-owners/${ownerId}/locations/${shopId}`, { body: patch });
}
