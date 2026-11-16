import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wrench, BatteryMedium, Cpu, Zap, Volume2, Aperture, LayoutGrid, Smartphone, Droplets, Headphones, Wifi, Layers,
  Cog, Database, Keyboard as KeyboardIcon, HardDrive, Fan, ShieldCheck, Bluetooth, CreditCard, Square, Stethoscope,
  Gauge, SignalHigh, UserCog, ShieldAlert, Hand, FingerprintPattern as Fingerprint,
  Check, X, ChevronDown, Search, MessageSquarePlus,
} from 'lucide-react-native';
import { rf, rlh } from '../../../utils/responsive';
import { getRepairServiceIcon } from './repairServiceIcons';

// Repair-issue picker in the Partner app's "Devices & Repair" design
// (RepairIssuesPicker): search bar, a compact grid of issue GROUP tiles, a
// bottom sheet with each group's issues, and the picked-issue rows.
// Presentation only — the screen owns the selection state.

const ACCENT = '#035C6C';
const MINT = '#E5F3F5';
const MINT_LINE = '#C7E6EA';
const INK = '#111111';
const MUTED = '#6B7280';
const PLACEHOLDER = '#9CA3AF';
const LINE = '#E5E7EB';

// Issue groups shown before "View All" (the "Other Issue" tile is extra).
const FIRST_TILES = 8;
// These groups first, the rest after in API order (same as the Partner app).
const TILE_ORDER = [/dead|no power/i, /display|screen/i, /battery/i, /motherboard|mainboard|sub-?board/i, /network/i, /security/i];
const tileRank = (name) => {
  const i = TILE_ORDER.findIndex((re) => re.test(String(name || '')));
  return i === -1 ? TILE_ORDER.length : i;
};

// One icon per issue group, matched by keyword on the group name (Partner
// app's groupIconFor); the group code is tried when the name matches nothing.
function matchGroupIcon(text) {
  const n = String(text || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (/screen|display/.test(n)) return Smartphone;
  if (/battery|power/.test(n)) return BatteryMedium;
  if (/(audio.*camera)|(camera.*audio)/.test(n)) return Headphones;
  if (/camera/.test(n)) return Aperture;
  if (/charg|port/.test(n)) return Zap;
  if (/speaker|microphone|audio/.test(n)) return Volume2;
  if (/bluetooth|wireless/.test(n)) return Bluetooth;
  if (/signal|reception|network drop/.test(n)) return SignalHigh;
  if (/network|connectivity|wifi/.test(n)) return Wifi;
  if (/fingerprint|face id|face unlock|touch id/.test(n)) return Fingerprint;
  if (/touch/.test(n)) return Hand;
  if (/button|sensor/.test(n)) return LayoutGrid;
  if (/\bsim\b|sim card|sim tray/.test(n)) return CreditCard;
  if (/back panel|back glass|back cover|\bbody\b/.test(n)) return Layers;
  if (/\bframe\b|bezel/.test(n)) return Square;
  if (/diagnos/.test(n)) return Stethoscope;
  if (/performance|\blag\b|slow/.test(n)) return Gauge;
  if (/software|\bos\b|operating system/.test(n)) return Cog;
  if (/water|liquid/.test(n)) return Droplets;
  if (/motherboard|hardware/.test(n)) return Cpu;
  if (/data|backup/.test(n)) return Database;
  if (/keyboard|touchpad/.test(n)) return KeyboardIcon;
  if (/storage/.test(n)) return HardDrive;
  if (/overheat|cooling/.test(n)) return Fan;
  if (/restrict/.test(n)) return ShieldAlert;
  if (/virus|security/.test(n)) return ShieldCheck;
  if (/account|sign.?in|login/.test(n)) return UserCog;
  return null;
}
export function groupIconFor(name, code) {
  return matchGroupIcon(name) || matchGroupIcon(String(code || '').replace(/_/g, ' ')) || Wrench;
}

function imgUri(item) {
  const b64 = item?.iconBase64 && String(item.iconBase64).trim();
  if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  const url = item?.iconUrl && String(item.iconUrl).trim();
  return url || null;
}

// An issue's icon: the admin-uploaded icon when there is one, else the
// per-service lucide icon.
export function IssueGlyph({ item, groupCode, groupName, size = 19, color = INK }) {
  const uri = imgUri(item);
  if (uri) return <Image source={{ uri }} style={{ width: size + 3, height: size + 3, borderRadius: 4 }} resizeMode="cover" />;
  const Icon = getRepairServiceIcon(item?.name, groupCode, groupName);
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}

// An issue's display name with its typed note in brackets — what Review,
// the receipt and the booking's service rows show.
export const issueLabel = (s) => (s?.note ? `${s.name} (${s.note})` : (s?.name || ''));

// Square checkbox used by the search results and the group sheet.
function Tick({ on }) {
  return (
    <View style={{ height: 20, width: 20, borderRadius: 6, borderWidth: 1.5, borderColor: on ? ACCENT : '#C9CFC9', backgroundColor: on ? ACCENT : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
    </View>
  );
}

const issueRowStyle = (on) => ({
  minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
  borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : LINE, backgroundColor: on ? MINT : '#FFFFFF',
});

// One group's issues: checkbox row + "Additional notes (optional)" each
// (Display Replacement first). A note can be typed first; the issue is only
// selected by tapping its row, and then carries the note.
// onRowPress (default onToggle) runs on a row tap — the sheet uses it to
// select and close in one tap.
export function GroupIssueList({ group, selectedIds, onToggle, onRowPress, notes = {}, onNoteChange, onNoteFocus }) {
  const picked = new Set(selectedIds || []);
  const rowY = useRef({}).current; // issue id → y in the list, for scroll-to-note
  const issues = [...(group?.issues || [])].sort((a, b) => (/display\s*replacement/i.test(b.name) ? 1 : 0) - (/display\s*replacement/i.test(a.name) ? 1 : 0));
  return issues.map((s) => {
    const on = picked.has(s.id);
    return (
      <View key={s.id} style={{ marginBottom: 8 }} onLayout={(e) => { rowY[s.id] = e.nativeEvent.layout.y; }}>
        <Pressable
          onPress={() => (onRowPress || onToggle)(s.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={s.name}
          className="active:opacity-80"
          style={issueRowStyle(on)}
        >
          <IssueGlyph item={s} groupCode={group.code} groupName={group.name} size={19} color={on ? ACCENT : INK} />
          <Text style={{ flex: 1, marginLeft: 12, fontSize: rf(13), fontWeight: on ? '700' : '500', color: INK }} numberOfLines={2}>{s.name}</Text>
          <Tick on={on} />
        </Pressable>
        {onNoteChange ? (
          <TextInput
            value={notes[s.id] || ''}
            onChangeText={(t) => onNoteChange(s.id, t)}
            onFocus={() => onNoteFocus?.(rowY[s.id] || 0)}
            placeholder="Additional notes (optional)"
            placeholderTextColor={PLACEHOLDER}
            maxLength={120}
            cursorColor={ACCENT}
            accessibilityLabel={`Additional notes for ${s.name}`}
            style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: on && notes[s.id] ? ACCENT : LINE, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(13), color: INK }}
          />
        ) : null}
      </View>
    );
  });
}

// Compact group tile — icon over a two-line label; picked = teal edge, mint
// fill and a count badge.
function IssueTile({ name, Icon, picked, open = false, onPress }) {
  const on = picked > 0 || open;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${picked > 0 ? `, ${picked} selected` : ''}`}
      className="active:opacity-80"
      style={{
        minHeight: 74, paddingHorizontal: 4, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : LINE, backgroundColor: on ? MINT : '#FFFFFF',
      }}
    >
      {picked > 0 ? (
        <View style={{ position: 'absolute', top: 5, right: 5, height: 16, minWidth: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>{picked}</Text>
        </View>
      ) : null}
      <Icon size={22} color={on ? ACCENT : INK} strokeWidth={1.75} />
      <Text style={{ marginTop: 6, fontSize: rf(11.5), lineHeight: rlh(14), fontWeight: on ? '700' : '500', color: INK, textAlign: 'center' }} numberOfLines={2}>
        {name}
      </Text>
    </Pressable>
  );
}

// One picked issue: icon tile · name (+ caption) · optional remove (Partner
// SelectedIssueRow without the price / warranty boxes — customers don't price).
export function SelectedIssueRow({ name, sub, glyph, onRemove }) {
  return (
    <View style={{ marginBottom: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: MINT_LINE, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ height: 36, width: 36, borderRadius: 10, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {glyph}
      </View>
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 }}>
        <Text style={{ fontSize: rf(13), fontWeight: '600', color: INK }} numberOfLines={2}>{name}</Text>
        {sub ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          className="active:opacity-70"
          style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: 'rgba(220, 38, 38, 0.10)', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color="#DC2626" />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Search + issue-group grid + group sheet.
 *   groups          [{ id, name, code, issues: [...] }] (as loaded by the screen)
 *   selectedIds     picked issue ids; onToggle(id) selects / unselects one
 *   notes           { [issueId]: text } — "Additional notes" typed in the sheet;
 *                   onNoteChange(id, text) (typing does not select the issue)
 *   otherPicked     a custom "Other" issue is filled in; otherOpen = its editor is open
 *   onOtherPress    "Other Issue" tile tapped
 *   onAddTypedOther(text)  search had no match — use the typed text as the Other issue
 */
export default function RepairIssueGroups({ groups, selectedIds, onToggle, notes = {}, onNoteChange, otherPicked = false, otherOpen = false, onOtherPress, onAddTypedOther, isTablet = false }) {
  const insets = useSafeAreaInsets();
  // Keyboard while typing a note: the sheet stays a compact popup — it sits on
  // top of the keyboard (lifted only by what the system didn't already resize)
  // and its list shrinks to about half the space left, so the page still shows
  // above it. The focused note scrolls into view.
  const sheetListRef = useRef(null);
  const [kbH, setKbH] = useState(0);
  const [areaH, setAreaH] = useState(0);
  const baseAreaH = useRef(0);
  if (!kbH && areaH) baseAreaH.current = areaH;
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKbH(Math.round(e?.endCoordinates?.height || 0)));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const resizedBy = kbH && baseAreaH.current && areaH ? Math.max(0, baseAreaH.current - areaH) : 0;
  const kbLift = kbH ? Math.max(0, kbH - resizedBy) : 0;
  const listMax = kbH ? Math.max(150, Math.min(460, ((baseAreaH.current || 700) - kbH) * 0.5)) : 460;
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sheetId, setSheetId] = useState(null);
  const picked = useMemo(() => new Set(selectedIds), [selectedIds]);

  const tileGroups = useMemo(() => (groups || [])
    .map((g, i) => ({ g, i }))
    .sort((a, b) => tileRank(a.g.name) - tileRank(b.g.name) || a.i - b.i)
    .map(({ g }) => g), [groups]);
  const visibleGroups = showAll ? tileGroups : tileGroups.slice(0, FIRST_TILES);

  // Every issue of this device category matching the typed text — names that
  // START with it first, then the rest A–Z.
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    const seen = new Set();
    const out = [];
    (groups || []).forEach((g) => (g.issues || []).forEach((s) => {
      if (seen.has(s.id) || !String(s.name || '').toLowerCase().includes(q)) return;
      seen.add(s.id);
      out.push({ s, g });
    }));
    return out.sort((a, b) => {
      const sa = String(a.s.name).toLowerCase().startsWith(q) ? 0 : 1;
      const sb = String(b.s.name).toLowerCase().startsWith(q) ? 0 : 1;
      return sa - sb || String(a.s.name).localeCompare(String(b.s.name));
    }).slice(0, 12);
  }, [q, groups]);

  const addTyped = () => {
    const text = query.trim();
    if (!text) return;
    onAddTypedOther?.(text);
    setQuery('');
  };

  const sheetGroup = (groups || []).find((g) => g.id === sheetId) || null;
  const SheetIcon = sheetGroup ? groupIconFor(sheetGroup.name, sheetGroup.code) : null;
  const cols = isTablet ? 5 : 3;

  const rowStyle = (on) => ({
    minHeight: 48, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: on ? 1.5 : 1, borderColor: on ? ACCENT : LINE, backgroundColor: on ? MINT : '#FFFFFF',
  });

  return (
    <View>
      {/* Search issues — e.g. "display", "battery", "face id". */}
      <View style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#F9FAFB', paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Search size={17} color={MUTED} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => { if (q && matches.length === 0) addTyped(); }}
          placeholder="Search issue (e.g. display, battery)"
          placeholderTextColor={PLACEHOLDER}
          returnKeyType="search"
          autoCorrect={false}
          cursorColor={ACCENT}
          style={{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(13.5), color: INK, includeFontPadding: false }}
          accessibilityLabel="Search repair issue"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear issue search">
            <X size={16} color={MUTED} />
          </Pressable>
        ) : null}
      </View>

      {q ? (
        // Matching issues, shown as you type — tap to select / unselect.
        <View style={{ marginBottom: 4 }}>
          {matches.map(({ s, g }) => {
            const on = picked.has(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => onToggle(s.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className="active:opacity-80"
                style={rowStyle(on)}
              >
                <IssueGlyph item={s} groupCode={g.code} groupName={g.name} size={18} color={on ? ACCENT : INK} />
                <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                  <Text style={{ fontSize: rf(13), fontWeight: on ? '700' : '600', color: INK }} numberOfLines={2}>{s.name}</Text>
                  <Text style={{ fontSize: rf(11), color: MUTED }} numberOfLines={1}>{g.name}</Text>
                </View>
                <Tick on={on} />
              </Pressable>
            );
          })}
          {matches.length === 0 ? (
            <Pressable
              onPress={addTyped}
              accessibilityRole="button"
              className="active:opacity-80"
              style={{ minHeight: 46, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: ACCENT, backgroundColor: MINT, flexDirection: 'row', alignItems: 'center' }}
            >
              <MessageSquarePlus size={18} color={ACCENT} strokeWidth={1.75} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(13), color: INK }} numberOfLines={2}>
                No matching issue — add <Text style={{ fontWeight: '800' }}>“{query.trim()}”</Text> as Other Issue
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        // Issue groups — 3 per row on phones, 5 on tablets (hidden while searching).
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
            {visibleGroups.map((g) => {
              const count = (g.issues || []).filter((s) => picked.has(s.id)).length;
              return (
                <View key={g.id} style={{ width: `${100 / cols}%`, padding: 3 }}>
                  <IssueTile name={g.name} Icon={groupIconFor(g.name, g.code)} picked={count} onPress={() => setSheetId(g.id)} />
                </View>
              );
            })}
            <View style={{ width: `${100 / cols}%`, padding: 3 }}>
              <IssueTile name="Other Issue" Icon={MessageSquarePlus} picked={otherPicked ? 1 : 0} open={otherOpen} onPress={onOtherPress} />
            </View>
          </View>
          {tileGroups.length > FIRST_TILES ? (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              accessibilityRole="button"
              className="active:opacity-70"
              style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: ACCENT }}>
                {showAll ? 'Show less' : `View All (${tileGroups.length})`}
              </Text>
              <ChevronDown size={14} color={ACCENT} style={{ marginLeft: 2, transform: [{ rotate: showAll ? '180deg' : '0deg' }] }} />
            </Pressable>
          ) : null}
        </>
      )}

      {/* A group's issues (Partner sheet). One tap on an issue row selects (or
          unselects) it and closes the sheet; the optional "Additional notes"
          box under each issue can be typed into without closing it. */}
      <Modal visible={!!sheetGroup} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSheetId(null)}>
        <Pressable
          onPress={() => setSheetId(null)}
          onLayout={(e) => setAreaH(Math.round(e.nativeEvent.layout.height))}
          style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation && e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 20, borderTopRightRadius: 20, marginBottom: kbLift,
              paddingTop: 10, paddingHorizontal: 16, paddingBottom: kbH ? 12 : Math.max(insets.bottom, 12) + 8,
            }}
          >
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 10 }} />
            {sheetGroup ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <SheetIcon size={20} color={INK} strokeWidth={1.75} />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: rf(15), fontWeight: '800', color: INK }} numberOfLines={1}>{sheetGroup.name}</Text>
                  <Pressable onPress={() => setSheetId(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                    <X size={20} color={MUTED} />
                  </Pressable>
                </View>
                <ScrollView ref={sheetListRef} style={{ maxHeight: listMax }} keyboardShouldPersistTaps="handled">
                  <GroupIssueList
                    group={sheetGroup}
                    selectedIds={selectedIds}
                    onToggle={onToggle}
                    onRowPress={(id) => { onToggle(id); setSheetId(null); }}
                    notes={notes}
                    onNoteChange={onNoteChange}
                    onNoteFocus={(y) => setTimeout(() => sheetListRef.current?.scrollTo({ y: Math.max(0, y - 6), animated: true }), 250)}
                  />
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
