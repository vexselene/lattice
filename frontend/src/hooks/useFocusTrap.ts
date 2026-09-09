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
  onClose?: () => void
) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store element that was focused before opening
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

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

    // Ensure focus is inside the container
    const initTimer = setTimeout(() => {
      if (container && !container.contains(document.activeElement)) {
        const focusables = getFocusableElements();
        if (focusables.length > 0) {
          focusables[0].focus();
        }
      }
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
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

      const prev = previousActiveElementRef.current;
      if (prev && typeof prev.focus === 'function') {
        setTimeout(() => {
          prev.focus();
        }, 10);
      }
    };
  }, [isActive, containerRef, onClose]);
}

export default useFocusTrap;
