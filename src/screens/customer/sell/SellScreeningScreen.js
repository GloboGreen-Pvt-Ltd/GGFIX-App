import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClipboardList, Smartphone, Hand, TabletSmartphone, Frame, BatteryMedium, Camera, Plug, ClipboardCheck, Check, Wrench } from 'lucide-react-native';
import { Loader } from '../../../components/ui';
import { getScreeningQuestions, getConditionGroups, getConditionOptions, getFunctionalIssues } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND, BRAND_FLOW } from '../../../theme/brand';
import { FlowCta, useHideStackHeader } from '../service-booking-customer/FlowChrome';
import ConditionArt, { artKind, artVariant, deviceShape } from './ConditionArt';
import FunctionalArt from './FunctionalArt';
import { SellStepHeader, SellCard, EditBanner, TickBadge, SellStepBar } from './SellStepChrome';

// Sell step 1 — Device Condition: screening questions, the screen / body
// condition groups and functional issues on one page (formerly three screens:
// Screening → Screen Condition → Functional). Same APIs, fallbacks, edit
// pre-selection and params as before; Continue → SellDeviceConfig.

// "No" answers read as a cross in brand red; everything else as a green tick.
const isNoAnswer = (opt) => /^no\b/i.test(String(opt).trim());

const FALLBACK_GROUPS = [
  { id: 'SCREEN_VISIBLE', code: 'SCREEN_VISIBLE', name: 'Screen Condition on your Device', options: ['No Damage', 'Minor Spot or patches', 'Major Spot or patches', 'Multiple Visible line', 'Discoloration'] },
  { id: 'TOUCH_GLASS', code: 'TOUCH_GLASS', name: 'Touch Glass Condition on your device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches', 'TouchGlass Broken'] },
  { id: 'BACK_PANEL', code: 'BACK_PANEL', name: 'Back Panel Condition on your Device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches or deep scratches', 'Light Cover Marks on Body', 'Heavy Cover Marks on Body', 'Back Panel Broken'] },
  { id: 'SIDE_PANEL', code: 'SIDE_PANEL', name: 'side and Center Panel Condition on your device', options: ['No defects', 'Minor dent or scratches', 'Major dent or heavy scratches', 'Center panel broken or cracked or bend'] },
];
const FALLBACK_ISSUES = ['Battery issue','Battery Replaced Local Market','Flash Light Not Working','Front Camera not working','Back Camera not working','Camera Glass Broken','Sim Slot Broken','Network issues','Speaker not working','Mic not working','Touch Id or Face Id not working','Volume Button not working','WiFi or Bluetooth not working','Charging Port not working','Proximity Sensor not working','Power button not working','Ear Speaker not working or low','Vibrator not working'];

// Display order: Screen → Touch Glass → Back Panel → Side & Center → (others)
const orderRank = (g) => {
  const n = (g.name || g.code || '').toLowerCase();
  if (n.includes('screen')) return 1;
  if (n.includes('touch')) return 2;
  if (n.includes('back')) return 3;
  if (n.includes('side') || n.includes('center')) return 4;
  return 99;
};
const sortGroups = (arr) => [...arr].sort((a, b) => orderRank(a) - orderRank(b));
// Admin master data sometimes glues two options into one label (Back Panel:
// "No defects   1 or 2Minor Scratches"). Each part becomes its own tile with its
// own image; both keep the admin option id (same option / price bucket) and
// send their own label, so the shop sees exactly what was picked.
const splitMerged = (opts) => opts.flatMap((o) => {
  const parts = String(o.label || '').split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [o];
  return parts.map((p, k) => ({ ...o, id: k ? `${o.id}#${k}` : o.id, optionId: o.id, label: p.replace(/(\d)([A-Za-z])/g, '$1 $2') }));
});
// Back Panel always offers "No defects" as its own tile (clean back image), even
// when the admin list lacks it; that tile has no master row (optionId null).
const NO_DEFECTS = /no\s*(defect|damage)/i;
const groupOpts = (g, optsByGroup) => {
  const opts = splitMerged(optsByGroup[g.id]?.length ? optsByGroup[g.id] : (g.options || []).map((o, i) => ({ id: `${g.id}-${i}`, label: o })));
  const isBack = /back/i.test(`${g.name || ''} ${g.code || ''}`);
  return isBack && !opts.some((o) => NO_DEFECTS.test(o.label)) ? [{ id: `${g.id}-no-defects`, label: 'No defects' }, ...opts] : opts;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The server's optionId is a UUID: a split tile sends its admin option's id,
// a built-in fallback option (no master row) sends none.
const optionIdOf = (s) => (UUID_RE.test(String(s.optionId || s.id)) ? (s.optionId || s.id) : null);

// ---- presentation-only helpers ----
const groupIcon = (g) => {
  const n = `${g.name || ''} ${g.code || ''}`.toLowerCase();
  if (n.includes('touch')) return Hand;
  if (n.includes('screen') || n.includes('display')) return Smartphone;
  if (n.includes('back') || n.includes('body')) return TabletSmartphone;
  if (n.includes('side') || n.includes('center') || n.includes('frame')) return Frame;
  if (n.includes('battery') || n.includes('power')) return BatteryMedium;
  if (n.includes('camera')) return Camera;
  if (n.includes('charg') || n.includes('connect')) return Plug;
  return ClipboardCheck;
};
// Text-only groups: column count from the longest label (never truncated).
const colsFor = (opts) => {
  const longest = opts.reduce((m, o) => Math.max(m, String(o.label || '').length), 0);
  if (opts.length <= 1) return 1;
  if (longest <= 14 || (opts.length === 3 && longest <= 20)) return 3;
  if (longest <= 24) return 2;
  return 1;
};
// One picture-tile size for every group on this page (conditions and issues):
// same box, art area and label text; labels get up to 3 lines.
const ART = 52;
const LABEL_LH = rlh(14);
const TILE_H = 10 + ART + 6 + LABEL_LH * 3 + 8;
function ArtTile({ cols, active, onPress, role, label, renderArt }) {
  const bg = active ? BRAND.greenSoft : '#F7F8FB';
  return (
    <View style={{ width: `${100 / cols}%`, padding: 3 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole={role}
        accessibilityState={{ checked: active }}
        style={{ height: TILE_H, borderRadius: 12, paddingTop: 10, paddingHorizontal: 4, alignItems: 'center', backgroundColor: bg, borderWidth: 1.5, borderColor: active ? BRAND.green : '#ECEEF3' }}
      >
        <View style={{ height: ART, justifyContent: 'center' }}>{renderArt(bg)}</View>
        <Text numberOfLines={3} style={{ marginTop: 6, textAlign: 'center', fontSize: rf(11), lineHeight: LABEL_LH, fontWeight: '700', color: active ? BRAND.ink : BRAND.body }}>{label}</Text>
        {active ? <TickBadge /> : null}
      </TouchableOpacity>
    </View>
  );
}

export default function SellScreeningScreen({ navigation, route }) {
  const params = route.params || {};
  useHideStackHeader(navigation);
  const { width } = useWindowDimensions();
  const { device, workingCondition, editSellOrderId, editHints } = params;
  const flow = workingCondition === 'DEAD' ? 'DEAD' : 'WORKING';
  const isEditing = !!editSellOrderId;
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [groups, setGroups] = useState([]);
  const [optsByGroup, setOptsByGroup] = useState({});
  const [selected, setSelected] = useState({}); // groupId -> {id, label, groupCode, groupName}
  const [issues, setIssues] = useState([]);
  const [picked, setPicked] = useState([]); // functional issue ids
  const [loading, setLoading] = useState(true);

  // Prior answers / conditions / issues, indexed for edit pre-selection.
  const prior = useMemo(() => {
    const byQuestionId = {};
    (editHints?.screeningAnswers || []).forEach((a) => { if (a?.questionId && a?.answer) byQuestionId[a.questionId] = a.answer; });
    const byGroupCode = {};
    const byGroupName = {};
    (editHints?.conditions || []).forEach((c) => {
      if (c?.groupCode) byGroupCode[c.groupCode.toUpperCase()] = c;
      if (c?.groupName) byGroupName[c.groupName.trim().toLowerCase()] = c;
    });
    const issueIds = new Set();
    const issueCodes = new Set();
    (editHints?.issues || []).forEach((i) => {
      if (i?.issueId) issueIds.add(i.issueId);
      if (i?.issueCode) issueCodes.add(String(i.issueCode).toLowerCase());
    });
    return { byQuestionId, byGroupCode, byGroupName, issueIds, issueCodes };
  }, [editHints]);

  // Screening questions (fallback set when the API has none).
  const loadQuestions = async () => {
    try {
      const list = await getScreeningQuestions(flow, device?.categoryId);
      const fallback = flow === 'DEAD' ? [
        { id: 'd1', question: 'What is the current condition of your phone?', helperText: '', options: ['Phone Dead (Not powering on)', 'Unknown Condition (Not sure / partially working)'] },
        { id: 'd2', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
      ] : [
        { id: 'w1', question: 'Is your phone working properly?', helperText: 'Check your phone powers on.', options: ['Yes', 'No'] },
        { id: 'w2', question: 'Is your touchscreen working properly?', helperText: 'Check touch functionality.', options: ['Yes', 'No'] },
        { id: 'w3', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
        { id: 'w4', question: 'Is your phone have a valid warranty?', helperText: '', options: ['Yes', 'No'] },
      ];
      const finalList = list.length ? list : fallback;
      setQuestions(finalList);
      // Match prior answers by id, else by question text (admin re-keyed ids).
      if (isEditing) {
        const seed = {};
        for (const q of finalList) {
          if (prior.byQuestionId[q.id]) {
            seed[q.id] = prior.byQuestionId[q.id];
          } else {
            const match = (editHints?.screeningAnswers || []).find(
              (a) => a?.question && q.question && a.question.trim().toLowerCase() === q.question.trim().toLowerCase(),
            );
            if (match?.answer) seed[q.id] = match.answer;
          }
        }
        if (Object.keys(seed).length) setAnswers(seed);
      }
    } catch (_) {}
  };

  // Screen / body condition groups and their options.
  const loadGroups = async () => {
    try {
      const list = await getConditionGroups(device?.categoryId);
      const sortedGroups = sortGroups(list.length ? list : FALLBACK_GROUPS);
      setGroups(sortedGroups);
      const map = {};
      if (list.length) {
        const rows = await Promise.all(sortedGroups.map((g) => getConditionOptions(g.id).catch(() => [])));
        sortedGroups.forEach((g, i) => { map[g.id] = rows[i]; });
        setOptsByGroup(map);
      }
      if (isEditing) {
        const seed = {};
        for (const g of sortedGroups) {
          const p = prior.byGroupCode[(g.code || '').toUpperCase()] || prior.byGroupName[(g.name || '').trim().toLowerCase()];
          if (!p) continue;
          const opts = groupOpts(g, map);
          const byId = p.optionId ? opts.find((o) => o.id === p.optionId) : null;
          const byLabel = p.optionLabel ? opts.find((o) => (o.label || '').trim().toLowerCase() === p.optionLabel.trim().toLowerCase()) : null;
          const opt = byLabel || byId; // label first: split tiles share one option id
          if (opt) seed[g.id] = { id: opt.id, optionId: opt.optionId, label: opt.label, groupCode: g.code, groupName: g.name };
        }
        if (Object.keys(seed).length) setSelected(seed);
      }
    } catch (_) {
      setGroups(sortGroups(FALLBACK_GROUPS));
    }
  };

  // Functional issues (optional, multi-select).
  const loadIssues = async () => {
    let finalList;
    try {
      const list = await getFunctionalIssues(device?.categoryId);
      finalList = list.length ? list : FALLBACK_ISSUES.map((n, i) => ({ id: `f${i}`, name: n }));
    } catch (_) {
      finalList = FALLBACK_ISSUES.map((n, i) => ({ id: `f${i}`, name: n }));
    }
    setIssues(finalList);
    if (isEditing) {
      const seed = finalList
        .filter((it) => prior.issueIds.has(it.id)
          || (it.code && prior.issueCodes.has(String(it.code).toLowerCase()))
          || (it.name && prior.issueCodes.has(String(it.name).toLowerCase())))
        .map((it) => it.id);
      if (seed.length) setPicked(seed);
    }
  };

  useEffect(() => {
    Promise.all([loadQuestions(), loadGroups(), loadIssues()]).finally(() => setLoading(false));
  }, [flow]);

  const header = <SellStepHeader step={1} onBack={() => navigation.goBack()} />;
  if (loading) return <View style={{ flex: 1, backgroundColor: BRAND.bg }}>{header}<Loader /></View>;

  const toggleIssue = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const continueDisabled = questions.some((q) => !answers[q.id]) || groups.some((g) => !selected[g.id]);
  const tileCols = width >= 700 ? 5 : 3; // every picture group: same columns → same tile size

  const onContinue = () => navigation.navigate('SellDeviceConfig', {
    ...params,
    device,
    workingCondition,
    screeningAnswers: questions.filter((q) => answers[q.id]).map((q) => ({ questionId: q.id, answer: answers[q.id], question: q.question })),
    conditions: Object.values(selected).map((s) => ({ groupCode: s.groupCode, optionId: optionIdOf(s), optionLabel: s.label, groupName: s.groupName })),
    issues: picked.map((id) => ({ issueId: id })),
  });

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
        {isEditing ? <EditBanner text="Your previous answers and condition picks are pre-selected — change any below." /> : null}

        {/* Screening Questions */}
        <SellCard Icon={ClipboardList} title="Screening Questions">
          {questions.map((q, i) => {
            const opts = q.options || ['Yes', 'No'];
            const side = opts.length <= 2 && opts.every((o) => String(o).length <= 6);
            const inline = opts.length <= 3 && opts.every((o) => String(o).length <= 14);
            const btns = opts.map((opt) => {
              const active = answers[q.id] === opt;
              const isNo = isNoAnswer(opt);
              const tone = isNo ? BRAND.red : BRAND.green;
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.85}
                  onPress={() => setAnswers({ ...answers, [q.id]: opt })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 34, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9,
                    borderWidth: active ? 1.5 : 1, borderColor: active ? tone : '#E8EAEE', backgroundColor: active ? (isNo ? BRAND.redSoft : BRAND.greenSoft) : BRAND.bg,
                    ...(side ? { width: 74, marginLeft: 8 } : inline ? { flex: 1, marginHorizontal: 3, marginTop: 8 } : { marginTop: 8 }),
                  }}
                >
                  {active ? <Ionicons name={isNo ? 'close-circle' : 'checkmark-circle'} size={16} color={tone} style={{ marginRight: 5 }} /> : null}
                  <Text style={{ flexShrink: 1, fontSize: rf(12.5), fontWeight: active ? '800' : '600', color: active ? tone : BRAND.ink, textAlign: 'center' }}>{opt}</Text>
                </TouchableOpacity>
              );
            });
            return (
              <View key={q.id} style={{ paddingVertical: 10, borderBottomWidth: i < questions.length - 1 ? 1 : 0, borderBottomColor: '#F1F2F4' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: rf(13), lineHeight: rlh(18), fontWeight: '700', color: BRAND.ink }}>{i + 1}. {q.question}</Text>
                    {q.helperText ? <Text style={{ fontSize: rf(10.5), color: BRAND.muted, marginTop: 1 }}>{q.helperText}</Text> : null}
                  </View>
                  {side ? btns : null}
                </View>
                {side ? null : <View style={inline ? { flexDirection: 'row', marginHorizontal: -3 } : null}>{btns}</View>}
              </View>
            );
          })}
        </SellCard>

        {/* Screen / body condition groups */}
        {groups.map((g) => {
          const opts = groupOpts(g, optsByGroup);
          const kind = artKind(g);
          const cols = kind ? tileCols : colsFor(opts);
          const pick = (o) => setSelected({ ...selected, [g.id]: { id: o.id, optionId: o.optionId, label: o.label, groupCode: g.code, groupName: g.name } });
          return (
            <SellCard key={g.id} Icon={groupIcon(g)} title={g.name}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
                {opts.map((o) => {
                  const active = selected[g.id]?.id === o.id;
                  if (kind) {
                    return (
                      <ArtTile
                        key={o.id}
                        cols={cols}
                        active={active}
                        onPress={() => pick(o)}
                        role="radio"
                        label={o.label}
                        renderArt={(bg) => <ConditionArt kind={kind} variant={artVariant(o.label, kind)} size={ART} bg={bg} shape={deviceShape(device)} />}
                      />
                    );
                  }
                  return (
                    <View key={o.id} style={{ width: `${100 / cols}%`, padding: 3 }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => pick(o)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, borderRadius: 12, paddingVertical: 7, paddingHorizontal: cols === 3 ? 7 : 10, backgroundColor: active ? BRAND.greenSoft : BRAND.bg, borderWidth: active ? 1.5 : 1, borderColor: active ? BRAND.green : '#E8EAEE' }}
                      >
                        {active ? (
                          <View style={{ height: 18, width: 18, borderRadius: 9, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={11} color="#fff" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={{ height: 18, width: 18, borderRadius: 9, borderWidth: 2, borderColor: BRAND.ring }} />
                        )}
                        <Text style={{ flex: 1, marginLeft: cols === 3 ? 6 : 8, fontSize: rf(cols === 3 ? 11.5 : 12.5), lineHeight: rlh(cols === 3 ? 14 : 16), fontWeight: active ? '700' : '600', color: active ? BRAND.ink : BRAND.body }}>{o.label}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </SellCard>
          );
        })}

        {/* Functional issues (optional) */}
        {issues.length ? (
          <SellCard Icon={Wrench} title="Functional Issues" subtitle="Select any that apply (optional)">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {issues.map((it) => (
                <ArtTile
                  key={it.id}
                  cols={tileCols}
                  active={picked.includes(it.id)}
                  onPress={() => toggleIssue(it.id)}
                  role="checkbox"
                  label={it.name}
                  renderArt={() => <FunctionalArt name={it.name} size={ART} />}
                />
              ))}
            </View>
          </SellCard>
        ) : null}
      </ScrollView>
      <SellStepBar>
        <FlowCta palette={BRAND_FLOW} title="Continue" disabled={continueDisabled} onPress={onContinue} />
      </SellStepBar>
    </View>
  );
}
