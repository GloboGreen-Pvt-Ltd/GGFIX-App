/**
 * Re-export of the app-wide session at src/auth/session.js.
 *
 * One persisted session for all three shells: a single token (secure storage),
 * a single stored profile, and a single auth-expired handler — so signing in
 * from any shell is seen by the root navigator, and signing out clears it once.
 */
export * from '../../../src/auth/session';
