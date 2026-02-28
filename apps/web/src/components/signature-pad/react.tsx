import * as React from "react";

import { cn } from "@/lib/utils";

import { useSignatureMachine, type BrushSelection } from "./hooks";
import type { BrushId, Point, Stroke } from "./machine";
import { SignatureRenderer } from "./renderer";
import { PenStabilizer } from "./stabilizer";
import { buildSignatureSvg } from "./svg";

export type SignaturePadHandle = {
  undo(): void;
  redo(): void;
  clear(): void;

  getStrokes(): Stroke[];
  canUndo(): boolean;
  canRedo(): boolean;

  /**
   * Builds the SVG string using the shared builder.
   * Pure: no download and does not call onChange.
   */
  getSVG(): string;

  /**
   * Triggers a download of the SVG. For backward compatibility with the prior
   * in-component export behavior, this calls onChange(svg).
   */
  downloadSVG(options?: { filename?: string }): string;
};

interface SignaturePadProps {
  width?: number;
  height?: number;

  /**
   * Backward-compatible: called when an export/download happens.
   * (Not called by getSVG()).
   */
  onChange?: (svg: string) => void;

  /**
   * Fires when a pointer stroke is completed (after it is committed to strokes).
   */
  onStrokeEnd?: (strokes: Stroke[]) => void;

  /**
   * External control callbacks.
   */
  onStrokesChange?: (strokes: Stroke[]) => void;
  onCanUndoChange?: (canUndo: boolean) => void;
  onCanRedoChange?: (canRedo: boolean) => void;

  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  stabilizationLevel?: number;

  /**
   * Brush selection applied to newly-started strokes.
   * Defaults to { id: "monoline" } (the current brush).
   */
  brush?: Readonly<{
    id: BrushId;
    settings?: Record<string, unknown>;
  }>;

  /**
   * Whether to render the internal floating toolbar + export button.
   * Defaults to true to avoid changing existing behavior.
   */
  showToolbar?: boolean;
}

type SignaturePadToolbarProps = Readonly<{
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
}>;

function SignaturePadToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onDownload,
}: SignaturePadToolbarProps) {
  return (
    <>
      <div className="absolute bottom-5 left-5 z-20 flex items-center bg-card/60 backdrop-blur-md border border-border/40 rounded-full p-1.5 transition-all">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2.5 text-foreground/70 hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/70 disabled:cursor-not-allowed group relative"
          aria-label="Undo"
          type="button"
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
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2.5 text-foreground/70 hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/70 disabled:cursor-not-allowed group relative"
          aria-label="Redo"
          type="button"
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
          onClick={onClear}
          className="p-2.5 text-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group relative"
          aria-label="Clear"
          type="button"
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

      <div className="absolute bottom-5 right-5 z-20 flex">
        <button
          onClick={onDownload}
          className="group flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold tracking-widest uppercase text-primary-foreground transition-all duration-300 rounded-full bg-primary hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 backdrop-blur-md"
          aria-label="Export signature as SVG"
          type="button"
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
    </>
  );
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      width = 600,
      height = 300,
      onChange,
      onStrokeEnd,
      onStrokesChange,
      onCanUndoChange,
      onCanRedoChange,
      className = "",
      strokeColor = "#1c140f",
      strokeWidth = 2.5,
      stabilizationLevel = 100,
      brush = { id: "monoline" },
      showToolbar = true,
    }: SignaturePadProps,
    ref,
  ) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const baseCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const liveCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const baseRendererRef = React.useRef<SignatureRenderer | null>(null);
    const liveRendererRef = React.useRef<SignatureRenderer | null>(null);

    const stabilizerRef = React.useRef<PenStabilizer | null>(null);
    const pointerCapturedRef = React.useRef(false);

    const [dimensions, setDimensions] = React.useState({ width, height });

    const brushSelection: BrushSelection = React.useMemo(
      () => ({
        id: brush.id,
        settings: brush.settings ?? {},
      }),
      [brush.id, brush.settings],
    );

    const { state, send, strokes, canUndo, canRedo } = useSignatureMachine({
      color: strokeColor,
      width: strokeWidth,
      brush: brushSelection,
    });

    const strokesRef = React.useRef<Stroke[]>(strokes);
    const canUndoRef = React.useRef<boolean>(canUndo);
    const canRedoRef = React.useRef<boolean>(canRedo);
    const dimensionsRef = React.useRef(dimensions);

    React.useEffect(() => {
      strokesRef.current = strokes;
    }, [strokes]);

    React.useEffect(() => {
      canUndoRef.current = canUndo;
    }, [canUndo]);

    React.useEffect(() => {
      canRedoRef.current = canRedo;
    }, [canRedo]);

    React.useEffect(() => {
      dimensionsRef.current = dimensions;
    }, [dimensions]);

    React.useEffect(() => {
      const updateSize = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
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

    React.useEffect(() => {
      if (!baseCanvasRef.current || !liveCanvasRef.current) return;

      baseRendererRef.current = new SignatureRenderer(baseCanvasRef.current);
      liveRendererRef.current = new SignatureRenderer(liveCanvasRef.current);

      stabilizerRef.current = new PenStabilizer({
        algorithm: "holt",
        level: stabilizationLevel,
        holt: { alpha: 0.18, beta: 0.06 },
        pressure: { mode: "none" },
      });

      return () => {
        baseRendererRef.current?.destroy();
        liveRendererRef.current?.destroy();
        baseRendererRef.current = null;
        liveRendererRef.current = null;
        stabilizerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
      const baseCanvas = baseCanvasRef.current;
      const liveCanvas = liveCanvasRef.current;

      if (baseCanvas) {
        baseCanvas.style.width = `${dimensions.width}px`;
        baseCanvas.style.height = `${dimensions.height}px`;
      }

      if (liveCanvas) {
        liveCanvas.style.width = `${dimensions.width}px`;
        liveCanvas.style.height = `${dimensions.height}px`;
      }

      baseRendererRef.current?.resize();
      liveRendererRef.current?.resize();

      baseRendererRef.current?.renderStrokes(strokes);
      liveRendererRef.current?.clear();
    }, [dimensions, strokes]);

    React.useEffect(() => {
      onStrokesChange?.(strokes);
    }, [strokes, onStrokesChange]);

    React.useEffect(() => {
      onCanUndoChange?.(canUndo);
    }, [canUndo, onCanUndoChange]);

    React.useEffect(() => {
      onCanRedoChange?.(canRedo);
    }, [canRedo, onCanRedoChange]);

    const prevStatusRef = React.useRef<typeof state.status>(state.status);

    React.useEffect(() => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = state.status;

      if (prev === "drawing" && state.status === "completed") {
        onStrokeEnd?.(strokesRef.current);
      }
    }, [state.status, onStrokeEnd]);

    React.useEffect(() => {
      const liveRenderer = liveRendererRef.current;
      if (!liveRenderer) return;

      if (state.status === "drawing" && state.currentStroke) {
        liveRenderer.clear();
        liveRenderer.renderStroke(state.currentStroke);
        return;
      }

      liveRenderer.clear();
    }, [state.status, state.currentStroke]);

    const getCoordinates = React.useCallback((e: React.PointerEvent) => {
      const canvas = liveCanvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pointerType === "pen" ? e.pressure : 0.5,
        timestamp: e.nativeEvent.timeStamp,
      };
    }, []);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();

        const point = getCoordinates(e);
        if (!point) return;

        const target = e.target as Element;
        target.setPointerCapture(e.pointerId);
        pointerCapturedRef.current = true;

        stabilizerRef.current?.reset();

        const stabilized = stabilizerRef.current?.addPoint(point) ?? point;
        send({ type: "POINTER_DOWN", point: stabilized });
      },
      [send, getCoordinates],
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (state.status !== "drawing") return;
        e.preventDefault();

        const canvas = liveCanvasRef.current;
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

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent) => {
        if (pointerCapturedRef.current) {
          const target = e.target as Element;
          target.releasePointerCapture(e.pointerId);
          pointerCapturedRef.current = false;
        }

        send({ type: "POINTER_UP" });
      },
      [send],
    );

    React.useEffect(() => {
      baseRendererRef.current?.renderStrokes(strokes);
    }, [strokes]);

    const getSVG = React.useCallback(() => {
      return buildSignatureSvg({
        strokes: strokesRef.current,
        size: dimensionsRef.current,
      });
    }, []);

    const downloadSVG = React.useCallback(
      (options?: { filename?: string }) => {
        const svgString = buildSignatureSvg({
          strokes: strokesRef.current,
          size: dimensionsRef.current,
        });

        const blob = new Blob([svgString], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = options?.filename ?? `signature-${Date.now()}.svg`;
        link.click();
        URL.revokeObjectURL(url);

        onChange?.(svgString);

        return svgString;
      },
      [onChange],
    );

    const clear = React.useCallback(() => {
      send({ type: "CLEAR" });
      baseRendererRef.current?.clear();
      liveRendererRef.current?.clear();
    }, [send]);

    React.useImperativeHandle(
      ref,
      (): SignaturePadHandle => ({
        undo() {
          send({ type: "UNDO" });
        },
        redo() {
          send({ type: "REDO" });
        },
        clear() {
          clear();
        },
        getStrokes() {
          return strokesRef.current;
        },
        canUndo() {
          return canUndoRef.current;
        },
        canRedo() {
          return canRedoRef.current;
        },
        getSVG() {
          return getSVG();
        },
        downloadSVG(options) {
          return downloadSVG(options);
        },
      }),
      [send, clear, getSVG, downloadSVG],
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative mx-auto w-full max-w-full rounded-md border " +
            "border-border/80 overflow-hidden bg-card",
          className,
        )}
        style={{ touchAction: "none", height: dimensions.height }}
      >
        <canvas
          ref={baseCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 select-none z-10 pointer-events-none"
          style={{ WebkitTouchCallout: "none" }}
        />

        <canvas
          ref={liveCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 cursor-crosshair touch-none select-none z-20"
          style={{ WebkitTouchCallout: "none" }}
        />

        <div className="absolute inset-0 pointer-events-none transition-opacity duration-700 z-0 flex flex-col items-center justify-center">
          <div className="absolute bottom-[30%] w-full flex items-end text-foreground/20 dark:text-foreground/20">
            <div className="flex-1 border-b-[1.5px] border-dashed border-foreground/20 dark:border-foreground/20" />
          </div>
        </div>

        {showToolbar ? (
          <SignaturePadToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={() => send({ type: "UNDO" })}
            onRedo={() => send({ type: "REDO" })}
            onClear={clear}
            onDownload={() => downloadSVG()}
          />
        ) : null}
      </div>
    );
  },
);

SignaturePad.displayName = "SignaturePad";
