// Types for the dashboard components shared with the Partner app
// (components/dashboard/*). Type-only — erased at build time.
import type { LucideIcon } from 'lucide-react-native';

export interface DashboardTool {
  key: string;
  label: string;
  icon: LucideIcon;
  color?: string;
  /** Optional explicit glyph colour / circle fill (solid-icon tiles); default derives from `color`. */
  iconColor?: string;
  iconBg?: string;
  /** Anything the screen's onPress handler needs (route, params, …). */
  [extra: string]: unknown;
}

export interface StatusTone {
  dot: string;
  text: string;
  bg: string;
}
