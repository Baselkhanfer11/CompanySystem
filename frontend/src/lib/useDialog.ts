import { useCallback, useEffect, useRef } from 'react';

/**
 * The keyboard behaviour every dialog needs: Escape closes it (the same as
 * clicking the backdrop), Tab stays inside it, it takes focus when it opens,
 * and focus goes back to where it was when it closes. Pass the result as the
 * `ref` of the `.modal` element. Only the topmost dialog reacts, so a confirm
 * box over a form closes alone.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose; // always the latest, without re-attaching the listener
  });
  const detach = useRef<(() => void) | null>(null);

  // A callback ref, so it also works for a dialog that renders nothing until
  // it's opened: it runs when the element appears and again when it goes.
  return useCallback((dialog: T | null) => {
    detach.current?.();
    detach.current = null;
    if (!dialog) return;

    // Where focus came from, to put it back when the dialog closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // After the browser applied any autoFocus inside the dialog.
    const focusTimer = requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return;
      const first = focusable(dialog)[0];
      if (first) first.focus();
      else {
        dialog.tabIndex = -1;
        dialog.focus();
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (!isTopmost(dialog)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable(dialog);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    detach.current = () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
}

// The dialog on top is the last backdrop in the page.
function isTopmost(dialog: HTMLElement): boolean {
  const overlays = document.querySelectorAll('.modal-overlay');
  return overlays.length > 0 && overlays[overlays.length - 1].contains(dialog);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Everything inside the dialog that Tab can reach (hidden controls, like a file
// input behind a button, are skipped).
function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}
