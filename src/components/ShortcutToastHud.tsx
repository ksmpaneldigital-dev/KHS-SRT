import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  Mic,
  Download,
  BookmarkPlus,
  Repeat,
  Shield,
  Gauge,
  Compass,
  Keyboard,
} from 'lucide-react';
import { ShortcutAction } from '../utils/keyboardShortcuts';

export interface ShortcutToastData {
  id: string;
  action: ShortcutAction;
  keyLabel: string;
  messageEn: string;
  messageKm: string;
}

interface ShortcutToastHudProps {
  toast: ShortcutToastData | null;
  onDismiss: () => void;
  isKhmer?: boolean;
}

export const ShortcutToastHud: React.FC<ShortcutToastHudProps> = ({
  toast,
  onDismiss,
  isKhmer = true,
}) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const getActionIcon = () => {
    switch (toast.action) {
      case 'toggle-play':
        return <Play className="w-3.5 h-3.5 text-indigo-400 fill-current" />;
      case 'toggle-record':
      case 'pause-record':
        return <Mic className="w-3.5 h-3.5 text-rose-400" />;
      case 'export':
        return <Download className="w-3.5 h-3.5 text-emerald-400" />;
      case 'save-library':
        return <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />;
      case 'toggle-loop':
        return <Repeat className="w-3.5 h-3.5 text-indigo-400" />;
      case 'toggle-limiter':
        return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
      case 'auto-normalize':
        return <Gauge className="w-3.5 h-3.5 text-indigo-400" />;
      case 'switch-tab':
        return <Compass className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Keyboard className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div
      data-testid="shortcut-toast-hud"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/95 border border-indigo-500/40 shadow-xl shadow-black/60 text-white backdrop-blur-md">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 border border-slate-700/80">
          {getActionIcon()}
        </div>

        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-indigo-300 shadow-inner">
          {toast.keyLabel}
        </kbd>

        <span className="text-xs font-medium text-slate-200">
          {isKhmer ? toast.messageKm : toast.messageEn}
        </span>
      </div>
    </div>
  );
};
