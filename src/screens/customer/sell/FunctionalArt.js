import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Path, Line } from 'react-native-svg';
import { BRAND } from '../../../theme/brand';
import { getFunctionalIssueIcon } from './functionalIssueIcons';

// Picture tiles for the Sell "Functional" issues: a small drawing of the part
// plus a warning badge. Issues without a drawing fall back to their lucide icon.
const INK = '#1F2937';
const MUTED = '#9CA3AF';
const GREEN = BRAND.green;
const S = { stroke: INK, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
const PHONE_TOP = 'M10 50 V28 Q10 20 18 20 H46 Q54 20 54 28 V50';

// Checked top to bottom against the lower-cased issue name; first match wins.
const ART_RULES = [
  [/battery replaced/, 'batteryReplaced'],
  [/battery/, 'battery'],
  [/flash ?light/, 'flashlight'],
  [/front camera/, 'frontCamera'],
  [/camera glass/, 'cameraGlass'],
  [/back camera|rear camera/, 'backCamera'],
  [/sim slot/, 'simSlot'],
  [/network/, 'network'],
  [/ear speaker/, 'earSpeaker'],
  [/speaker|no sound|low sound/, 'speaker'],
  [/\bmic\b/, 'mic'],
  [/touch id|face id/, 'faceId'],
  [/volume button/, 'volumeButton'],
  [/power button/, 'powerButton'],
  [/wifi.*bluetooth/, 'wifiBluetooth'],
  [/wifi/, 'wifi'],
  [/bluetooth/, 'bluetooth'],
  [/charging port|charging pin/, 'chargingPort'],
  [/proximity/, 'proximity'],
  [/vibrat/, 'vibrator'],
];
const artKeyFor = (name) => {
  const s = String(name || '').toLowerCase();
  const hit = ART_RULES.find(([re]) => re.test(s));
  return hit ? hit[1] : null;
};

const Lens = ({ cx, cy, r }) => (
  <>
    <Circle cx={cx} cy={cy} r={r} fill="#E5E7EB" stroke={INK} strokeWidth={1.4} />
    <Circle cx={cx} cy={cy} r={r * 0.5} fill="#374151" />
  </>
);
const Wifi = ({ x, y }) => (
  <>
    <Path d={`M${x - 12} ${y - 10} Q${x} ${y - 21} ${x + 12} ${y - 10}`} {...S} />
    <Path d={`M${x - 7} ${y - 5} Q${x} ${y - 11} ${x + 7} ${y - 5}`} {...S} />
    <Circle cx={x} cy={y} r={2.2} fill={INK} />
  </>
);
const Bt = ({ x, y }) => (
  <Path d={`M${x - 6} ${y - 6} L${x + 6} ${y + 6} L${x} ${y + 12} V${y - 12} L${x + 6} ${y - 6} L${x - 6} ${y + 6}`} {...S} />
);

const ART = {
  battery: (
    <>
      <Rect x={8} y={21} width={42} height={22} rx={6} {...S} />
      <Rect x={12} y={25} width={34} height={14} rx={3.5} stroke={INK} strokeWidth={1} fill="none" />
      <Rect x={52} y={28} width={3.5} height={8} rx={1.5} fill={INK} />
      <Path d="M31 25.5 L25.5 33 H30 L28 38.5 L33.5 31 H29 Z" fill={GREEN} />
    </>
  ),
  batteryReplaced: (
    <>
      <Rect x={28} y={17} width={8} height={3} rx={1} fill={INK} />
      <Rect x={24} y={20} width={16} height={26} rx={3.5} {...S} />
      <Rect x={27} y={28} width={10} height={15} rx={1.5} fill={GREEN} />
      <Path d="M14 28 A19 19 0 0 1 44 13" {...S} strokeWidth={1.6} />
      <Path d="M40 10.5 L44.5 13 L41 17" {...S} strokeWidth={1.6} />
      <Path d="M50 36 A19 19 0 0 1 20 51" {...S} strokeWidth={1.6} />
      <Path d="M24 53.5 L19.5 51 L23 47" {...S} strokeWidth={1.6} />
    </>
  ),
  flashlight: (
    <>
      <Rect x={12} y={12} width={16} height={40} rx={8} {...S} />
      <Lens cx={20} cy={22} r={5} />
      <Lens cx={20} cy={42} r={5} />
      <Path d="M42 32 L54 26 V38 Z" fill="#E5E7EB" />
      <Circle cx={37} cy={32} r={4} fill="#fff" stroke={INK} strokeWidth={1.6} />
      <Circle cx={37} cy={32} r={1.8} fill={GREEN} />
    </>
  ),
  frontCamera: (
    <>
      <Path d={PHONE_TOP} {...S} />
      <Rect x={23} y={25} width={18} height={5.5} rx={2.75} fill={GREEN} />
      <Circle cx={37.5} cy={27.75} r={1.6} fill={INK} />
    </>
  ),
  backCamera: (
    <>
      <Path d="M12 54 V18 Q12 10 20 10 H44 Q52 10 52 18 V54" {...S} />
      <Rect x={17} y={15} width={13} height={23} rx={6.5} fill="#fff" stroke={INK} strokeWidth={1.4} />
      <Lens cx={23.5} cy={21.5} r={4} />
      <Lens cx={23.5} cy={31.5} r={4} />
      <Circle cx={35} cy={18} r={1.5} fill={GREEN} />
    </>
  ),
  cameraGlass: (
    <>
      <Rect x={19} y={6} width={26} height={52} rx={13} {...S} />
      <Lens cx={32} cy={19} r={9} />
      <Lens cx={32} cy={45} r={9} />
      <Path d="M29 16 l-5 -4 M29 16 l4 -6 M29 16 l8 2 M29 16 l3 7 M29 16 l-6 4 M34 47 l-5 -5 M34 47 l6 -2 M34 47 l-1 7" stroke={MUTED} strokeWidth={1} strokeLinecap="round" />
    </>
  ),
  simSlot: (
    <>
      <Path d="M19 16 V50 Q19 52 21 52 H39 Q41 52 41 50 V16" {...S} strokeWidth={1.8} />
      <Path d="M24 22 H33 L36 25 V46 H24 Z" fill="#E5E7EB" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <Rect x={14} y={10} width={32} height={6} rx={2} fill="#D1D5DB" stroke={INK} strokeWidth={1.6} />
      <Line x1={17} y1={10} x2={43} y2={10} stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={42} cy={13} r={1} fill={INK} />
    </>
  ),
  network: (
    <>
      {[[14, 46, 4], [24, 38, 12], [34, 30, 20], [44, 20, 30]].map(([x, y, h]) => (
        <Rect key={x} x={x} y={y} width={6} height={h} rx={3} fill={INK} />
      ))}
    </>
  ),
  speaker: (
    <>
      <Path d="M12 26 H20 L31 17 V47 L20 38 H12 Z" fill={INK} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M38 25 Q43 32 38 39" {...S} />
      <Path d="M44 19 Q53 32 44 45" {...S} />
    </>
  ),
  earSpeaker: (
    <>
      <Path d={PHONE_TOP} {...S} />
      <Rect x={24} y={25} width={16} height={3} rx={1.5} fill={GREEN} />
      <Path d="M25 13 Q32 9 39 13" {...S} stroke={MUTED} strokeWidth={1.6} />
    </>
  ),
  mic: (
    <>
      <Rect x={25} y={10} width={14} height={26} rx={7} {...S} />
      <Path d="M28.5 19 H35.5 M28.5 24 H35.5" stroke={MUTED} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M19 30 Q19 44 32 44 Q45 44 45 30" {...S} />
      <Path d="M32 44 V53 M25 53 H39" {...S} />
    </>
  ),
  faceId: (
    <>
      <Path d="M12 22 V16 Q12 12 16 12 H22 M42 12 H48 Q52 12 52 16 V22 M52 42 V48 Q52 52 48 52 H42 M22 52 H16 Q12 52 12 48 V42" {...S} />
      <Path d="M24 24 V28 M40 24 V28 M32 24 V34 H30" {...S} />
      <Path d="M25 40 Q32 45 39 40" {...S} stroke={GREEN} />
    </>
  ),
  volumeButton: (
    <>
      <Rect x={22} y={8} width={24} height={48} rx={6} {...S} />
      <Rect x={17.5} y={17} width={4} height={9} rx={1.6} fill={GREEN} />
      <Rect x={17.5} y={29} width={4} height={9} rx={1.6} fill={GREEN} />
    </>
  ),
  powerButton: (
    <>
      <Rect x={18} y={8} width={24} height={48} rx={6} {...S} />
      <Rect x={42.5} y={20} width={4} height={13} rx={1.6} fill={GREEN} />
      <Path d="M26.5 28.5 A7.5 7.5 0 1 0 33.5 28.5" {...S} strokeWidth={1.8} />
      <Line x1={30} y1={25} x2={30} y2={32} {...S} strokeWidth={1.8} />
    </>
  ),
  wifiBluetooth: (
    <>
      <Wifi x={20} y={40} />
      <Bt x={46} y={32} />
    </>
  ),
  wifi: <Wifi x={32} y={42} />,
  bluetooth: <Bt x={32} y={32} />,
  chargingPort: (
    <>
      <Path d="M12 10 V30 Q12 38 20 38 H44 Q52 38 52 30 V10" {...S} />
      <Rect x={27} y={34} width={10} height={2.6} rx={1.3} fill={INK} />
      <Path d="M33.5 15 L28 23 H32 L30.5 29 L36 21 H32 Z" fill={GREEN} />
      <Rect x={28} y={43} width={8} height={7} rx={1.6} fill={MUTED} />
      <Path d="M32 50 V58" {...S} />
    </>
  ),
  proximity: (
    <>
      <Path d="M10 58 V36 Q10 28 18 28 H46 Q54 28 54 36 V58" {...S} />
      <Rect x={25} y={33} width={14} height={4.5} rx={2.25} fill={INK} />
      <Circle cx={44} cy={35.25} r={1.7} fill={GREEN} />
      <Path d="M37 20 Q44 15 51 20" {...S} stroke={GREEN} strokeWidth={1.8} />
      <Path d="M33 13 Q44 5 55 13" {...S} stroke={GREEN} strokeWidth={1.8} />
    </>
  ),
  vibrator: (
    <>
      <Rect x={22} y={12} width={20} height={40} rx={5} {...S} />
      <Path d="M15 22 L11 26 L15 30 L11 34 L15 38 L11 42" {...S} strokeWidth={1.8} />
      <Path d="M49 22 L53 26 L49 30 L53 34 L49 38 L53 42" {...S} strokeWidth={1.8} />
    </>
  ),
};

const Warn = () => (
  <Svg width={14} height={13} viewBox="0 0 16 15">
    <Path d="M8 1 L15.2 13.8 H0.8 Z" fill="#FACC15" stroke="#EAB308" strokeWidth={0.8} strokeLinejoin="round" />
    <Line x1={8} y1={5.5} x2={8} y2={9.6} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    <Circle cx={8} cy={11.8} r={0.9} fill={INK} />
  </Svg>
);

export default function FunctionalArt({ name, size = 52 }) {
  const key = artKeyFor(name);
  const Icon = key ? null : getFunctionalIssueIcon(name);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {key
        ? <Svg width={size} height={size} viewBox="0 0 64 64">{ART[key]}</Svg>
        : <Icon size={size * 0.5} color={INK} strokeWidth={1.8} />}
      <View style={{ position: 'absolute', right: -2, bottom: 2 }}><Warn /></View>
    </View>
  );
}
