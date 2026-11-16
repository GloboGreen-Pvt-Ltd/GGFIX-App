// The server tags customer order / booking numbers with an 8-char uniqueness
// suffix ("#GTS-179-E5A1B2C3") because partner numbers repeat across shops.
// The shop and the customer both know it as "#GTS-179" — same rule as the
// server's CustomerOrderMirrorService.shopFacingNumber.
export function shopNumber(n) {
  if (n == null) return n;
  return String(n).replace(/^(#?[A-Z0-9]TS-\d{3,})-[0-9A-F]{8}$/i, '$1');
}
