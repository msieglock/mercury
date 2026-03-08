'use client';

import { useEffect, useCallback, useRef } from 'react';

interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
  action: () => void;
}

/** Key sequence timeout (ms) — e.g. press "g" then "i" within this window */
const SEQUENCE_TIMEOUT = 800;

export function useHotkeys(hotkeys: HotkeyAction[], enabled = true) {
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  const pendingPrefix = useRef<string | null>(null);
  const prefixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPrefix = useCallback(() => {
    pendingPrefix.current = null;
    if (prefixTimer.current) {
      clearTimeout(prefixTimer.current);
      prefixTimer.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Suppress in input fields (allow Escape always)
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      ) {
        if (e.key !== 'Escape') return;
      }

      const pressedKey = e.key;

      // Check for key sequences (e.g. "g i" mapped as key: "g i")
      if (pendingPrefix.current) {
        const seq = `${pendingPrefix.current} ${pressedKey}`;
        clearPrefix();

        for (const hotkey of hotkeysRef.current) {
          if (hotkey.key === seq) {
            e.preventDefault();
            e.stopPropagation();
            hotkey.action();
            return;
          }
        }
        // Sequence didn't match — fall through to single-key check
      }

      for (const hotkey of hotkeysRef.current) {
        // Check if this is a sequence prefix (e.g. "g i" starts with pressed key "g")
        if (hotkey.key.includes(' ') && hotkey.key.startsWith(pressedKey + ' ')) {
          // Don't start sequences if modifiers are held
          if (e.ctrlKey || e.metaKey || e.altKey) continue;
          if (e.shiftKey) continue;
          e.preventDefault();
          pendingPrefix.current = pressedKey;
          prefixTimer.current = setTimeout(clearPrefix, SEQUENCE_TIMEOUT);
          return;
        }

        const keyMatch =
          pressedKey.toLowerCase() === hotkey.key.toLowerCase() ||
          e.code.toLowerCase() === hotkey.key.toLowerCase();

        if (!keyMatch) continue;
        if (!!hotkey.ctrl !== (e.ctrlKey || e.metaKey)) continue;
        if (!!hotkey.shift !== e.shiftKey) continue;
        if (!!hotkey.alt !== e.altKey) continue;

        e.preventDefault();
        e.stopPropagation();
        hotkey.action();
        return;
      }
    },
    [enabled, clearPrefix],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPrefix();
    };
  }, [handleKeyDown, clearPrefix]);
}
