import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/**
 * Two-tone line art (ink outline + brand-green fill) for the Repair tab's
 * "Services available" and "Why Us" sections. 48×48 grid.
 */
const INK = '#1E1E1E';
const GREEN = '#09AD2A';
const W = '#FFFFFF';
const S = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const T = { ...S, strokeWidth: 1.5 };

const ART = {
  display: () => (
    <>
      <Rect x={13} y={4} width={22} height={40} rx={4} fill={GREEN} {...S} />
      <Rect x={16} y={9} width={16} height={29} rx={1} fill={W} {...T} />
      <Path d="M21 9l3 7-4 5 5 6-3 6 1 5M24 16l8-2M25 27l7 3M20 21l-4 1" fill="none" {...T} />
      <Path d="M21 6.5h6" fill="none" {...T} />
      <Circle cx={24} cy={41} r={1.3} fill={INK} />
    </>
  ),
  battery: () => (
    <>
      <Rect x={19} y={4} width={10} height={5} rx={1.5} fill={GREEN} {...S} />
      <Rect x={14} y={9} width={20} height={35} rx={4} fill={W} {...S} />
      <Path d="M26 15l-8 13h6l-2 10 8-14h-6z" fill={GREEN} {...T} />
    </>
  ),
  camera: () => (
    <>
      <Path d="M6 16a4 4 0 0 1 4-4h6l3-4h10l3 4h6a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill={W} {...S} />
      <Circle cx={24} cy={26} r={9} fill={W} {...S} />
      <Circle cx={24} cy={26} r={5.5} fill={GREEN} {...T} />
      <Circle cx={22} cy={24} r={1.4} fill={W} />
      <Circle cx={36} cy={18} r={1.6} fill={INK} />
    </>
  ),
  audio: () => (
    <>
      <Path d="M8 19h7l9-7v24l-9-7H8z" fill={GREEN} {...S} />
      <Path d="M30 18a8 8 0 0 1 0 12M34.5 13a15 15 0 0 1 0 22" fill="none" {...S} />
    </>
  ),
  plug: () => (
    <>
      <Path d="M20 16V8M28 16V8" fill="none" {...S} strokeWidth={2.6} />
      <Rect x={15} y={16} width={18} height={14} rx={3} fill={GREEN} {...S} />
      <Path d="M24 30v6a6 6 0 0 1-6 6h-5" fill="none" {...S} />
    </>
  ),
  chip: () => (
    <>
      <Path d="M18 13V7M24 13V7M30 13V7M18 41v-6M24 41v-6M30 41v-6M13 18H7M13 24H7M13 30H7M41 18h-6M41 24h-6M41 30h-6" fill="none" {...S} />
      <Rect x={13} y={13} width={22} height={22} rx={3} fill={W} {...S} />
      <Rect x={19} y={19} width={10} height={10} rx={1.5} fill={GREEN} {...T} />
    </>
  ),
  signal: () => (
    <>
      <Rect x={7} y={32} width={6} height={9} rx={1.5} fill={GREEN} {...S} />
      <Rect x={16.5} y={25} width={6} height={16} rx={1.5} fill={W} {...S} />
      <Rect x={26} y={17} width={6} height={24} rx={1.5} fill={GREEN} {...S} />
      <Rect x={35.5} y={8} width={6} height={33} rx={1.5} fill={W} {...S} />
    </>
  ),
  diagnose: () => (
    <>
      <Path d="M31 31l9 9" fill="none" {...S} strokeWidth={6} />
      <Path d="M31 31l9 9" fill="none" stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={21} cy={21} r={12} fill={W} {...S} />
      <Path d="M13 21h4l2-4 3 8 2-4h5" fill="none" stroke={GREEN} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  gauge: () => (
    <>
      <Path d="M6 34a18 18 0 0 1 36 0z" fill={W} {...S} />
      <Path d="M11 34a13 13 0 0 1 26 0" fill="none" stroke={GREEN} strokeWidth={4} />
      <Path d="M24 34l8-10" fill="none" {...S} strokeWidth={2.4} />
      <Circle cx={24} cy={34} r={2.5} fill={INK} />
    </>
  ),
  lock: () => (
    <>
      <Path d="M16 21v-5a8 8 0 0 1 16 0v5" fill="none" {...S} strokeWidth={2.4} />
      <Rect x={11} y={21} width={26} height={21} rx={4} fill={GREEN} {...S} />
      <Circle cx={24} cy={30} r={2.5} fill={W} {...T} />
      <Path d="M24 32.5v4" fill="none" {...S} />
    </>
  ),
  gear: () => (
    <>
      <G>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <Rect key={a} x={21.5} y={6} width={5} height={8} rx={1} fill={GREEN} {...T} transform={`rotate(${a} 24 24)`} />
        ))}
      </G>
      <Circle cx={24} cy={24} r={12} fill={GREEN} {...S} />
      <Circle cx={24} cy={24} r={4.5} fill={W} {...T} />
    </>
  ),
  body: () => (
    <>
      <Rect x={13} y={4} width={22} height={40} rx={4} fill={W} {...S} />
      <Rect x={16} y={8} width={9} height={11} rx={2.5} fill={GREEN} {...T} />
      <Circle cx={20.5} cy={11.5} r={1.6} fill={W} />
      <Circle cx={20.5} cy={15.6} r={1.6} fill={W} />
      <Path d="M35 26l-6 3 2 4-5 3 1 4" fill="none" {...T} />
    </>
  ),
  // Why Us
  tag: () => (
    <>
      <Path d="M6 22V9a3 3 0 0 1 3-3h13l20 20-16 16z" fill={GREEN} {...S} />
      <Circle cx={14} cy={14} r={3} fill={W} {...T} />
      <Path d="M20 27l4 4 8-8" fill="none" stroke={W} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  home: () => (
    <>
      <Path d="M11 19v22h26V19" fill={W} {...S} />
      <Path d="M6 23L24 8l18 15" fill="none" {...S} strokeWidth={2.4} />
      <Rect x={20} y={29} width={8} height={12} rx={1} fill={GREEN} {...T} />
      <Rect x={14.5} y={23} width={5} height={5} rx={1} fill={GREEN} {...T} />
    </>
  ),
  shield: () => (
    <>
      <Path d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z" fill={GREEN} {...S} />
      <Path d="M17 24l5 5 9-10" fill="none" stroke={W} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  expert: () => (
    <>
      <Path d="M6 42v-5a10 10 0 0 1 10-10h6a10 10 0 0 1 10 10v5z" fill={GREEN} {...S} />
      <Circle cx={19} cy={15} r={7} fill={W} {...S} />
      <Circle cx={36} cy={14} r={7} fill={W} {...S} />
      <Path d="M36 9.8l1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.3-2.6 1.3.5-2.8-2-2 2.8-.4z" fill={GREEN} {...T} strokeWidth={1} />
    </>
  ),
  rupee: () => (
    <>
      <Circle cx={24} cy={24} r={18} fill={GREEN} {...S} />
      <Circle cx={24} cy={24} r={13} fill="none" stroke={W} strokeWidth={1.4} />
      <Path d="M18.5 17h11M18.5 22h11M21.5 17c5.5 0 5.5 7.5 0 7.5h-2.5l8.5 9" fill="none" stroke={W} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  headset: () => (
    <>
      <Path d="M10 27v-3a14 14 0 0 1 28 0v3" fill="none" {...S} strokeWidth={2.4} />
      <Rect x={7} y={25} width={8} height={12} rx={3} fill={GREEN} {...S} />
      <Rect x={33} y={25} width={8} height={12} rx={3} fill={GREEN} {...S} />
      <Path d="M37 37v1a5 5 0 0 1-5 5h-4" fill="none" {...S} />
      <Rect x={21} y={41} width={7} height={4} rx={2} fill={W} {...T} />
    </>
  ),
};

// Repair-category ("service") name → art, matched by keyword (first wins).
const SERVICE_KEYS = [
  [/display|screen/i, 'display'], [/batter|power/i, 'battery'], [/camera/i, 'camera'],
  [/audio|speaker|sound|micro/i, 'audio'], [/port|button|crown|control|charg/i, 'plug'],
  [/motherboard|\bic\b|circuit|hardware|storage|memory/i, 'chip'], [/network|connect|wifi|bluetooth/i, 'signal'],
  [/other|diagnos/i, 'diagnose'], [/performance|overheat|cool/i, 'gauge'],
  [/security|account|virus|data|backup/i, 'lock'], [/software|firmware|\bos\b|operating|upgrade/i, 'gear'],
  [/body|physical|damage|hinge|sensor|accessor|keyboard/i, 'body'],
];

export function serviceArtKey(name) {
  return (SERVICE_KEYS.find(([re]) => re.test(name || '')) || [null, 'diagnose'])[1];
}

export default function RepairArt({ kind, size = 48 }) {
  const draw = ART[kind] || ART.diagnose;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {draw()}
    </Svg>
  );
}
