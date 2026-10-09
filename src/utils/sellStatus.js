/**
 * Customer sell-order journey (Customer app only), derived from the real sell
 * order (GET /sell-orders/{id}) and its quotations. The status string leads;
 * the order's own fields (quotes, assigned shop, pickup person, verification,
 * payment) back it up. Nothing is invented: a step is done only when the data
 * says so, and SOLD needs the backend's terminal status AND an assigned shop
 * AND no payment that is explicitly still unpaid.
 */
export const SELL_STEPS = [
  { key: 'REQUESTED', label: 'Sell request placed', short: 'Requested' },
  { key: 'EVALUATED', label: 'Device evaluated', short: 'Awaiting quotes' },
  { key: 'QUOTED', label: 'Price quote received', short: 'Quote received' },
  { key: 'ACCEPTED', label: 'Offer accepted', short: 'Offer accepted' },
  { key: 'ORDER_CREATED', label: 'Sell order created', short: 'Order created' },
  { key: 'ASSIGNED', label: 'Pickup / buyer assigned', short: 'Pickup assigned' },
  { key: 'VERIFIED', label: 'Device verified', short: 'Device verified' },
  { key: 'PRICE_CONFIRMED', label: 'Final price confirmed', short: 'Price confirmed' },
  { key: 'PAID', label: 'Payment completed', short: 'Payment completed' },
  { key: 'SOLD', label: 'Selling completed', short: 'Sold' },
];
const LAST = SELL_STEPS.length - 1;

// Backend status → index of the last completed step.
const STATUS_STEP = {};
[
  [0, 'DRAFT'],
  [1, 'PENDING', 'SUBMITTED', 'CREATED', 'OPEN', 'REQUESTED', 'PENDING_QUOTATION', 'AWAITING_QUOTATION', 'UNDER_EVALUATION', 'EVALUATION', 'EVALUATED'],
  [2, 'QUOTED', 'QUOTATION_RECEIVED', 'QUOTATIONS_RECEIVED', 'QUOTES_RECEIVED', 'OFFER_RECEIVED', 'OFFERED'],
  [3, 'ACCEPTED', 'OFFER_ACCEPTED', 'QUOTATION_ACCEPTED', 'QUOTE_ACCEPTED', 'SHOP_SELECTED', 'SELECTED'],
  [4, 'ORDER_CREATED', 'SELL_ORDER_CREATED', 'CONFIRMED', 'ORDER_CONFIRMED', 'PROCESSING', 'IN_PROGRESS'],
  [5, 'PICKUP_ASSIGNED', 'PICKUP_SCHEDULED', 'BUYER_ASSIGNED', 'OUT_FOR_PICKUP', 'PICKUP_IN_PROGRESS', 'PICKED_UP', 'DEVICE_PICKED_UP', 'DEVICE_RECEIVED', 'UNDER_INSPECTION', 'INSPECTION_PENDING'],
  [6, 'DEVICE_VERIFIED', 'VERIFIED', 'INSPECTED', 'INSPECTION_COMPLETED', 'INSPECTION_DONE'],
  [7, 'FINAL_PRICE_CONFIRMED', 'PRICE_CONFIRMED', 'FINAL_PRICE_ACCEPTED', 'PRICE_FINALIZED', 'PAYMENT_PENDING', 'AWAITING_PAYMENT'],
  [8, 'PAYMENT_COMPLETED', 'PAID', 'PAYMENT_DONE', 'PAYMENT_SUCCESS', 'PAYMENT_RECEIVED'],
  [9, 'SOLD', 'COMPLETED', 'SELLING_COMPLETED', 'CLOSED'],
].forEach(([step, ...names]) => names.forEach((n) => { STATUS_STEP[n] = step; }));
const CANCELLED = new Set(['CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'DECLINED']);
const PAID_WORDS = /^(PAID|SUCCESS|SUCCESSFUL|COMPLETED|CAPTURED|SETTLED|DONE)$/;
const CHOSEN_QUOTE = new Set(['ACCEPTED', 'SELECTED', 'CHOSEN', 'APPROVED']);

const up = (v) => String(v ?? '').trim().toUpperCase();
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const first = (...vals) => vals.find((v) => v != null && v !== '') ?? null;

/** so: sell order; quotes: its quotations ([] when unknown). */
export function sellProgress(so, quotes = []) {
  const q = Array.isArray(quotes) ? quotes : [];
  const status = up(so?.status);
  const cancelled = CANCELLED.has(status);
  const chosen = (so?.shopId ? q.find((x) => x.shopId === so.shopId) : null) || q.find((x) => CHOSEN_QUOTE.has(up(x.status))) || null;
  const best = q.reduce((b, x) => (num(x.quotationPrice) && (!b || num(x.quotationPrice) > num(b.quotationPrice)) ? x : b), null);

  const pickup = {
    name: first(so?.pickupPersonName, so?.pickupPerson?.name, so?.buyerName, so?.buyer?.name, so?.assignedToName),
    phone: first(so?.pickupPersonPhone, so?.pickupPerson?.phone, so?.buyerPhone, so?.buyer?.phone, so?.assignedToPhone),
    assignedAt: first(so?.pickupAssignedAt, so?.buyerAssignedAt, so?.assignedAt),
    date: first(so?.pickupDate, so?.scheduledPickupDate, so?.scheduledAt),
    slot: [so?.pickupSlotStart, so?.pickupSlotEnd].filter(Boolean).join(' – ') || first(so?.pickupSlot),
  };
  const verifiedAt = first(so?.verifiedAt, so?.deviceVerifiedAt, so?.inspectedAt, so?.inspectionCompletedAt);
  const verified = !!verifiedAt || so?.deviceVerified === true || /VERIFIED|PASSED|COMPLETED/.test(up(first(so?.verificationStatus, so?.inspectionStatus)));
  const confirmedAt = first(so?.finalPriceConfirmedAt, so?.priceConfirmedAt);
  const confirmedPrice = num(first(so?.confirmedPrice, so?.finalConfirmedPrice));
  const priceConfirmed = !!confirmedAt || !!confirmedPrice || so?.finalPriceConfirmed === true;
  const payStatus = up(first(so?.paymentStatus, so?.payment?.status, so?.payoutStatus));
  const paidAt = first(so?.paidAt, so?.paymentCompletedAt, so?.payment?.paidAt, so?.payment?.completedAt);
  const paid = !!paidAt || PAID_WORDS.test(payStatus);

  const rawStep = STATUS_STEP[status] ?? 1;
  let step = cancelled ? 0 : rawStep;
  // Field evidence can only move the journey forward.
  const ev = Math.max(
    so ? 1 : 0, // the request exists and its evaluation was submitted
    q.length ? 2 : 0,
    so?.shopId || chosen ? 4 : 0, // choosing a quote creates the sell order with that shop
    pickup.name || pickup.phone || pickup.assignedAt ? 5 : 0,
    verified ? 6 : 0,
    priceConfirmed ? 7 : 0,
    paid ? 8 : 0,
  );
  step = Math.max(step, ev);
  // SOLD only after full completion: a buyer exists and payment isn't known-unpaid.
  if (step === LAST && (!(so?.shopId || chosen) || (payStatus && !paid))) step = Math.min(ev, LAST - 1);
  const sold = !cancelled && step === LAST;

  const quoted = num(chosen?.quotationPrice) ?? (so?.shopId ? num(so?.finalPrice) : null);
  // Final price exists once confirmed (fields) or the journey is past that step.
  const final = priceConfirmed || step >= 7 ? (confirmedPrice ?? num(so?.finalPrice) ?? quoted) : null;
  const deductions = Array.isArray(so?.deductions) ? so.deductions.filter((d) => num(d?.amount)) : [];
  const payment = {
    status: payStatus || null,
    paid,
    method: first(so?.paymentMethod, so?.payment?.method, so?.payoutMethod),
    reference: first(so?.paymentReference, so?.transactionId, so?.utr, so?.payment?.reference, so?.payment?.transactionId),
    paidAt,
    amount: num(first(so?.paidAmount, so?.payment?.amount)) ?? (paid ? final : null),
  };
  const quoteAt = q.map((x) => x.createdAt).filter(Boolean).sort()[0] || null;
  const acceptedAt = first(so?.acceptedAt, so?.shopSelectedAt, so?.quotationAcceptedAt);
  const times = [so?.createdAt, so?.createdAt, quoteAt, acceptedAt, acceptedAt, pickup.assignedAt, verifiedAt, confirmedAt, paidAt, first(so?.completedAt, so?.soldAt)];

  const label = cancelled ? 'Cancelled' : sold ? 'Sold' : SELL_STEPS[step].short;
  return {
    step,
    total: SELL_STEPS.length,
    steps: SELL_STEPS.map((s, i) => ({ ...s, done: i <= step && !(cancelled && i > step), at: i <= step ? times[i] || null : null })),
    next: cancelled || sold ? null : SELL_STEPS[step + 1] || null,
    label,
    tone: cancelled ? 'red' : sold ? 'green' : step >= 3 ? 'blue' : step === 2 ? 'green' : 'orange',
    bucket: cancelled ? 'CANCELLED' : sold ? 'COMPLETED' : 'PENDING',
    cancelled,
    sold,
    // Before an offer is accepted the customer can still edit / cancel.
    editable: !cancelled && step < 3 && rawStep < 3,
    quotes: q,
    chosenQuote: chosen,
    bestQuote: best,
    price: { quoted, final, deductions, bestQuote: num(best?.quotationPrice) },
    payment,
    pickup,
  };
}

/** List filter bucket for a customer-orders row before its sell order has loaded. */
export function rowBucket(rowStatus) {
  return CANCELLED.has(up(rowStatus)) || /CANCEL/.test(up(rowStatus)) ? 'CANCELLED' : 'PENDING';
}
