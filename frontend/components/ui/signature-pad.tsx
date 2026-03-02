'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

interface SignaturePadProps {
  onEnd?: (dataUrl: string) => void;
  height?: number;
  penColor?: string;
  disabled?: boolean;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onEnd, height = 150, penColor = '#1e293b', disabled = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);
      // Clear on resize since content is lost
      padRef.current?.clear();
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pad = new SignaturePadLib(canvas, {
        penColor,
        backgroundColor: 'rgba(255, 255, 255, 0)',
      });

      pad.addEventListener('endStroke', () => {
        if (onEnd && !pad.isEmpty()) {
          onEnd(pad.toDataURL('image/png'));
        }
      });

      padRef.current = pad;

      // Initial sizing
      resizeCanvas();

      // Resize on window change
      window.addEventListener('resize', resizeCanvas);

      return () => {
        pad.off();
        window.removeEventListener('resize', resizeCanvas);
      };
    }, [penColor, onEnd, resizeCanvas]);

    useEffect(() => {
      if (padRef.current) {
        if (disabled) padRef.current.off();
        else padRef.current.on();
      }
    }, [disabled]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        padRef.current?.clear();
        onEnd?.('');
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
    }));

    function handleClear() {
      padRef.current?.clear();
      onEnd?.('');
    }

    return (
      <div className="space-y-1">
        <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            style={{ height: `${height}px` }}
            className="w-full cursor-crosshair touch-none"
          />
          {/* Signing line */}
          <div
            className="absolute left-4 right-4 border-b border-slate-300"
            style={{ bottom: '30%' }}
          />
          {/* Placeholder text */}
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-400 pointer-events-none select-none">
            Sign above the line
          </span>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
            disabled={disabled}
          >
            Clear signature
          </button>
        </div>
      </div>
    );
  },
);
