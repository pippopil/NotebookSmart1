import { useEffect, useRef } from 'react';

interface UseSwipeBackOptions {
  onBack: () => void;
  enabled?: boolean;
  threshold?: number;
}

/**
 * Custom hook to detect swipe gestures on mobile screens
 * Swiping horizontally (e.g. from right-to-left or left-edge-to-right) returns to the main notes screen
 * preventing accidental browser minimize or exit.
 */
export function useSwipeBack({
  onBack,
  enabled = true,
  threshold = 75,
}: UseSwipeBackOptions) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      // Do not trigger swipe-back if touching horizontal toolbars, vertical scrollers, buttons or inputs
      if (
        target &&
        (target.closest('.overflow-x-auto') ||
          target.closest('.overflow-y-auto') ||
          target.closest('[data-no-swipe]') ||
          target.closest('.no-swipe') ||
          target.closest('header') ||
          target.closest('nav') ||
          target.closest('footer') ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('textarea') ||
          target.closest('select'))
      ) {
        isSwiping.current = false;
        return;
      }

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isSwiping.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current || e.touches.length !== 1) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - touchStartX.current;
      const deltaY = currentY - touchStartY.current;

      // Only handle clear left-edge horizontal swipe so vertical scroll is never blocked
      if (touchStartX.current < 35 && deltaX > 20 && Math.abs(deltaX) > Math.abs(deltaY) * 1.8) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;
      const currentX = e.changedTouches[0].clientX;
      const currentY = e.changedTouches[0].clientY;
      const deltaX = currentX - touchStartX.current;
      const deltaY = currentY - touchStartY.current;

      // Only deliberate full-gesture swipes trigger back navigation:
      // either swipe from left edge (deltaX > 60) or deliberate long swipe across background (deltaX > threshold)
      const isDeliberateSwipe =
        Math.abs(deltaX) > threshold &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.6;

      const isLeftEdgeSwipe =
        touchStartX.current < 35 &&
        deltaX > 60 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

      if (isDeliberateSwipe || isLeftEdgeSwipe) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
        onBack();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onBack, enabled, threshold]);
}
