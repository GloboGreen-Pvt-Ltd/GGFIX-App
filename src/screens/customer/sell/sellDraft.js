import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../../../store';
import { createDraftStore, deviceId, isDraftable, trailOf, isFlowRoute } from './sellDraftCore';

// Sell flow drafts, kept on this phone only (the server has no sell-order draft
// API). Scoped per signed-in customer and keyed by device selection, so the same
// device updates its own draft (never duplicates). Writes are serialized.
// A draft is removed only after a successful submit (or by the customer).
// Owner key: userId; older saved sessions may lack it → stable mobile/email fallback.
const ownerId = () => { const a = store.getState()?.auth || {}; return a.userId || a.mobile || a.email || null; };
const drafts = createDraftStore(AsyncStorage, ownerId);
// Route keys of a flow that was submitted: its screens may still blur/unmount
// after the clear, and must not write the draft back.
const finished = new Set();

export const listSellDrafts = () => drafts.list().catch(() => []);
export const getSellDraft = async () => (await listSellDrafts())[0] || null;
export const deleteSellDraft = (id) => drafts.remove(id).catch(() => {});

export function saveSellDraft(route, state, navigation, opts) {
  if (!route?.name || finished.has(route.key) || !isDraftable(route.params)) return Promise.resolve();
  let trail = null;
  try { trail = trailOf(navigation?.getState()?.routes, route.key); } catch (_) {}
  return drafts.save({ name: route.name, params: route.params, state, trail }, opts).catch(() => {});
}

/** After a successful submit: remove only this device's draft and stop this flow's screens saving. */
export function clearSellDraft(navigation, params) {
  let p = params;
  try {
    const s = navigation?.getState();
    (s?.routes || []).forEach((r) => finished.add(r.key));
    if (!p) p = s?.routes?.[s.index]?.params;
  } catch (_) {}
  return deleteSellDraft(deviceId(p || {}));
}

/** The draft state saved for this screen, when it was opened from "Continue Selling". */
export const restoredState = (route) => (route?.params?.draftState?.route === route?.name ? route.params.draftState.state : null);

/**
 * Resume a draft at its exact step, rebuilding the earlier flow screens under it
 * (each with its own saved values) so Back walks the steps instead of jumping out.
 */
export function continueSellDraft(navigation, draft) {
  const withState = (r) => ({ name: r.name, params: { ...r.params, draftState: { route: r.name, state: draft.steps?.[r.name] ?? null } } });
  let trail = (draft.trail || []).filter((r) => r?.name);
  if (!trail.length || trail[trail.length - 1].name !== draft.routeName) trail = [...trail, { name: draft.routeName, params: draft.params }];
  try {
    let nav = navigation;
    let s = nav.getState();
    if (s?.type === 'tab' && nav.getParent()) { nav = nav.getParent(); s = nav.getState(); }
    const base = (s?.routes || []).slice(0, (s?.index ?? 0) + 1).filter((r) => !isFlowRoute(r.name));
    if (s?.type === 'stack' && base.length && trail.every((r) => s.routeNames?.includes(r.name))) {
      const routes = [...base, ...trail.map(withState)];
      nav.reset({ ...s, index: routes.length - 1, routes });
      return;
    }
  } catch (_) {}
  const last = trail[trail.length - 1];
  navigation.navigate(last.name, withState(last).params);
}

/**
 * Autosave one Sell step: debounced on `state` changes, immediately on blur
 * (step navigation), on Back (beforeRemove) and when the app goes to background.
 */
export function useSellDraft(route, state) {
  const navigation = useNavigation();
  const ref = useRef({ route, state, leaving: false });
  ref.current = { ...ref.current, route, state };
  const save = useCallback(() => saveSellDraft(ref.current.route, ref.current.state, navigation,
    ref.current.leaving ? { leaving: true } : undefined), [navigation]);
  const sig = JSON.stringify(state ?? null);
  useEffect(() => {
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
  }, [sig, save]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') save(); });
    return () => sub.remove();
  }, [save]);
  useEffect(() => navigation.addListener('beforeRemove', () => { ref.current.leaving = true; save(); }), [navigation, save]);
  useFocusEffect(useCallback(() => () => { save(); }, [save]));
}
