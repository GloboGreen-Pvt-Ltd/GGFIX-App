// App-start progress shared by the launch screen and the steps that load the
// first page: fonts (App) → saved login (RootNavigator) → Home data → Home
// images. Progress only moves forward; finishBoot() lets the launch screen fill
// to 100% and fade out. A hard cap guarantees nobody is stuck on it.
import { useSyncExternalStore } from 'react';

const MAX_BOOT_MS = 12000;

let state = { progress: 0.06, label: 'Starting up…', done: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const startedAt = Date.now();

export function setBootProgress(progress, label) {
  if (state.done) return;
  const next = Math.max(state.progress, Math.min(0.97, progress));
  if (next === state.progress && (!label || label === state.label)) return;
  state = { ...state, progress: next, label: label || state.label };
  emit();
}

export function finishBoot() {
  if (state.done) return;
  state = { progress: 1, label: 'Ready', done: true };
  emit();
}

export const isBootDone = () => state.done;

// Never keep the app behind the launch screen for longer than the cap.
setTimeout(finishBoot, Math.max(0, MAX_BOOT_MS - (Date.now() - startedAt)));

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;
export function useBootProgress() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
