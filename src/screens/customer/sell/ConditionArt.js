import React from 'react';
import Svg, { G, Rect, Circle, Path, Line, Ellipse, Defs, ClipPath, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { BRAND } from '../../../theme/brand';

// Small phone illustrations for the sell "Screen and body condition" tiles.
const INK = '#1F2937';
const MUTED = '#9CA3AF';
const DMG = '#4B5563';

const GREEN = BRAND.green;
const AMBER = '#F59E0B';
const RED = '#EF4444';
// Groups drawn as a good / mid / bad status picture instead of phone damage.
const STATUS_KINDS = ['camera', 'battery', 'charging'];

// Which face of the phone a condition group is about; null → no illustration.
export const artKind = (g) => {
  const n = `${g?.name || ''} ${g?.code || ''}`.toLowerCase();
  if (n.includes('camera')) return 'camera';
  if (n.includes('battery') || n.includes('power')) return 'battery';
  if (n.includes('charg') || n.includes('connect') || n.includes('port')) return 'charging';
  if (n.includes('back') || n.includes('body')) return 'back';
  if (n.includes('side') || n.includes('center') || n.includes('frame')) return 'side';
  if (n.includes('touch') || n.includes('glass')) return 'glass';
  if (n.includes('screen') || n.includes('display')) return 'front';
  return null;
};

// Damage drawn for an option, picked from its label.
export const artVariant = (label, kind) => {
  const l = String(label || '').toLowerCase();
  if (STATUS_KINDS.includes(kind)) {
    if (/not working|not charging|dead|damage|fail|broken/.test(l)) return 'bad';
    if (/weak|drain|slow|minor|blur|scratch|issue|low|wear|normal/.test(l)) return 'mid';
    return 'good';
  }
  if (/^no\b|no damage|no defect|no spot|flawless/.test(l)) return 'clean';
  if (/discolou?r|tint/.test(l)) return 'discolor';
  if (/\bline/.test(l)) return 'lines';
  if (/bend|bent|broken|crack/.test(l)) return 'cracked';
  if (/spot|patch|pixel/.test(l)) return /major|heavy|large/.test(l) ? 'spotsMajor' : 'spotsMinor';
  if (/mark/.test(l)) return /heavy/.test(l) ? 'marksHeavy' : 'marksLight';
  if (/dent/.test(l)) return /major|heavy/.test(l) ? 'dentMajor' : 'dentMinor';
  if (/scratch/.test(l)) return /heavy|deep|major/.test(l) ? 'scratchHeavy' : 'scratchMinor';
  return 'clean';
};

const SCRATCH_MINOR = ['M24 40 L36 50', 'M33 66 L40 71'];
const SCRATCH_HEAVY = [...SCRATCH_MINOR, 'M18 52 L26 48', 'M30 30 L38 36', 'M22 76 L29 81', 'M37 56 L43 52', 'M19 64 L23 68', 'M28 58 L33 61'];
const crack = (x, y) => [
  `M${x} ${y} l-6 -12`, `M${x} ${y} l9 -21`, `M${x} ${y} l24 -6`, `M${x} ${y} l19 26 l5 20`,
  `M${x} ${y} l-3 40 l8 21`, `M${x} ${y} l-9 12`, `M${x} ${y} l14 10`,
  `M${x - 4} ${y - 4} q4 -3 9 2 q1 5 -5 7 q-5 -1 -4 -9`,
];
const MARKS_LIGHT = [[16, 22, 2.6, 1.1], [44, 82, 3, 1.2], [45, 46, 1.1, 3]];
const MARKS_HEAVY = [...MARKS_LIGHT, [15, 60, 1.2, 4], [30, 90, 4, 1.2], [42, 12, 3, 1.1], [16, 86, 2.4, 1.4], [44, 66, 1.2, 3]];
const BENT_BODY = 'M19 6 H41 Q48 6 48 13 Q52 50 48 87 Q48 94 41 94 H19 Q12 94 12 87 Q16 50 12 13 Q12 6 19 6 Z';

const Strokes = ({ paths, color = DMG, w = 0.7 }) => paths.map((d, i) => (
  <Path key={i} d={d} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" />
));

// Inward notch on the frame edge (x = edge, dir: +1 left edge, -1 right edge).
const Dent = ({ x, y, dir, bg }) => (
  <>
    <Line x1={x} y1={y + 0.8} x2={x} y2={y + 5.2} stroke={bg} strokeWidth={3} />
    <Path d={`M${x} ${y} Q${x + dir * 3.5} ${y + 3} ${x} ${y + 6}`} stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </>
);

// Battery bars bottom → top (inner area y 17.5–86.5).
const BAR_Y = [71.5, 54, 36.5, 19];
const LENS = [30, 70];
const LENS_CRACK = ['M28 28 l-7 -6', 'M28 28 l5 -8', 'M28 28 l10 1', 'M28 28 l6 8', 'M28 28 l-3 10', 'M28 28 l-8 3'];

function StatusArt({ kind, variant: v, size }) {
  const tone = v === 'good' ? GREEN : v === 'mid' ? AMBER : RED;
  return (
    <Svg width={(size * 44) / 94} height={size} viewBox="8 3 44 94">
      {kind === 'battery' ? (
        <>
          <Rect x={25} y={8} width={10} height={6} rx={1.5} fill={INK} />
          <Rect x={16} y={14} width={28} height={76} rx={6} fill="#fff" stroke={INK} strokeWidth={1.6} />
          {BAR_Y.slice(0, v === 'good' ? 4 : v === 'mid' ? 2 : 0).map((y) => (
            <Rect key={y} x={19.5} y={y} width={21} height={15} rx={2.5} fill={tone} />
          ))}
          {v === 'bad' ? (
            <>
              <Rect x={19.5} y={81.5} width={21} height={5} rx={2} fill={RED} opacity={0.35} />
              <Rect x={28.5} y={34} width={3} height={24} rx={1.5} fill={RED} />
              <Circle cx={30} cy={66} r={2.2} fill={RED} />
            </>
          ) : null}
        </>
      ) : null}

      {kind === 'camera' ? (
        <>
          <Rect x={14} y={10} width={32} height={80} rx={16} fill="#fff" stroke={INK} strokeWidth={1.4} />
          {LENS.map((cy) => (
            <React.Fragment key={cy}>
              {v === 'mid' ? <Circle cx={30} cy={cy} r={13.5} fill="#CBD5E1" opacity={0.45} /> : null}
              <Circle cx={30} cy={cy} r={11} fill="#E5E7EB" stroke={INK} strokeWidth={1.1} />
              <Circle cx={30} cy={cy} r={6.5} fill="#374151" />
              <Circle cx={27.6} cy={cy - 2.4} r={1.6} fill="#fff" opacity={0.85} />
            </React.Fragment>
          ))}
          <Circle cx={30} cy={50} r={2.4} fill={v === 'good' ? GREEN : MUTED} />
          {v === 'mid' ? <Strokes paths={['M22 24 L37 35', 'M24 66 L37 75', 'M33 62 L38 66']} color="#F3F4F6" w={0.9} /> : null}
          {v === 'bad' ? (
            <>
              <Strokes paths={LENS_CRACK} color="#F3F4F6" w={0.8} />
              <Line x1={20} y1={60} x2={40} y2={80} stroke={RED} strokeWidth={2.2} strokeLinecap="round" />
            </>
          ) : null}
        </>
      ) : null}

      {kind === 'charging' ? (
        <>
          <Path d="M33 8 L20 31 H29 L26 48 L40 23 H31 Z" fill={v === 'bad' ? 'none' : tone} stroke={v === 'bad' ? MUTED : tone} strokeWidth={1.2} strokeLinejoin="round" />
          {v === 'good' ? <Strokes paths={['M16 16 L19 18', 'M44 16 L41 18', 'M15 34 L18.5 33.5', 'M45 34 L41.5 33.5']} color={GREEN} w={1.3} /> : null}
          {v === 'bad' ? <Line x1={17} y1={12} x2={43} y2={44} stroke={RED} strokeWidth={2.2} strokeLinecap="round" /> : null}
          <Rect x={25} y={v === 'bad' ? 52 : 50} width={10} height={8} rx={2} fill={MUTED} />
          <Rect x={22} y={58} width={16} height={20} rx={4} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <Line x1={26.5} y1={66} x2={33.5} y2={66} stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M30 78 V93" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
}

// Device shape from the sell device's category: laptop / tablet / watch / audio; anything else → phone.
export const deviceShape = (device) => {
  const c = `${device?.categoryCode || ''} ${device?.categoryName || ''} ${device?.categoryId || ''}`.toLowerCase();
  if (/laptop|notebook|macbook/.test(c)) return 'laptop';
  if (/tablet|\btab\b|ipad/.test(c)) return 'tablet';
  if (/watch/.test(c)) return 'watch';
  if (/audio|headphone|earbud|earphone|speaker|headset/.test(c)) return 'audio';
  return 'phone';
};

// The screen / panel area damage is drawn on, per shape (viewBox 0 0 100 100).
const FACE = { laptop: [17, 17, 66, 40], tablet: [22, 15, 56, 70], watch: [33, 31, 34, 38], audio: [16, 48, 20, 30] };

function ShapeArt({ shape, kind, variant: v, size }) {
  const [x, y, w, h] = FACE[shape];
  const at = (fx, fy) => [x + fx * w, y + fy * h];
  const back = kind === 'back' || kind === 'side';
  const screen = v === 'discolor' ? 'url(#saTint)' : back ? '#F3F4F6' : '#fff';
  const crackAt = (fx, fy) => { const [cx, cy] = at(fx, fy); return [`M${cx} ${cy} l-9 -7`, `M${cx} ${cy} l6 -9`, `M${cx} ${cy} l11 2`, `M${cx} ${cy} l5 9`, `M${cx} ${cy} l-4 10`]; };
  const scratch = (list) => list.map(([a, b, c, d]) => { const [x1, y1] = at(a, b); const [x2, y2] = at(c, d); return `M${x1} ${y1} L${x2} ${y2}`; });
  const marks = v === 'marksHeavy' ? [[0.15, 0.2], [0.8, 0.75], [0.5, 0.45], [0.25, 0.8], [0.85, 0.2]] : [[0.2, 0.25], [0.75, 0.7], [0.5, 0.5]];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="saFace"><Rect x={x} y={y} width={w} height={h} rx={2} /></ClipPath>
        <LinearGradient id="saTint" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDE68A" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#F9A8D4" stopOpacity={0.6} />
        </LinearGradient>
      </Defs>
      {shape === 'laptop' ? (
        <>
          <Rect x={12} y={12} width={76} height={50} rx={4} fill="#fff" stroke={INK} strokeWidth={2} />
          <Path d="M6 66 H94 L88 76 H12 Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Line x1={42} y1={70.5} x2={58} y2={70.5} stroke={MUTED} strokeWidth={1.6} strokeLinecap="round" />
          <Circle cx={50} cy={14.6} r={0.9} fill={INK} />
        </>
      ) : null}
      {shape === 'tablet' ? (
        <>
          <Rect x={18} y={9} width={64} height={82} rx={7} fill="#fff" stroke={INK} strokeWidth={2} />
          <Circle cx={50} cy={12} r={1} fill={INK} />
        </>
      ) : null}
      {shape === 'watch' ? (
        <>
          <Rect x={37} y={6} width={26} height={22} rx={4} fill="#E5E7EB" stroke={INK} strokeWidth={1.6} />
          <Rect x={37} y={72} width={26} height={22} rx={4} fill="#E5E7EB" stroke={INK} strokeWidth={1.6} />
          <Rect x={28} y={26} width={44} height={48} rx={11} fill="#fff" stroke={INK} strokeWidth={2} />
          <Rect x={71} y={42} width={4} height={10} rx={1.5} fill={INK} />
        </>
      ) : null}
      {shape === 'audio' ? (
        <>
          <Path d="M20 52 V44 Q20 14 50 14 Q80 14 80 44 V52" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <Rect x={13} y={46} width={26} height={34} rx={9} fill="#fff" stroke={INK} strokeWidth={2} />
          <Rect x={61} y={46} width={26} height={34} rx={9} fill="#fff" stroke={INK} strokeWidth={2} />
        </>
      ) : null}
      <Rect x={x} y={y} width={w} height={h} rx={2} fill={screen} stroke={MUTED} strokeWidth={0.8} />
      <G clipPath="url(#saFace)">
        {v === 'spotsMinor' ? (<><Circle cx={at(0.25, 0.3)[0]} cy={at(0.25, 0.3)[1]} r={1.6} fill={INK} /><Circle cx={at(0.7, 0.65)[0]} cy={at(0.7, 0.65)[1]} r={1.8} fill={INK} /></>) : null}
        {v === 'spotsMajor' ? (<><Circle cx={at(0.3, 0.3)[0]} cy={at(0.3, 0.3)[1]} r={4.5} fill={INK} /><Circle cx={at(0.7, 0.7)[0]} cy={at(0.7, 0.7)[1]} r={4} fill={INK} /></>) : null}
        {v === 'lines' ? (
          <>
            <Line x1={at(0.62, 0)[0]} y1={y} x2={at(0.62, 0)[0]} y2={y + h} stroke={BRAND.green} strokeWidth={1.8} />
            <Line x1={at(0.72, 0)[0]} y1={y} x2={at(0.72, 0)[0]} y2={y + h} stroke="#F472B6" strokeWidth={1.3} />
          </>
        ) : null}
        {v === 'scratchMinor' ? <Strokes paths={scratch([[0.2, 0.3, 0.45, 0.5], [0.6, 0.7, 0.75, 0.8]])} w={1} /> : null}
        {v === 'scratchHeavy' ? <Strokes paths={scratch([[0.1, 0.2, 0.4, 0.45], [0.5, 0.15, 0.8, 0.35], [0.15, 0.7, 0.4, 0.9], [0.55, 0.6, 0.9, 0.8], [0.3, 0.5, 0.6, 0.55]])} w={1} /> : null}
        {v === 'cracked' ? <Strokes paths={crackAt(0.35, 0.4)} w={1} color={INK} /> : null}
        {v === 'marksLight' || v === 'marksHeavy'
          ? marks.map(([a, b], i) => <Ellipse key={i} cx={at(a, b)[0]} cy={at(a, b)[1]} rx={3.5} ry={1.5} fill={v === 'marksHeavy' ? '#94A3B8' : '#CBD5E1'} />)
          : null}
      </G>
      {v === 'dentMinor' || v === 'dentMajor'
        ? (v === 'dentMajor' ? [[0.1, 0.3], [0.85, 0.6], [0.4, 0.85]] : [[0.8, 0.4]]).map(([a, b], i) => (
          <Path key={i} d={`M${at(a, b)[0] - 4} ${at(a, b)[1]} Q${at(a, b)[0]} ${at(a, b)[1] + 4} ${at(a, b)[0] + 4} ${at(a, b)[1]}`} fill="none" stroke={DMG} strokeWidth={1.4} />
        ))
        : null}
    </Svg>
  );
}

export default function ConditionArt({ kind = 'front', variant = 'clean', size = 60, bg = '#F7F8FB', shape = 'phone' }) {
  if (STATUS_KINDS.includes(kind)) return <StatusArt kind={kind} variant={variant} size={size} />;
  if (FACE[shape]) return <ShapeArt shape={shape} kind={kind} variant={variant} size={size} />;
  const back = kind === 'back';
  const side = kind === 'side';
  const outline = kind === 'glass' ? MUTED : INK;
  const bent = side && variant === 'cracked';
  const v = variant;

  return (
    <Svg width={(size * 44) / 94} height={size} viewBox="8 3 44 94">
      <Defs>
        <ClipPath id="caBody"><Rect x={12} y={6} width={36} height={88} rx={7} /></ClipPath>
        <LinearGradient id="caTint" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDE68A" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#F9A8D4" stopOpacity={0.55} />
        </LinearGradient>
      </Defs>

      {/* side buttons sit under the body edge */}
      <Rect x={10.2} y={24} width={2.4} height={7} rx={1} fill={outline} />
      <Rect x={47.4} y={28} width={2.4} height={12} rx={1} fill={outline} />
      {bent
        ? <Path d={BENT_BODY} fill="#fff" stroke={INK} strokeWidth={2.2} />
        : <Rect x={12} y={6} width={36} height={88} rx={7} fill="#fff" stroke={outline} strokeWidth={side ? 2.2 : 1.4} />}

      {back ? (
        <>
          <Rect x={15} y={10} width={11} height={20} rx={5.5} fill="#fff" stroke={INK} strokeWidth={1} />
          <Circle cx={20.5} cy={15.5} r={3} fill="#E5E7EB" stroke={INK} strokeWidth={0.9} />
          <Circle cx={20.5} cy={24.5} r={3} fill="#E5E7EB" stroke={INK} strokeWidth={0.9} />
          <Circle cx={29} cy={14} r={1.3} fill={BRAND.green} />
        </>
      ) : (
        <>
          <Rect x={15} y={9} width={30} height={82} rx={5} fill={v === 'discolor' ? 'url(#caTint)' : '#fff'} stroke={MUTED} strokeWidth={0.6} />
          <Rect x={25} y={12} width={10} height={3.6} rx={1.8} fill={BRAND.green} />
          <Line x1={25} y1={88} x2={35} y2={88} stroke={outline} strokeWidth={1} strokeLinecap="round" />
        </>
      )}

      <G clipPath="url(#caBody)">
        {v === 'discolor' && !back ? (
          <>
            <SvgText x={18} y={29} fontSize={7} fontWeight="700" fill={MUTED}>10:37</SvgText>
            <SvgText x={18} y={35} fontSize={3.4} fill={MUTED}>Tue, 10 Apr</SvgText>
            {[17.5, 24, 30.5, 37].map((x) => <Rect key={x} x={x} y={78} width={4.5} height={4.5} rx={1.3} fill={MUTED} opacity={0.6} />)}
          </>
        ) : null}
        {v === 'spotsMinor' ? (<><Circle cx={20} cy={32} r={1.1} fill={INK} /><Circle cx={40} cy={52} r={1.3} fill={INK} /></>) : null}
        {v === 'spotsMajor' ? (
          <>
            <Circle cx={21} cy={30} r={3} fill={INK} /><Circle cx={23.6} cy={32.6} r={2.2} fill={INK} />
            <Circle cx={39} cy={70} r={2.8} fill={INK} /><Circle cx={41.6} cy={68} r={2} fill={INK} />
          </>
        ) : null}
        {v === 'lines' ? (
          <>
            <Line x1={37} y1={9} x2={37} y2={91} stroke={BRAND.green} strokeWidth={1.3} />
            <Line x1={40.5} y1={9} x2={40.5} y2={91} stroke="#F472B6" strokeWidth={0.9} />
          </>
        ) : null}
        {v === 'scratchMinor' ? <Strokes paths={SCRATCH_MINOR} /> : null}
        {v === 'scratchHeavy' ? <Strokes paths={SCRATCH_HEAVY} /> : null}
        {v === 'cracked' && !side ? <Strokes paths={back ? crack(34, 58) : crack(22, 30)} w={0.6} /> : null}
        {v === 'marksLight' || v === 'marksHeavy'
          ? (v === 'marksHeavy' ? MARKS_HEAVY : MARKS_LIGHT).map(([cx, cy, rx, ry], i) => (
            <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={v === 'marksHeavy' ? '#94A3B8' : '#CBD5E1'} opacity={0.8} />
          ))
          : null}
      </G>

      {v === 'dentMinor' ? (<><Dent x={48} y={52} dir={-1} bg={bg} /><Strokes paths={['M14.5 70 L17 74']} /></>) : null}
      {v === 'dentMajor' ? (
        <>
          <Dent x={48} y={50} dir={-1} bg={bg} /><Dent x={12} y={62} dir={1} bg={bg} /><Dent x={48} y={74} dir={-1} bg={bg} />
          <Strokes paths={['M14.5 40 L17 45', 'M43 18 L45.5 22', 'M15 80 L18 84']} w={0.9} />
        </>
      ) : null}
      {bent ? <Strokes paths={['M48.5 44 L51.5 47 L48.8 50 L52 53', 'M44 47 L49 49']} color={INK} w={1} /> : null}
    </Svg>
  );
}
