import * as React from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  EraserIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";

import { BrushSwatch } from "@/components/brush-swatch";
import type { BrushId } from "@/components/signature-pad/machine";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";
import { sileo } from "sileo";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const BRUSH_PRESETS: ReadonlyArray<{
  id: BrushId;
  label: string;
  defaultWidth: number;
}> = [
  { id: "monoline", label: "Monoline (Classic)", defaultWidth: 2.5 },
  { id: "uni-jetstream", label: "Uni Jetstream", defaultWidth: 2.2 },
  { id: "sharpie-fine", label: "Sharpie Fine", defaultWidth: 3.4 },
  { id: "sharpie-brush", label: "Sharpie Brush", defaultWidth: 6.5 },
];

const Crosshair = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "pointer-events-none absolute z-50 h-px w-px items-center justify-center hidden lg:flex",
      className,
    )}
  >
    <div className="flex size-20 shrink-0 items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 50 42 Q 50 50 58 50 Q 50 50 50 58 Q 50 50 42 50 Q 50 50 50 42 Z"
          fill="currentColor"
          className="text-muted-foreground/30 dark:text-muted-foreground/40"
        />
      </svg>
    </div>
  </div>
);

function HomeComponent() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  const padRef = React.useRef<SignaturePadHandle>(null);
  const mainRef = React.useRef<HTMLElement>(null);

  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [strokeCount, setStrokeCount] = React.useState(0);
  const [canvasHeight, setCanvasHeight] = React.useState(300);

  // Track if user has touched the canvas to hide the overlay immediately
  const [hasInteracted, setHasInteracted] = React.useState(false);

  const [filename, setFilename] = React.useState("signature");

  const [brushId, setBrushId] = React.useState<BrushId>("monoline");
  const [strokeWidth, setStrokeWidth] = React.useState<number>(2.5);

  const brushLabel = BRUSH_PRESETS.find((b) => b.id === brushId)?.label ?? "Monoline (Classic)";

  // Automatically adjust the canvas height to fill the available space dynamically
  React.useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasHeight(Math.floor(entry.contentRect.height));
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  // Reset interaction state if the canvas becomes completely empty (cleared/undone to 0)
  React.useEffect(() => {
    if (strokeCount === 0) {
      setHasInteracted(false);
    }
  }, [strokeCount]);

  const apiStatus = (() => {
    if (healthCheck.isPending) return "Checking…";
    if (healthCheck.isError) return "Offline";
    return "Online";
  })();

  const apiStatusTone = (() => {
    if (healthCheck.isPending) return "text-muted-foreground";
    if (healthCheck.isError) return "text-destructive";
    return "text-muted-foreground";
  })();

  const safeFilename = React.useMemo(() => {
    const base = filename.trim() || "signature";
    return base.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  }, [filename]);

  const isEmpty = strokeCount === 0;
  const showOverlay = isEmpty && !hasInteracted;

  const handleUndo = React.useCallback(() => {
    padRef.current?.undo();
  }, []);

  const handleRedo = React.useCallback(() => {
    padRef.current?.redo();
  }, []);

  const handleClear = React.useCallback(() => {
    if (isEmpty) return;
    padRef.current?.clear();
    sileo.info({ title: "Cleared", description: "Your canvas is ready for a fresh signature." });
  }, [isEmpty]);

  const handleDownload = React.useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;

    if (pad.getStrokes().length === 0) {
      sileo.error({
        title: "Nothing to export",
        description: "Add at least one stroke before exporting.",
      });
      return;
    }

    pad.downloadSVG({ filename: `${safeFilename}.svg` });
    sileo.success({
      title: "Downloaded",
      description: `${safeFilename}.svg`,
    });
  }, [safeFilename]);

  const handleCopySvg = React.useCallback(async () => {
    const pad = padRef.current;
    if (!pad) return;

    if (pad.getStrokes().length === 0) {
      sileo.error({
        title: "Nothing to copy",
        description: "Add at least one stroke before copying.",
      });
      return;
    }

    const svg = pad.getSVG();

    try {
      await navigator.clipboard.writeText(svg);
      sileo.success({
        title: "Copied SVG",
        description: "You can paste it into an editor or upload field.",
      });
    } catch {
      sileo.error({
        title: "Could not copy",
        description: "Clipboard permission was denied by the browser.",
      });
    }
  }, []);

  useHotkey("Mod+Z", () => handleUndo());
  useHotkey("Mod+Shift+Z", () => handleRedo());
  useHotkey("Mod+Backspace", () => handleClear());

  useHotkey("Mod+S", (e) => {
    e.preventDefault();
    if (!isEmpty) handleDownload();
  });

  useHotkey("Mod+C", (e) => {
    if (isEmpty) return;
    // Allow native copy if an input is focused
    if (document.activeElement?.tagName === "INPUT") return;
    e.preventDefault();
    handleCopySvg();
  });

  return (
    <div className="flex flex-col col-start-2 border-x border-border/60 h-full relative bg-background">
      {/* HEADER SECTION */}
      <header className="relative border-b border-border/60 px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-4">
        <Crosshair className="-bottom-px -left-px" />
        <Crosshair className="-bottom-px -right-px" />

        <div className="space-y-1.5">
          <h1 className="text-2xl text-foreground font-mono font-bold tracking-tight">
            autographa.
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Create beautiful handwritten signatures
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-mono mt-2 sm:mt-0">
          <div
            className={cn(
              "size-1.5 rounded-full",
              healthCheck.isPending
                ? "bg-muted-foreground/50 animate-pulse"
                : healthCheck.isError
                  ? "bg-destructive"
                  : "bg-primary",
            )}
          />
          <span className={apiStatusTone}>{apiStatus}</span>
        </div>
      </header>

      {/* TOOLBAR SECTION */}
      <div className="relative border-b border-border/60 px-6 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-4 bg-muted/5 dark:bg-muted/10">
        <Crosshair className="-bottom-px -left-px" />
        <Crosshair className="-bottom-px -right-px" />

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                className="h-8 gap-2 font-mono text-[10px] uppercase tracking-wider px-3 rounded-none hover:bg-muted/30 border border-border/60 bg-background/50"
              >
                <BrushSwatch brushId={brushId} className="text-foreground/80 w-6 h-3" />
                <span>{brushLabel}</span>
                <ChevronDownIcon className="size-3 opacity-50 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-64 rounded-none border-border/60 font-mono text-xs shadow-xl"
            >
              {BRUSH_PRESETS.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  className="rounded-none cursor-pointer py-2 focus:bg-muted/50"
                  onClick={() => {
                    setBrushId(b.id);
                    setStrokeWidth(b.defaultWidth);
                    sileo.info({
                      title: "Brush selected",
                      description: b.label,
                    });
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <BrushSwatch brushId={b.id} className="text-foreground/80 shrink-0" />
                    <div className="flex-1">{b.label}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:inline-block">
            File
          </span>
          <Input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-36 sm:w-56 h-8 rounded-none border-border/60 bg-background/50 hover:bg-muted/20 focus-visible:ring-1 focus-visible:ring-primary/40 font-mono text-xs shadow-none px-2"
            placeholder="signature"
            aria-label="Export filename"
          />
        </div>
      </div>

      {/* CANVAS SECTION */}
      <main
        ref={mainRef}
        onPointerDownCapture={() => setHasInteracted(true)}
        className="relative flex-1 w-full min-h-75 flex flex-col group overflow-hidden"
      >
        {/* Subtle grid background for th "developer experience" feel */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Blueprint corner markers inside the canvas */}
        <div className="absolute top-6 left-6 size-3 border-l border-t border-muted-foreground/30 pointer-events-none" />
        <div className="absolute top-6 right-6 size-3 border-r border-t border-muted-foreground/30 pointer-events-none" />
        <div className="absolute bottom-6 left-6 size-3 border-l border-b border-muted-foreground/30 pointer-events-none" />
        <div className="absolute bottom-6 right-6 size-3 border-r border-b border-muted-foreground/30 pointer-events-none" />

        {/* Empty State / Instruction Overlay */}
        {showOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none select-none animate-in fade-in duration-700 zoom-in-95">
            <p className="text-muted-foreground font-mono text-sm mb-6 uppercase tracking-widest">
              Draw your signature
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-muted-foreground/70">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-widest">Undo</span>
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <Kbd>Z</Kbd>
                </KbdGroup>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-widest">Redo</span>
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <Kbd>⇧</Kbd>
                  <Kbd>Z</Kbd>
                </KbdGroup>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-widest">Clear</span>
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <Kbd>⌫</Kbd>
                </KbdGroup>
              </div>
            </div>
          </div>
        )}

        <SignaturePad
          ref={padRef}
          showToolbar={false}
          height={canvasHeight}
          className="absolute inset-0 w-full rounded-none border-none bg-transparent"
          strokeWidth={strokeWidth}
          brush={{ id: brushId }}
          onCanUndoChange={setCanUndo}
          onCanRedoChange={setCanRedo}
          onStrokesChange={(strokes) => setStrokeCount(strokes.length)}
          onStrokeEnd={(strokes) => setStrokeCount(strokes.length)}
        />
      </main>

      {/* FOOTER SECTION */}
      <footer className="relative border-t border-border/60 px-6 sm:px-10 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/5 dark:bg-muted/10">
        <Crosshair className="-top-px -left-px" />
        <Crosshair className="-top-px -right-px" />

        <div className="flex items-center gap-4">
          <div className="flex items-center border border-border/60 divide-x divide-border/60 bg-background/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              className="rounded-none h-8 px-3 hover:bg-muted/40"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (⌘Z)"
            >
              <Undo2Icon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-none h-8 px-3 hover:bg-muted/40"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (⌘⇧Z)"
            >
              <Redo2Icon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-none h-8 px-3 hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={handleClear}
              disabled={isEmpty}
              aria-label="Clear"
              title="Clear (⌘⌫)"
            >
              <EraserIcon className="size-3.5" />
            </Button>
          </div>

          <div className="text-[10px] font-mono text-muted-foreground hidden sm:block uppercase tracking-widest">
            {isEmpty ? "0 Strokes" : `${strokeCount} Stroke${strokeCount === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="flex items-center border border-border/60 divide-x divide-border/60 bg-background/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            className="rounded-none h-8 gap-2 font-mono text-[10px] uppercase tracking-wider px-4 hover:bg-muted/40"
            onClick={handleCopySvg}
            disabled={isEmpty}
            title="Copy SVG (⌘C)"
          >
            <CopyIcon className="size-3.5" /> <span className="hidden sm:inline">Copy SVG</span>
            <span className="sm:hidden">Copy</span>
            <Kbd className="ml-1 hidden lg:inline-flex bg-transparent border-none text-muted-foreground/50 shadow-none">
              ⌘C
            </Kbd>
          </Button>
          <Button
            variant="ghost"
            className="rounded-none h-8 gap-2 font-mono text-[10px] uppercase tracking-wider px-4 hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={handleDownload}
            disabled={isEmpty}
            title="Download SVG (⌘S)"
          >
            <DownloadIcon className="size-3.5" /> <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Save</span>
            <Kbd className="ml-1 hidden lg:inline-flex bg-transparent border-none text-muted-foreground/50 shadow-none">
              ⌘S
            </Kbd>
          </Button>
        </div>
      </footer>
    </div>
  );
}
