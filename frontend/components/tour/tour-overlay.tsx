'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTour } from './tour-provider';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

const PADDING = 8;

export function TourOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const observerRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number>(0);

  const updateRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
      bottom: r.bottom + PADDING,
      right: r.right + PADDING,
    });
  }, [currentStep]);

  // Scroll target into view + update rect when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait for scroll to settle before measuring
      const timer = setTimeout(updateRect, 400);
      return () => clearTimeout(timer);
    }

    // Element not in DOM yet — use MutationObserver to wait for it
    observerRef.current = new MutationObserver(() => {
      const found = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (found) {
        found.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(updateRect, 400);
        observerRef.current?.disconnect();
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => observerRef.current?.disconnect();
  }, [isActive, currentStep, updateRect]);

  // Keep rect updated on scroll/resize
  useEffect(() => {
    if (!isActive) return;

    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    };

    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);

    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, updateRect]);

  // Position tooltip relative to target
  useEffect(() => {
    if (!targetRect || !currentStep) {
      setTooltipStyle({ display: 'none' });
      return;
    }

    const tooltipWidth = 340;
    const tooltipGap = 12;
    const placement = currentStep.placement || 'bottom';
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + tooltipGap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipGap - 160; // estimate tooltip height
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - 80;
        left = targetRect.right + tooltipGap;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - 80;
        left = targetRect.left - tooltipWidth - tooltipGap;
        break;
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, vw - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, vh - 200));

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    });
  }, [targetRect, currentStep]);

  if (!isActive || !currentStep) return null;

  // Build clip-path to create spotlight hole in overlay
  const clipPath = targetRect
    ? `polygon(
        0% 0%, 0% 100%,
        ${targetRect.left}px 100%,
        ${targetRect.left}px ${targetRect.top}px,
        ${targetRect.right}px ${targetRect.top}px,
        ${targetRect.right}px ${targetRect.bottom}px,
        ${targetRect.left}px ${targetRect.bottom}px,
        ${targetRect.left}px 100%,
        100% 100%, 100% 0%
      )`
    : 'none';

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        className="tour-backdrop fixed inset-0"
        style={{ clipPath, zIndex: 9998 }}
        onClick={skipTour}
      />

      {/* Spotlight border highlight */}
      {targetRect && (
        <div
          className="fixed rounded-lg ring-2 ring-primary-500 ring-offset-2 pointer-events-none"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            zIndex: 9998,
          }}
        />
      )}

      {/* Tooltip */}
      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>

          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 pr-4">
                {currentStep.title}
              </h3>
              <button
                onClick={skipTour}
                className="text-slate-400 hover:text-slate-600 transition shrink-0"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {currentStep.content}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {currentStepIndex + 1} of {totalSteps}
              </span>
              <div className="flex gap-2">
                {currentStepIndex > 0 && (
                  <button
                    onClick={prevStep}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition"
                >
                  {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
                  {currentStepIndex < totalSteps - 1 && (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
