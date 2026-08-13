import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  pullThreshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  pullThreshold = 80
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const touchStartY = useRef(0);
  const touchMoveY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current || document.body;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start gesture if scrolled at the very top
      const scrollTop = window.scrollY || document.documentElement.scrollTop || container.scrollTop || 0;
      if (scrollTop <= 5 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop || container.scrollTop || 0;
      if (scrollTop > 10) {
        isDragging.current = false;
        setPullDistance(0);
        return;
      }

      touchMoveY.current = e.touches[0].clientY;
      const distance = touchMoveY.current - touchStartY.current;

      if (distance > 0) {
        // Resistance formula for smooth pulling feel
        const dampenedDistance = Math.min(distance * 0.45, pullThreshold + 40);
        setPullDistance(dampenedDistance);

        // Prevent default browser rubber-banding if dragging down from top
        if (distance > 15 && e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (pullDistance >= pullThreshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(pullThreshold);

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default action: clear caches & force hard reload
            try {
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
              }
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                  await reg.update();
                }
              }
            } catch (cErr) {
              console.warn("[PullToRefresh] Cache purge warning:", cErr);
            }
            await new Promise((resolve) => setTimeout(resolve, 600));
            window.location.reload();
          }
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 2500);
        } catch (err) {
          console.error('[PullToRefresh] Error refreshing:', err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, pullThreshold, onRefresh]);

  const progressRatio = Math.min(pullDistance / pullThreshold, 1);
  const rotationDegrees = progressRatio * 360;

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* Pull To Refresh Top Indicator Bar */}
      <AnimatePresence>
        {(pullDistance > 10 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: Math.min(pullDistance, pullThreshold) - 40 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
          >
            <div className="bg-slate-900/95 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-black uppercase tracking-wider">
              <RefreshCw
                size={16}
                className={`text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`}
                style={{ transform: !isRefreshing ? `rotate(${rotationDegrees}deg)` : undefined }}
              />
              <span>
                {isRefreshing
                  ? 'A atualizar dados...'
                  : pullDistance >= pullThreshold
                  ? 'Solte para atualizar'
                  : 'Puxe para atualizar'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 10, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
          >
            <div className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <CheckCircle2 size={16} />
              <span>Aplicação Atualizada!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : 'none',
          transition: isDragging.current ? 'none' : 'transform 0.25s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
};
