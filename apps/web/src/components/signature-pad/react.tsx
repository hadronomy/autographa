import { cn } from "@/lib/utils";
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
  strokeColor = "#1c140f", // Deep sepia ink default, fitting the Caligrapha theme
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
        width: rect.width, // Canvas takes full container width
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
  }, []);

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
  }, [dimensions, strokes]);

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
          timestamp: ev.timeStamp,
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

      if (activeStrokeIdRef.current !== stroke.id) {
        activeStrokeIdRef.current = stroke.id;
        lastRenderedPointCountRef.current = 0;
      }

      const pointCount = stroke.points.length;
      const lastRendered = lastRenderedPointCountRef.current;

      if (pointCount > lastRendered) {
        renderer.appendStrokeSegments(stroke, lastRendered);
        lastRenderedPointCountRef.current = pointCount;
      }
      return;
    }

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
      className={cn(
        `relative mx-auto w-full max-w-full rounded-md border border-border/80 overflow-hidden bg-card`,
        className,
      )}
      style={{ touchAction: "none", height: dimensions.height }}
    >
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 cursor-crosshair touch-none select-none z-10"
        style={{ WebkitTouchCallout: "none" }}
      />

      {/* Minimal Signature Line Empty State */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700 z-0 flex flex-col items-center justify-center">
        <div className="absolute bottom-[30%] w-full flex items-end text-foreground/20 dark:text-foreground/20">
          <div className="flex-1 border-b-[1.5px] border-dashed border-foreground/20 dark:border-foreground/20" />
        </div>
      </div>

      {/* Floating Toolbar: Undo, Redo, Clear (Bottom Left) */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center bg-card/60 backdrop-blur-md border border-border/40 rounded-full p-1.5 transition-all">
        <button
          onClick={() => send({ type: "UNDO" })}
          disabled={!canUndo}
          className="p-2.5 text-foreground/70 hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/70 disabled:cursor-not-allowed group relative"
          aria-label="Undo"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            Undo
          </span>
        </button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        <button
          onClick={() => send({ type: "REDO" })}
          disabled={!canRedo}
          className="p-2.5 text-foreground/70 hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/70 disabled:cursor-not-allowed group relative"
          aria-label="Redo"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            Redo
          </span>
        </button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        <button
          onClick={handleClear}
          className="p-2.5 text-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group relative"
          aria-label="Clear"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            Clear
          </span>
        </button>
      </div>

      {/* Primary Action: Save Seal (Bottom Right) */}
      <div className="absolute bottom-5 right-5 z-20 flex">
        <button
          onClick={exportSVG}
          className="group flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold tracking-widest uppercase text-primary-foreground transition-all duration-300 rounded-full bg-primary hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 backdrop-blur-md"
          aria-label="Export signature as SVG"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:scale-110"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
