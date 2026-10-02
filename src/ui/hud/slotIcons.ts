import type { ShellType } from '../../data/types';
import { REPAIR_ICON_SVG } from './ProgressRing';

export type SlotIconKind =
  | ShellType
  | 'APDS'
  | 'SMOKE'
  | 'mg'
  | 'repair'
  | 'extinguish'
  | 'scope'
  | 'default';

const shellSvg = (nose: string, detail = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 8 L8 19 L16 19 L16 8 ${nose} Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 19 H17 M8 16 H16" stroke="currentColor" stroke-width="1.4"/>${detail}</svg>`;

const SHELL_ICONS: Readonly<Record<SlotIconKind, string>> = {
  AP: shellSvg('L12 3 Z'),
  APC: shellSvg('L10 5 L14 5 Z', '<path d="M10 5 L14 5" stroke="#d8e7f0" stroke-width="2"/>'),
  APBC: shellSvg('L9 5 L15 5 Z', '<path d="M9 5 Q12 3 15 5" stroke="#d8e7f0" stroke-width="1.5"/>'),
  APCBC: shellSvg('L10 4 L14 4 Z', '<path d="M10 4 L14 4 M9 6 H15" stroke="#d8e7f0" stroke-width="1.4"/>'),
  APHE: shellSvg('L12 3 Z', '<path d="M9 12 H15 V16 H9 Z" fill="#d99045" opacity=".8"/>'),
  APHEBC: shellSvg('L9 5 L15 5 Z', '<path d="M9 5 Q12 3 15 5 M9 12 H15 V16 H9 Z" stroke="#d8e7f0" fill="#d99045" opacity=".85"/>'),
  'APCBC-HE': shellSvg('L10 4 L14 4 Z', '<path d="M10 4 L14 4 M9 6 H15" stroke="#d8e7f0" stroke-width="1.4"/><path d="M9 13 H15 V16 H9 Z" fill="#d99045" opacity=".8"/>'),
  APCR:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 8 L8 19 H16 V8 L14 5 H10 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 3 L10.5 7 V18 H13.5 V7 Z" fill="#d8e7f0" stroke="currentColor" stroke-width="1.2"/><path d="M7 19 H17" stroke="currentColor" stroke-width="1.4"/></svg>',
  APDS:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 10 L5 7 M16 10 L19 7 M8 10 L8 19 H16 V10" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 3 L10.5 7 V19 H13.5 V7 Z" fill="#d8e7f0" stroke="currentColor" stroke-width="1.4"/><path d="M7 19 H17" stroke="currentColor" stroke-width="1.4"/></svg>',
  HEAT:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 8 L12 3 L16 8 V19 H8 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.5 8 L12 5.5 L14.5 8 L12 11 Z" fill="#d8e7f0" stroke="currentColor" stroke-width="1.2"/><path d="M7 19 H17" stroke="currentColor" stroke-width="1.4"/></svg>',
  HE:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 8 Q8 5 10 5 H14 Q16 5 16 8 V19 H8 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 6 H15 V10 H9 Z" fill="#ff5a4a" stroke="#ff8a7f" stroke-width="1"/><path d="M7 19 H17" stroke="currentColor" stroke-width="1.4"/></svg>',
  HESH:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 8 Q8 6 10 6 H14 Q16 6 16 8 V19 H8 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 7 H15 V9 H9 Z" fill="#d8e7f0"/><path d="M7 19 H17 M9 12 H15" stroke="currentColor" stroke-width="1.4"/></svg>',
  SMOKE:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M8 11 H16 V19 H8 Z M7 19 H17" stroke="currentColor" stroke-width="1.4"/><path d="M10 9 C8 7 11 6 10 4 M14 9 C12 7 15 6 14 4" stroke="#b9c0c5" stroke-width="1.5" stroke-linecap="round"/><path d="M9 13 H15" stroke="#9da7ad" stroke-width="2"/></svg>',
  mg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M6 15 L6 9 C6 7 8 5 9 5 C10 5 12 7 12 9 V15 Z M12 15 L12 9 C12 7 14 5 15 5 C16 5 18 7 18 9 V15 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 15 H19 M7 18 H17" stroke="currentColor" stroke-width="1.4"/></svg>',
  repair: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img">${REPAIR_ICON_SVG}</svg>`,
  extinguish:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><path d="M10 5 V3 H14 V5 M12 3 V2 H17 V4 M9 7 H15 L16 10 V19 H8 V10 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 13 H15 V17 H9 Z" fill="#ff5a4a" opacity=".75"/><path d="M16 8 C19 8 19 11 17 12" stroke="currentColor" stroke-width="1.3"/></svg>',
  scope:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M12 2 V9 M12 15 V22 M2 12 H9 M15 12 H22 M10.5 12 H13.5 M12 10.5 V13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  default: shellSvg('L12 3 Z'),
};

export function shellIconKind(shellType: string): SlotIconKind {
  switch (shellType as ShellType | 'APDS' | 'SMOKE') {
    case 'AP':
    case 'APC':
    case 'APBC':
    case 'APCBC':
    case 'APHE':
    case 'APHEBC':
    case 'APCBC-HE':
    case 'APCR':
    case 'APDS':
    case 'HEAT':
    case 'HE':
    case 'HESH':
    case 'SMOKE':
      return shellType as SlotIconKind;
    default:
      return 'default';
  }
}

export function slotIconSvg(kind: SlotIconKind): string {
  return SHELL_ICONS[kind] ?? SHELL_ICONS.default;
}
