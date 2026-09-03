import React from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Icons transcribed from the inline SVGs in
 * design-reference/attendance-app-mockup.html so the app keeps the mockup's
 * exact line-drawn, industrial character. All are 24x24 stroke icons.
 */

export interface IconProps {
  size?: number;
  /** ColorValue, not string — navigation passes its own opaque color tokens. */
  color?: ColorValue;
  strokeWidth?: number;
}

function base({ size = 20, color = colors.ink, strokeWidth = 2 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** The brand mark / time-entry glyph: a site building. */
export function SiteIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M3 21h18" />
      <Path d="M5 21V7l7-4 7 4v14" />
      <Path d="M9 9h1" />
      <Path d="M9 13h1" />
      <Path d="M14 9h1" />
      <Path d="M14 13h1" />
      <Path d="M9 21v-4h6v4" />
    </Svg>
  );
}

/** Simplified building used in activity rows. */
export function SiteGlyph(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M5 21V7l7-4 7 4v14" />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

/** Time In. */
export function PlusIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Time Out. */
export function ExitIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M9 12h12M17 8l4 4-4 4" />
      <Path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    </Svg>
  );
}

/** Padlock, for the biometric note. */
export function LockIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Rect x="5" y="11" width="14" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

/** Cash advance / Pay. */
export function CashIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
      <Path d="M4 6v14a2 2 0 0 0 2 2h14v-4" />
      <Path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M8 2v4M16 2v4M3 10h18" />
      <Rect x="3" y="4" width="18" height="18" rx="2" />
    </Svg>
  );
}

/** Cutoff pay (peso-ish currency stroke). */
export function CurrencyIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M12 8v4l3 3" />
      <Circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

export function ApprovalsIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M9 11l3 3L22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function TeamIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function MapPinIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function FileIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M8 13h8M8 17h8" />
    </Svg>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Path d="M12 3v12" />
    </Svg>
  );
}

export function IdCardIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Circle cx="8.5" cy="12" r="2.5" />
      <Path d="M14 10h5M14 14h5" />
    </Svg>
  );
}

export function LogoutIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </Svg>
  );
}

export function PlusCircleIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

/* --------------------------------------------- Web dashboard nav icons --- */
/* Added for the src/web/ glass shell (R3U-WAA-WEB-REDESIGN.md). Same 24x24
 * stroke convention as the icons above, kept in this file rather than
 * src/web/ so every icon in the app still comes from one set. */

export function ChartIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M4 20V10M12 20V4M20 20v-7" />
    </Svg>
  );
}

export function PayslipIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Rect x="3.5" y="5" width="17" height="14" rx="3" />
      <Path d="M3.5 10h17M8 14.5h4" />
    </Svg>
  );
}

export function WalletIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 8.2v7.6M9.3 15.2c0 1 1 1.7 2.7 1.7 1.9 0 2.9-.8 2.9-1.9 0-2.7-5.6-1.3-5.6-4 0-1.1 1-1.9 2.7-1.9 1.5 0 2.5.6 2.7 1.6" />
    </Svg>
  );
}

export function DoorExitIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M6 12l4 4L20 6" />
      <Path d="M3 19h3" />
    </Svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3.5v2.4M12 18v2.4M4.9 6.4l1.7 1.7M17.4 17.4l1.7 1.7M3.5 12h2.4M18 12h2.4M4.9 17.6l1.7-1.7M17.4 6.6l1.7-1.7" />
    </Svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="12" cy="12" r="4.2" />
      <Path d="M12 2.5v2.4M12 19v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </Svg>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </Svg>
  );
}

/** Biometric quick-login glyph — a fingerprint, standing in generically for
 * "fingerprint, Face ID, or device passcode" (the actual method used is
 * whatever the phone itself picks; the button doesn't need to guess which). */
export function FingerprintIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 1.7.2 3 .6 4" />
      <Path d="M12 3.5c4.7 0 8.5 3.8 8.5 8.5 0 1-.1 2.2-.3 3" />
      <Path d="M7.5 20.5A10 10 0 0 1 6 12c0-3.3 2.7-6 6-6s6 2.7 6 6c0 .6 0 1.2-.1 1.7" />
      <Path d="M9.8 20.2C9 18 8.5 15.3 8.5 12a3.5 3.5 0 1 1 7 0c0 2 .3 3.9.9 5.5" />
      <Path d="M12 12v1.5c0 2.4.5 4.7 1.4 6.8" />
    </Svg>
  );
}

/** "System" mode glyph — a monitor, for the light/dark/system 3-way switcher. */
export function MonitorIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Rect x="2.5" y="4" width="19" height="13" rx="1.6" />
      <Path d="M8.5 21h7M12 17v4" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...base(p)}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20.5 20.5L16 16" />
    </Svg>
  );
}
