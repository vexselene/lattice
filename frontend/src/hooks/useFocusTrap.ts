import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Custom hook to trap focus within a container (e.g. modal dialog).
 * Cycles Tab / Shift+Tab within focusable elements, redirects outside focus,
 * handles Escape key to close, and restores focus to previous active element on close.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean = true,
  onClose?: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
  shouldRestoreFocus: boolean | (() => boolean) = true
) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;
  const shouldRestoreFocusRef = useRef(shouldRestoreFocus);
  shouldRestoreFocusRef.current = shouldRestoreFocus;

  useEffect(() => {
    if (!isActive) return;

    // Store element that was focused before opening (only if not already stored)
    if (!previousActiveElementRef.current) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    const container = containerRef.current;
    if (!container) return;

    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) =>
          !el.hasAttribute('disabled') &&
          el.getAttribute('tabindex') !== '-1' &&
          (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
      );
    };

    const focusInitial = () => {
      if (!container || container.contains(document.activeElement)) return;

      const initRef = initialFocusRefRef.current;
      // Priority 1: explicitly designated initialFocusRef
      if (initRef?.current && container.contains(initRef.current)) {
        initRef.current.focus();
        return;
      }

      // Priority 2: element with [autofocus] attribute
      const autoFocusEl = container.querySelector<HTMLElement>('[autofocus]:not([disabled])');
      if (
        autoFocusEl &&
        (autoFocusEl.offsetWidth > 0 || autoFocusEl.offsetHeight > 0 || autoFocusEl.getClientRects().length > 0)
      ) {
        autoFocusEl.focus();
        return;
      }

      // Priority 3: fallback to first focusable element
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    };

    // Ensure focus is inside the container
    const initTimer = setTimeout(focusInitial, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: moving backwards
          if (
            document.activeElement === firstElement ||
            !container.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: moving forwards
          if (
            document.activeElement === lastElement ||
            !container.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (container && !container.contains(e.target as Node)) {
        const initRef = initialFocusRefRef.current;
        if (initRef?.current && container.contains(initRef.current)) {
          e.preventDefault();
          initRef.current.focus();
          return;
        }

        const autoFocusEl = container.querySelector<HTMLElement>('[autofocus]:not([disabled])');
        if (autoFocusEl) {
          e.preventDefault();
          autoFocusEl.focus();
          return;
        }

        const focusables = getFocusableElements();
        if (focusables.length > 0) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      clearTimeout(initTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);

      const restore = shouldRestoreFocusRef.current;
      const shouldRestore =
        typeof restore === 'function' ? restore() : restore;

      if (shouldRestore) {
        const prev = previousActiveElementRef.current;
        if (prev && typeof prev.focus === 'function') {
          setTimeout(() => {
            prev.focus();
          }, 10);
        }
      }
      previousActiveElementRef.current = null;
    };
  }, [isActive, containerRef]);
}

export default useFocusTrap;
