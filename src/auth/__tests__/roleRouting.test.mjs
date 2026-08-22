/**
 * Login routing matrix for the three-shell sign-in chooser.
 *
 * No test runner is configured in this project, and roleRouting.js is
 * deliberately free of React Native imports, so this runs directly on Node:
 *
 *     node src/auth/__tests__/roleRouting.test.mjs
 *
 * Session shapes below are the REAL ones the backend returns — verified against
 * auth-service (AuthService.loginTypeForRole, CustomerAuthService.CUSTOMER_ROLES,
 * entity/Roles) rather than invented.
 */
import { resolveShell, accountKind, suggestedEntry } from '../roleRouting.js';

let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n          expected=${expected}  actual=${actual}`}`);
};

// Real login-response shapes, per src/api/auth.js + shop/src/api/auth.js.
const customer = { roles: ['CUSTOMER'] };
const shopOwner = { roles: ['SHOP_OWNER'], loginType: 'SHOP_OWNER' };
const shopMobile = { roles: [], loginType: 'SHOP_LOGIN', loginScope: 'SHOP' };
const technician = { roles: ['TECHNICIAN'], loginType: 'EMPLOYEE' };
const pickup = { roles: ['PICKUP_PERSON'], loginType: 'EMPLOYEE' };
const staff = { roles: ['STAFF'], loginType: 'EMPLOYEE' };
const admin = { roles: ['SUPER_ADMIN'], loginType: 'SUPER_ADMIN' };
const ownerAlsoTech = { roles: ['SHOP_OWNER', 'TECHNICIAN'], loginType: 'SHOP_OWNER' };
const tag = (s, shell) => ({ ...s, loginShell: shell });

console.log('\n[accountKind]');
t('customer                    -> CUSTOMER', accountKind(customer), 'CUSTOMER');
t('shop owner                  -> SHOP', accountKind(shopOwner), 'SHOP');
t('shop-mobile (SHOP_LOGIN)    -> SHOP', accountKind(shopMobile), 'SHOP');
t('technician                  -> EMPLOYEE', accountKind(technician), 'EMPLOYEE');
t('pickup person               -> EMPLOYEE', accountKind(pickup), 'EMPLOYEE');
t('staff                       -> EMPLOYEE', accountKind(staff), 'EMPLOYEE');
t('super admin                 -> ADMIN', accountKind(admin), 'ADMIN');
t('owner+technician            -> SHOP (not demoted)', accountKind(ownerAlsoTech), 'SHOP');
t('empty session               -> null', accountKind({}), null);
t('null session                -> null', accountKind(null), null);
t('roles not an array          -> null', accountKind({ roles: 'CUSTOMER' }), null);

console.log('\n[happy path: chosen entry matches the account]');
t('Customer Login + customer   -> CUSTOMER',        resolveShell(tag(customer, 'CUSTOMER')).shell, 'CUSTOMER');
t('Shop Login + owner          -> SHOP_OWNER',      resolveShell(tag(shopOwner, 'SHOP')).shell, 'SHOP_OWNER');
t('Shop Login + shop mobile    -> SHOP_OWNER',      resolveShell(tag(shopMobile, 'SHOP')).shell, 'SHOP_OWNER');
t('Employee Login + technician -> EMPLOYEE',        resolveShell(tag(technician, 'EMPLOYEE')).shell, 'EMPLOYEE');
t('Employee Login + pickup     -> EMPLOYEE',        resolveShell(tag(pickup, 'EMPLOYEE')).shell, 'EMPLOYEE');
t('Shop Login + technician     -> SHOP_TECHNICIAN', resolveShell(tag(technician, 'SHOP')).shell, 'SHOP_TECHNICIAN');

console.log('\n[guard: wrong entry for the account]');
t('Customer Login + owner      -> MISMATCH', resolveShell(tag(shopOwner, 'CUSTOMER')).shell, 'MISMATCH');
t('Customer Login + technician -> MISMATCH', resolveShell(tag(technician, 'CUSTOMER')).shell, 'MISMATCH');
t('Shop Login + customer       -> MISMATCH', resolveShell(tag(customer, 'SHOP')).shell, 'MISMATCH');
t('Employee Login + customer   -> MISMATCH', resolveShell(tag(customer, 'EMPLOYEE')).shell, 'MISMATCH');
t('Employee Login + owner      -> MISMATCH', resolveShell(tag(shopOwner, 'EMPLOYEE')).shell, 'MISMATCH');

console.log('\n[blocked accounts]');
t('super admin, any entry      -> UNSUPPORTED', resolveShell(tag(admin, 'SHOP')).shell, 'UNSUPPORTED');
t('super admin, untagged       -> UNSUPPORTED', resolveShell(admin).shell, 'UNSUPPORTED');
t('unknown role                -> UNSUPPORTED', resolveShell({ roles: ['WHO'] }).shell, 'UNSUPPORTED');
t('no roles at all             -> UNSUPPORTED', resolveShell({}).shell, 'UNSUPPORTED');

console.log('\n[legacy / untagged sessions fall back to role inference]');
t('untagged customer           -> CUSTOMER',   resolveShell(customer).shell, 'CUSTOMER');
t('untagged owner              -> SHOP_OWNER', resolveShell(shopOwner).shell, 'SHOP_OWNER');
t('untagged technician         -> EMPLOYEE',   resolveShell(technician).shell, 'EMPLOYEE');
t('post-switchShop (tag lost)  -> SHOP_OWNER', resolveShell({ ...shopOwner, loginShell: undefined }).shell, 'SHOP_OWNER');

console.log('\n[tampered tag cannot escalate]');
t('customer forging SHOP tag   -> MISMATCH (not SHOP_OWNER)', resolveShell({ ...customer, loginShell: 'SHOP' }).shell, 'MISMATCH');
t('employee forging SHOP tag   -> SHOP_TECHNICIAN, never SHOP_OWNER', resolveShell({ ...technician, loginShell: 'SHOP' }).shell, 'SHOP_TECHNICIAN');
t('garbage tag + customer      -> MISMATCH', resolveShell({ ...customer, loginShell: 'ROOT' }).shell, 'MISMATCH');

console.log('\n[mismatch copy names the right entry]');
t('owner told to use Shop Login',    suggestedEntry(accountKind(shopOwner)), 'SHOP');
t('technician told to use Employee', suggestedEntry(accountKind(technician)), 'EMPLOYEE');
t('customer told to use Customer',   suggestedEntry(accountKind(customer)), 'CUSTOMER');

console.log('');
console.log('[admin-web identities are blocked, not misrouted]');
const marketPerson = { roles: ['MARKET_PERSON'], loginType: 'MARKET_PERSON' };
const plainAdmin   = { roles: ['ADMIN'], loginType: 'SUPER_ADMIN' };
t('MARKET_PERSON               -> ADMIN kind', accountKind(marketPerson), 'ADMIN');
t('ADMIN role                  -> ADMIN kind', accountKind(plainAdmin), 'ADMIN');
t('MARKET_PERSON + Shop Login  -> UNSUPPORTED', resolveShell(tag(marketPerson, 'SHOP')).shell, 'UNSUPPORTED');
t('MARKET_PERSON + Empl Login  -> UNSUPPORTED', resolveShell(tag(marketPerson, 'EMPLOYEE')).shell, 'UNSUPPORTED');
t('ADMIN, untagged             -> UNSUPPORTED', resolveShell(plainAdmin).shell, 'UNSUPPORTED');
t('MARKET_PERSON never leaks into EMPLOYEE', resolveShell(marketPerson).shell !== 'EMPLOYEE', true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
