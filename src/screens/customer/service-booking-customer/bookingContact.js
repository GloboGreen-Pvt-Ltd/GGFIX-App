// Contact details typed on the repair booking's Customer Details step
// (RepairSelectDevice). The device pickers in between don't forward extra
// params, so the step keeps them here; Review & Confirm reads them when it
// builds the booking and clears them once the booking is placed.
let contact = null;

export function setBookingContact(next) {
  contact = next || null;
}

export function getBookingContact() {
  return contact;
}
