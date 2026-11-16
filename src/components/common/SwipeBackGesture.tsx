import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';

export const SwipeBackGesture: React.FC = () => {
  const { dir } = useLanguage();
  const { canGoBack, goBack } = useApp();

  const [gestureActive, setGestureActive] = useState<boolean>(false);
  const [gestureProgress, setGestureProgress] = useState<number>(0); // 0 to 1
  const [gestureSide, setGestureSide] = useState<'right' | 'left'>('right');
  const [gestureY, setGestureY] = useState<number>(300);

  const touchStartRef = useRef<{ x: number; y: number; time: number; edge: 'left' | 'right' | null } | null>(null);
  const isTrackingRef = useRef<boolean>(false);
  const gestureProgressRef = useRef<number>(0);
  const canGoBackRef = useRef(canGoBack);
  canGoBackRef.current = canGoBack;

  const SWIPE_THRESHOLD = 65; // pixels of movement required
  const EDGE_ZONE = 55; // pixels from screen border to recognize edge swipe

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !canGoBackRef.current) return;
      const touch = e.touches[0];
      const winWidth = window.innerWidth;

      let edge: 'left' | 'right' | null = null;
      if (touch.clientX >= winWidth - EDGE_ZONE) {
        edge = 'right';
      } else if (touch.clientX <= EDGE_ZONE) {
        edge = 'left';
      }

      if (edge) {
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
          edge
        };
        isTrackingRef.current = true;
        gestureProgressRef.current = 0;
      } else {
        touchStartRef.current = null;
        isTrackingRef.current = false;
        gestureProgressRef.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || !touchStartRef.current || !canGoBackRef.current) return;
      const touch = e.touches[0];
      const diffX = touch.clientX - touchStartRef.current.x;
      const diffY = touch.clientY - touchStartRef.current.y;

      // If vertical movement dominates, cancel edge swipe to allow normal page scrolling
      if (Math.abs(diffY) > Math.abs(diffX) * 1.4 && Math.abs(diffY) > 20) {
        isTrackingRef.current = false;
        gestureProgressRef.current = 0;
        setGestureActive(false);
        setGestureProgress(0);
        return;
      }

      // Calculate progress depending on whether swiping from right edge inwards (swipe left)
      // or from left edge inwards (swipe right)
      let progress = 0;
      if (touchStartRef.current.edge === 'right' && diffX < 0) {
        // Swiping left from right edge
        progress = Math.min(Math.abs(diffX) / SWIPE_THRESHOLD, 1.2);
        setGestureSide('right');
      } else if (touchStartRef.current.edge === 'left' && diffX > 0) {
        // Swiping right from left edge
        progress = Math.min(diffX / SWIPE_THRESHOLD, 1.2);
        setGestureSide('left');
      }

      gestureProgressRef.current = progress;

      if (progress > 0.15) {
        setGestureActive(true);
        setGestureProgress(progress);
        setGestureY(touch.clientY);
      } else {
        setGestureActive(false);
        setGestureProgress(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current || !touchStartRef.current) {
        setGestureActive(false);
        setGestureProgress(0);
        gestureProgressRef.current = 0;
        return;
      }

      const finalProgress = gestureProgressRef.current;
      if (finalProgress >= 0.85 && canGoBackRef.current) {
        // Trigger haptic feedback if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate?.(15);
          } catch {
            // Ignore if vibration permissions unavailable
          }
        }
        goBack();
      }

      isTrackingRef.current = false;
      touchStartRef.current = null;
      gestureProgressRef.current = 0;
      setGestureActive(false);
      setGestureProgress(0);
    };

    const handleTouchCancel = () => {
      isTrackingRef.current = false;
      touchStartRef.current = null;
      gestureProgressRef.current = 0;
      setGestureActive(false);
      setGestureProgress(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [goBack]);

  if (!gestureActive || !canGoBack) return null;

  const isTriggerReady = gestureProgress >= 0.85;
  const ArrowIcon = gestureSide === 'right' ? ArrowLeft : ArrowRight;

  return (
    <div
      className="fixed z-50 pointer-events-none transition-all duration-75 ease-out"
      style={{
        top: `${Math.max(80, Math.min(gestureY - 24, window.innerHeight - 100))}px`,
        ...(gestureSide === 'right'
          ? { right: `${Math.max(12, gestureProgress * 24)}px` }
          : { left: `${Math.max(12, gestureProgress * 24)}px` })
      }}
    >
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-full shadow-2xl backdrop-blur-md transition-all ${
          isTriggerReady
            ? 'bg-teal-600 text-white scale-110 shadow-teal-500/40 ring-4 ring-teal-300/40'
            : 'bg-slate-900/90 text-teal-300 scale-95 border border-slate-700/80 shadow-slate-950/30'
        }`}
        style={{
          opacity: Math.min(gestureProgress * 1.4, 1),
          transform: `scale(${0.7 + Math.min(gestureProgress, 1) * 0.4})`
        }}
      >
        <ArrowIcon className="w-5 h-5 transition-transform" />
      </div>
    </div>
  );
};
