import { useCallback, useEffect, useRef, useState } from "react";
import { useSignatureMachine } from "./hooks";
import type { Point, Stroke } from "./machine";
import { SignatureRenderer } from "./renderer";
import { PenStabilizer } from "./stabilizer";

interface SignaturePadProps {
  width?: number;
  height?: number;
  onChange?: (svg: string) => void;
  onStrokeEnd?: (strokes: Stroke[]) => void;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  stabilizationLevel?: number;
}

export function SignaturePad({
  width = 600,
  height = 300,
  onChange,
  onStrokeEnd,
  className = "",
  strokeColor = "#1a1a1a",
  strokeWidth = 2.5,
  stabilizationLevel = 100,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SignatureRenderer | null>(null);
  const stabilizerRef = useRef<PenStabilizer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerCapturedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width, height });
  const activeStrokeIdRef = useRef<string | null>(null);
  const lastRenderedPointCountRef = useRef(0);

  const { state, send, strokes, canUndo, canRedo } = useSignatureMachine({
    color: strokeColor,
    width: strokeWidth,
  });

  // Handle responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.min(width, rect.width - 32),
        height,
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [width, height]);

  // Initialize renderer and stabilizer
  useEffect(() => {
    if (!canvasRef.current) return;

    rendererRef.current = new SignatureRenderer(canvasRef.current);
    stabilizerRef.current = new PenStabilizer({
      algorithm: "holt",
      level: stabilizationLevel,
      holt: { alpha: 0.18, beta: 0.06 },
      pressure: { mode: "none" },
    });

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
      stabilizerRef.current = null;
    };
  }, []); // Only on mount

  // Handle dimension changes
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${dimensions.width}px`;
      canvasRef.current.style.height = `${dimensions.height}px`;
    }

    if (rendererRef.current) {
      rendererRef.current.resize();
      rendererRef.current.renderStrokes(strokes);
    }
  }, [dimensions]);

  // Get coordinates with proper DPR handling
  const getCoordinates = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pointerType === "pen" ? e.pressure : 0.5,
      timestamp: e.nativeEvent.timeStamp,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      const point = getCoordinates(e);
      if (!point) return;

      // Capture pointer
      const target = e.target as Element;
      target.setPointerCapture(e.pointerId);
      pointerCapturedRef.current = true;

      stabilizerRef.current?.reset();
      lastRenderedPointCountRef.current = 0;
      activeStrokeIdRef.current = null;
      const stabilized = stabilizerRef.current?.addPoint(point) ?? point;

      send({ type: "POINTER_DOWN", point: stabilized });
    },
    [send, getCoordinates],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (state.status !== "drawing") return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const stabilizer = stabilizerRef.current;
      if (!canvas || !stabilizer) return;

      const rect = canvas.getBoundingClientRect();

      const native = e.nativeEvent as PointerEvent;
      const events = native.getCoalescedEvents?.() ?? [native];

      const points: Point[] = [];

      for (const ev of events) {
        const raw: Point = {
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
          pressure: ev.pointerType === "pen" ? ev.pressure : 0.5,
          timestamp: ev.timeStamp, // IMPORTANT: use event timestamp
        };

        points.push(stabilizer.addPoint(raw));
      }

      send({ type: "POINTER_MOVE_BATCH", points });
    },
    [send, state.status],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerCapturedRef.current) {
        const target = e.target as Element;
        target.releasePointerCapture(e.pointerId);
        pointerCapturedRef.current = false;
      }

      send({ type: "POINTER_UP" });
      onStrokeEnd?.(strokes);
    },
    [send, strokes, onStrokeEnd],
  );

  // Reactive rendering
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (state.status === "drawing" && state.currentStroke) {
      const stroke = state.currentStroke;

      // New stroke started
      if (activeStrokeIdRef.current !== stroke.id) {
        activeStrokeIdRef.current = stroke.id;
        lastRenderedPointCountRef.current = 0;
      }

      const pointCount = stroke.points.length;

      // Draw everything added since last time (handles batched updates)
      const lastRendered = lastRenderedPointCountRef.current;
      if (pointCount > lastRendered) {
        renderer.appendStrokeSegments(stroke, lastRendered);
        lastRenderedPointCountRef.current = pointCount;
      }
      return;
    }

    // For undo/redo/clear/completed: full rerender
    activeStrokeIdRef.current = null;
    lastRenderedPointCountRef.current = 0;
    renderer.renderStrokes(strokes);
  }, [state.status, state.currentStroke, strokes]);

  const exportSVG = useCallback(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}">
  <rect width="100%" height="100%" fill="white"/>
  ${strokes
    .map((stroke) => {
      if (stroke.points.length < 2) return "";

      let pathData = `M ${stroke.points[0].x.toFixed(1)} ${stroke.points[0].y.toFixed(1)}`;

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = ((curr.x + next.x) / 2).toFixed(1);
        const midY = ((curr.y + next.y) / 2).toFixed(1);
        pathData += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${midX} ${midY}`;
      }

      if (stroke.points.length > 1) {
        const last = stroke.points[stroke.points.length - 1];
        pathData += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      }

      return `<path d="${pathData}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .filter(Boolean)
    .join("\n  ")}
</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `signature-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);

    onChange?.(svg);

    return svg;
  }, [strokes, dimensions, onChange]);

  const handleClear = useCallback(() => {
    send({ type: "CLEAR" });
    rendererRef.current?.clear();
  }, [send]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-white rounded-xl shadow-lg overflow-hidden ${className}`}
      style={{ touchAction: "none" }}
    >
      <div className="relative flex-1 flex items-center justify-center p-4 bg-gray-50">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="border-2 border-gray-200 rounded-lg bg-white cursor-crosshair touch-none select-none"
          style={{
            WebkitTouchCallout: "none",
          }}
        />
        {strokes.length === 0 && state.status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Sign here</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-gray-100 border-t border-gray-200">
        <button
          onClick={() => send({ type: "UNDO" })}
          disabled={!canUndo}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
          aria-label="Undo last stroke"
        >
          Undo
        </button>
        <button
          onClick={() => send({ type: "REDO" })}
          disabled={!canRedo}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
          aria-label="Redo last stroke"
        >
          Redo
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          aria-label="Clear signature"
        >
          Clear
        </button>
        <button
          onClick={exportSVG}
          className="ml-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          aria-label="Export signature as SVG"
        >
          Export SVG
        </button>
      </div>
    </div>
  );
}
