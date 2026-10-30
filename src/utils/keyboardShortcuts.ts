import { ActiveTab } from '../types';

export type ShortcutAction =
  | 'toggle-play'
  | 'toggle-record'
  | 'pause-record'
  | 'export'
  | 'save-library'
  | 'open-shortcuts'
  | 'close-modal'
  | 'switch-tab'
  | 'toggle-loop'
  | 'toggle-limiter'
  | 'auto-normalize';

export interface ShortcutDefinition {
  id: string;
  action: ShortcutAction;
  key: string; // e.g. 'Space', 'r', 'e', 'Enter', '1', '?'
  modifiers?: {
    ctrlOrCmd?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
  allowInInput?: boolean;
  descriptionEn: string;
  descriptionKm: string;
  category: 'playback' | 'recording' | 'export' | 'navigation' | 'general';
  targetTab?: ActiveTab;
  badgeText?: string;
}

export interface KeyboardEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: any;
}

export const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  // Playback & Speech Synthesis
  {
    id: 'toggle-play-space',
    action: 'toggle-play',
    key: ' ',
    descriptionEn: 'Play / Pause audio playback or speech preview',
    descriptionKm: 'ចាក់ / ផ្អាកសំឡេង ឬការអាន',
    category: 'playback',
    badgeText: 'Space',
  },
  {
    id: 'toggle-play-ctrl-enter',
    action: 'toggle-play',
    key: 'Enter',
    modifiers: { ctrlOrCmd: true },
    allowInInput: true,
    descriptionEn: 'Quick Play / Generate Speech (works while typing in editor)',
    descriptionKm: 'ចាក់ / បង្កើតសំឡេងរហ័ស (ដំណើរការទោះកំពុងវាយអត្ថបទ)',
    category: 'playback',
    badgeText: 'Ctrl + Enter',
  },
  {
    id: 'toggle-loop',
    action: 'toggle-loop',
    key: 'l',
    descriptionEn: 'Toggle audio region loop playback in trimmer',
    descriptionKm: 'បិទ/បើក ការចាក់សំឡេងឡើងវិញ (Loop) ក្នុងឧបករណ៍កាត់',
    category: 'playback',
    badgeText: 'L',
  },
  {
    id: 'toggle-limiter',
    action: 'toggle-limiter',
    key: 'm',
    descriptionEn: 'Toggle anti-clipping Soft-Knee Limiter (0 dBFS Guard)',
    descriptionKm: 'បិទ/បើក ឧបករណ៍ការពារបែកសំឡេង (Soft-Knee Limiter)',
    category: 'playback',
    badgeText: 'M',
  },
  {
    id: 'auto-normalize',
    action: 'auto-normalize',
    key: 'n',
    descriptionEn: 'Analyze & auto-normalize loudness levels (EBU R128)',
    descriptionKm: 'វិភាគ & ធ្វើឱ្យកម្រិតសំឡេងស្មើគ្នាដោយស្វ័យប្រវត្តិ (Normalize)',
    category: 'playback',
    badgeText: 'N',
  },

  // Voice Recording
  {
    id: 'toggle-record-r',
    action: 'toggle-record',
    key: 'r',
    descriptionEn: 'Start / Stop microphone recording (switches to recorder)',
    descriptionKm: 'ចាប់ផ្តើម / បញ្ឈប់ការថតសំឡេង (ប្តូរទៅផ្ទាំងថត)',
    category: 'recording',
    badgeText: 'R',
  },
  {
    id: 'toggle-record-alt-r',
    action: 'toggle-record',
    key: 'r',
    modifiers: { alt: true },
    allowInInput: true,
    descriptionEn: 'Start / Stop recording immediately from anywhere',
    descriptionKm: 'ចាប់ផ្តើម / បញ្ឈប់ការថតភ្លាមៗពីគ្រប់ទីកន្លែង',
    category: 'recording',
    badgeText: 'Alt + R',
  },
  {
    id: 'pause-record-p',
    action: 'pause-record',
    key: 'p',
    descriptionEn: 'Pause / Resume live microphone recording',
    descriptionKm: 'ផ្អាក / បន្តការថតសំឡេងបន្តផ្ទាល់',
    category: 'recording',
    badgeText: 'P',
  },

  // Export & Library
  {
    id: 'export-e',
    action: 'export',
    key: 'e',
    descriptionEn: 'Open Advanced Export Settings (sample rate & bitrate)',
    descriptionKm: 'បើកផ្ទាំងកំណត់ការទាញយកកម្រិតខ្ពស់ (Export Modal)',
    category: 'export',
    badgeText: 'E',
  },
  {
    id: 'export-ctrl-s',
    action: 'export',
    key: 's',
    modifiers: { ctrlOrCmd: true },
    allowInInput: true,
    descriptionEn: 'Quick Export / Save audio with configured settings',
    descriptionKm: 'ទាញយក ឬរក្សាទុកសំឡេងរហ័សតាមការកំណត់',
    category: 'export',
    badgeText: 'Ctrl + S',
  },
  {
    id: 'save-library-s',
    action: 'save-library',
    key: 's',
    descriptionEn: 'Bookmark & save current audio to studio library',
    descriptionKm: 'រក្សាទុកសំឡេងបច្ចុប្បន្នទៅក្នុងបណ្ណាល័យស្ទូឌីយោ',
    category: 'export',
    badgeText: 'S',
  },

  // Studio Navigation Tabs
  {
    id: 'nav-tts',
    action: 'switch-tab',
    key: '1',
    targetTab: 'tts',
    descriptionEn: 'Switch to Text to Speech Studio (TTS)',
    descriptionKm: 'ប្តូរទៅផ្ទាំងបម្លែងអត្ថបទជាសំឡេង (TTS)',
    category: 'navigation',
    badgeText: '1',
  },
  {
    id: 'nav-subtitles',
    action: 'switch-tab',
    key: '2',
    targetTab: 'subtitles',
    descriptionEn: 'Switch to Subtitle Studio (SRT Dubbing)',
    descriptionKm: 'ប្តូរទៅផ្ទាំងចំណងជើងរងជាសំឡេង (SRT)',
    category: 'navigation',
    badgeText: '2',
  },
  {
    id: 'nav-pitch',
    action: 'switch-tab',
    key: '3',
    targetTab: 'pitch',
    descriptionEn: 'Switch to Pitch Analyzer & F0 Voice Tuner',
    descriptionKm: 'ប្តូរទៅផ្ទាំងវិភាគកម្រិតសំឡេង (Pitch Analyzer)',
    category: 'navigation',
    badgeText: '3',
  },
  {
    id: 'nav-recorder',
    action: 'switch-tab',
    key: '4',
    targetTab: 'recorder',
    descriptionEn: 'Switch to Studio Voice Recorder',
    descriptionKm: 'ប្តូរទៅផ្ទាំងថតសំឡេងស្ទូឌីយោ (Voice Recorder)',
    category: 'navigation',
    badgeText: '4',
  },
  {
    id: 'nav-tools',
    action: 'switch-tab',
    key: '5',
    targetTab: 'tools',
    descriptionEn: 'Switch to Audio Tools, Trimmer & Normalization',
    descriptionKm: 'ប្តូរទៅផ្ទាំងឧបករណ៍កាត់ និងធ្វើឱ្យកម្រិតស្មើគ្នា (Audio Tools)',
    category: 'navigation',
    badgeText: '5',
  },
  {
    id: 'nav-library',
    action: 'switch-tab',
    key: '6',
    targetTab: 'library',
    descriptionEn: 'Open Saved Audio Library Modal',
    descriptionKm: 'បើកផ្ទាំងបណ្ណាល័យសំឡេងដែលបានរក្សាទុក (Library)',
    category: 'navigation',
    badgeText: '6',
  },

  // General & Help
  {
    id: 'open-shortcuts-question',
    action: 'open-shortcuts',
    key: '?',
    descriptionEn: 'Open Keyboard Shortcuts cheat sheet',
    descriptionKm: 'បើកតារាងផ្លូវកាត់ក្ដារចុច (Keyboard Shortcuts)',
    category: 'general',
    badgeText: '?',
  },
  {
    id: 'close-modal-escape',
    action: 'close-modal',
    key: 'Escape',
    allowInInput: true,
    descriptionEn: 'Close active modal dialog or cheat sheet',
    descriptionKm: 'បិទផ្ទាំងប្រអប់ដែលកំពុងបើក (Close Modal)',
    category: 'general',
    badgeText: 'Esc',
  },
];

/**
 * Checks whether an event target is an active editable input, textarea, or contenteditable.
 */
export function isEditableTarget(target: any): boolean {
  if (!target) return false;
  const tagName = target.tagName ? target.tagName.toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Matches an incoming KeyboardEvent against the shortcut registry.
 * Prevents non-allowInInput shortcuts when the user is actively typing in an input.
 */
export function matchKeyboardShortcut(
  event: KeyboardEventLike,
  shortcuts: ShortcutDefinition[] = SHORTCUT_REGISTRY
): ShortcutDefinition | null {
  const isInput = isEditableTarget(event.target);
  const eventKey = event.key;
  const isCtrlOrCmd = !!(event.ctrlKey || event.metaKey);
  const isAlt = !!event.altKey;
  const isShift = !!event.shiftKey;

  for (const sc of shortcuts) {
    // If focused inside an editable input and this shortcut does not explicitly allow it, skip
    if (isInput && !sc.allowInInput) {
      continue;
    }

    const reqCtrlOrCmd = !!sc.modifiers?.ctrlOrCmd;
    const reqAlt = !!sc.modifiers?.alt;
    const reqShift = !!sc.modifiers?.shift;

    if (reqCtrlOrCmd !== isCtrlOrCmd) continue;
    if (reqAlt !== isAlt) continue;

    // Shift check: for '?' key on US keyboards, shiftKey is true, but key is '?'
    if (sc.key === '?') {
      if (eventKey !== '?') continue;
    } else {
      if (reqShift !== isShift) continue;
    }

    // Key comparison (case-insensitive for alphabet keys)
    const keyMatch =
      eventKey.toLowerCase() === sc.key.toLowerCase() ||
      (sc.key === ' ' && (eventKey === ' ' || event.code === 'Space'));

    if (keyMatch) {
      return sc;
    }
  }

  return null;
}

/**
 * Formats a shortcut key badge nicely for the UI (e.g. '⌘ + Enter' on Mac, 'Ctrl + Enter' on Windows).
 */
export function formatShortcutBadge(sc: ShortcutDefinition, isMac: boolean = false): string {
  if (sc.badgeText) {
    if (isMac && sc.badgeText.includes('Ctrl')) {
      return sc.badgeText.replace('Ctrl', '⌘');
    }
    return sc.badgeText;
  }

  const parts: string[] = [];
  if (sc.modifiers?.ctrlOrCmd) parts.push(isMac ? '⌘' : 'Ctrl');
  if (sc.modifiers?.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (sc.modifiers?.shift) parts.push(isMac ? '⇧' : 'Shift');

  let keyDisplay = sc.key;
  if (keyDisplay === ' ') keyDisplay = 'Space';
  else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

  parts.push(keyDisplay);
  return parts.join(' + ');
}

export const VOICETOOL_ACTION_EVENT = 'voicetool:shortcut-action';

/**
 * Dispatches a studio action event that components can listen to.
 */
export function dispatchStudioAction(action: ShortcutAction, payload?: any): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(VOICETOOL_ACTION_EVENT, {
        detail: { action, payload, timestamp: Date.now() },
      })
    );
  }
}
