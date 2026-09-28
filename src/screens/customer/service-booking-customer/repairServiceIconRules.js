// Semantic icon rules for the Select Repair Service screen. Pure data (icon
// NAMES only) so the mapping can be audited without React: the screen turns a
// name into a lucide component via repairServiceIcons.js. Presentation only —
// nothing here touches service ids, names or order.
//
// Rules are checked top to bottom against the lower-cased service name; the
// first match wins, so more specific phrases come before generic words.

export const SERVICE_ICON_RULES = [
  // ---- audio / microphone ----
  [/earpiece/, 'Ear'],
  [/echo/, 'AudioLines'],
  [/voice distortion|audio distortion|distorted sound/, 'AudioWaveform'],
  [/crackling/, 'AudioWaveform'],
  [/sound cutting|cutting out/, 'VolumeOff'],
  [/calling audio|calling/, 'PhoneCall'],
  [/low microphone|microphone not working|mic not/, 'MicOff'],
  [/microphone/, 'Mic'],
  [/no sound/, 'VolumeX'],
  [/low sound/, 'Volume1'],
  [/speaker grill/, 'Grid3x3'],
  [/speaker driver/, 'Disc3'],
  [/speaker battery/, 'BatteryFull'],
  [/speaker not working/, 'VolumeX'],
  [/speaker/, 'Speaker'],
  [/amplifier ic/, 'AudioLines'],
  [/audio ic/, 'AudioLines'],
  [/audio jack|headphone jack|aux/, 'Headphones'],
  [/audio device diagnosis/, 'Headphones'],

  // ---- battery / charging / power ----
  [/wireless charging/, 'Zap'],
  [/charging ic/, 'BatteryCharging'],
  [/charging dock/, 'PlugZap'],
  [/charging cable|charger|adapter|power adapter/, 'Cable'],
  [/charging port|charging connector|dc jack/, 'PlugZap'],
  [/battery draining/, 'BatteryLow'],
  [/battery replacement/, 'BatteryFull'],
  [/battery/, 'Battery'],
  [/not charging/, 'BatteryWarning'],
  [/slow charging/, 'BatteryMedium'],
  [/power ic/, 'Zap'],
  [/power button/, 'Power'],
  [/not powering on|power-on issue|no power/, 'PowerOff'],
  [/random shutdown/, 'PowerOff'],
  [/auto restart|random restart/, 'RotateCcw'],

  // ---- network / connectivity ----
  [/bluetooth ic/, 'BluetoothSearching'],
  [/network ic/, 'RadioTower'],
  [/tws pairing|phone pairing|pairing/, 'Link'],
  [/connection dropping/, 'Unlink'],
  [/bluetooth/, 'Bluetooth'],
  [/wi-?fi/, 'WifiOff'],
  [/mobile network|no network/, 'SignalZero'],
  [/signal/, 'SignalLow'],
  [/mobile data/, 'ArrowDownUp'],
  [/sim not detected|sim tray/, 'CreditCard'],
  [/gps/, 'Navigation'],
  [/app sync/, 'RefreshCw'],
  [/usb connectivity/, 'Usb'],

  // ---- ports / buttons ----
  [/usb port/, 'Usb'],
  [/hdmi/, 'MonitorUp'],
  [/lan port/, 'Network'],
  [/sd card/, 'MemoryStick'],
  [/connector repair/, 'Cable'],
  [/volume button/, 'Volume2'],
  [/mute button/, 'BellOff'],
  [/play\/pause/, 'CirclePlay'],
  [/mode button/, 'ToggleLeft'],
  [/side button/, 'RectangleVertical'],
  [/crown/, 'CircleDot'],
  [/control panel/, 'SlidersHorizontal'],
  [/button damage|button not working/, 'CircleOff'],
  [/remote/, 'Tv'],

  // ---- camera ----
  [/camera glass/, 'ScanLine'],
  [/camera not working/, 'CameraOff'],
  [/blurry|blur/, 'Focus'],
  [/webcam/, 'Webcam'],
  [/front camera/, 'SwitchCamera'],
  [/camera/, 'Camera'],

  // ---- display / touch ----
  [/ghost touch/, 'Fingerprint'],
  [/touchpad not working/, 'MousePointer2'],
  [/touchpad/, 'MousePointer2'],
  [/touch/, 'Hand'],
  [/flicker/, 'Activity'],
  [/no display/, 'MonitorOff'],
  [/cracked|broken/, 'ShieldAlert'],
  [/display cable/, 'Cable'],
  [/backlight/, 'SunDim'],
  [/lcd|led screen|display replacement/, 'MonitorSmartphone'],
  [/bezel/, 'Frame'],

  // ---- body / physical ----
  [/water|liquid/, 'Droplets'],
  [/back glass|glass replacement/, 'PanelTop'],
  [/back panel|back cover/, 'RectangleVertical'],
  [/frame/, 'SquareDashed'],
  [/strap/, 'Watch'],
  [/hinge/, 'BookOpen'],
  [/cabinet|body repair/, 'Hammer'],
  [/physical damage/, 'ShieldAlert'],

  // ---- keyboard ----
  [/individual key/, 'Keyboard'],
  [/keyboard/, 'Keyboard'],

  // ---- motherboard / hardware ----
  [/short circuit/, 'ZapOff'],
  [/motherboard|circuit repair/, 'CircuitBoard'],
  [/bios|uefi|cmos/, 'Settings2'],
  [/processor/, 'Cpu'],
  [/\bram\b|memory/, 'MemoryStick'],
  [/\bic\b/, 'Cpu'],

  // ---- storage / data ----
  [/cloning/, 'Copy'],
  [/data backup/, 'CloudUpload'],
  [/data recovery/, 'DatabaseBackup'],
  [/data transfer/, 'ArrowLeftRight'],
  [/not detected/, 'HardDrive'],
  [/ssd|hdd|storage/, 'HardDrive'],

  // ---- performance / cooling ----
  [/thermal paste/, 'Thermometer'],
  [/fan noise/, 'Fan'],
  [/fan|cooling/, 'Fan'],
  [/overheat/, 'ThermometerSun'],
  [/hanging|freez/, 'Snowflake'],
  [/performance optimization/, 'Rocket'],
  [/slow performance|performance/, 'Gauge'],
  [/cleaning/, 'Sparkles'],
  [/preventive maintenance/, 'CalendarCheck'],

  // ---- software / os ----
  [/boot loop/, 'RefreshCcw'],
  [/stuck on logo/, 'LoaderCircle'],
  [/factory reset|software reset|software restore|system formatting/, 'RotateCcw'],
  [/firmware update|software update|os update|os upgrade/, 'RefreshCw'],
  [/firmware/, 'Cpu'],
  [/windows|os installation/, 'MonitorCog'],
  [/driver installation/, 'Download'],
  [/software installation/, 'Download'],
  [/app\/os|app\/software/, 'TriangleAlert'],
  [/software/, 'Code'],

  // ---- security / account ----
  [/antivirus/, 'ShieldCheck'],
  [/virus|malware/, 'Bug'],
  [/security/, 'ShieldCheck'],
  [/screen lock|password\/lock/, 'Lock'],
  [/password|pin issue/, 'KeyRound'],
  [/account login/, 'UserRound'],

  // ---- sensors ----
  [/heart rate/, 'HeartPulse'],
  [/spo/, 'Activity'],
  [/step counter/, 'Footprints'],
  [/motion sensor/, 'Move'],
  [/sleep tracking/, 'Moon'],

  // ---- diagnosis / other ----
  [/laptop diagnosis/, 'Laptop'],
  [/mobile diagnosis/, 'Smartphone'],
  [/smartwatch diagnosis/, 'Watch'],
  [/tablet diagnosis/, 'Tablet'],
  [/intermittent/, 'Activity'],
  [/diagnosis/, 'SearchCheck'],
  [/other repair/, 'Wrench'],
];

// Category fallback (only used if no service rule matches).
export const GROUP_ICON_RULES = [
  [/\bother\b|diagnos/, 'Ellipsis'],
  [/motherboard|circuit|hardware|\bic\b/, 'CircuitBoard'],
  [/keyboard|touchpad/, 'Keyboard'],
  [/ports?\b|connector/, 'Cable'],
  [/audio|mic|speaker|sound/, 'Volume2'],
  [/display|touch|screen/, 'Smartphone'],
  [/battery|charg|power/, 'BatteryCharging'],
  [/camera/, 'Camera'],
  [/network|connect|bluetooth|wi-?fi/, 'Wifi'],
  [/performance|cooling|overheat/, 'Gauge'],
  [/software|firmware|operating system|\bos\b/, 'Code'],
  [/security|virus|account/, 'ShieldCheck'],
  [/data|storage|memory|backup/, 'Database'],
  [/water|liquid/, 'Droplets'],
  [/sensor/, 'Activity'],
  [/hinge/, 'BookOpen'],
  [/button|port|crown/, 'Power'],
  [/body|physical|damage/, 'ShieldAlert'],
  [/upgrade|maintenance/, 'Wrench'],
  [/accessor/, 'Cable'],
];

export const DEFAULT_ICON = 'Wrench';

const pick = (rules, text) => {
  for (const [re, name] of rules) if (re.test(text)) return name;
  return null;
};

// -> { name, source: 'service' | 'group' | 'default' }
export function resolveServiceIconName(serviceName, groupCode, groupName) {
  const s = String(serviceName || '').toLowerCase().trim();
  const byService = pick(SERVICE_ICON_RULES, s);
  if (byService) return { name: byService, source: 'service' };
  const g = `${groupCode || ''} ${groupName || ''}`.toLowerCase();
  const byGroup = pick(GROUP_ICON_RULES, g);
  if (byGroup) return { name: byGroup, source: 'group' };
  return { name: DEFAULT_ICON, source: 'default' };
}

export function resolveGroupIconName(groupCode, groupName) {
  const g = `${groupCode || ''} ${groupName || ''}`.toLowerCase();
  return pick(GROUP_ICON_RULES, g) || DEFAULT_ICON;
}
