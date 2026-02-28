import * as React from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CopyIcon, DownloadIcon, EraserIcon, Redo2Icon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import { BrushSwatch } from "@/components/brush-swatch";
import type { BrushId } from "@/components/signature-pad/machine";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/utils/trpc";

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
  // { id: "tombow-fudenosuke", label: "Tombow Fudenosuke", defaultWidth: 5.5 },
];

function HomeComponent() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  const padRef = React.useRef<SignaturePadHandle>(null);

  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [strokeCount, setStrokeCount] = React.useState(0);

  const [filename, setFilename] = React.useState("signature");

  const [brushId, setBrushId] = React.useState<BrushId>("monoline");
  const [strokeWidth, setStrokeWidth] = React.useState<number>(2.5);

  const brushLabel = BRUSH_PRESETS.find((b) => b.id === brushId)?.label ?? "Monoline (Classic)";

  const apiStatus = (() => {
    if (healthCheck.isPending) return "Checking…";
    if (healthCheck.isError) return "Offline";
    return "Online";
  })();

  const apiStatusTone = (() => {
    if (healthCheck.isPending) return "text-muted-foreground";
    if (healthCheck.isError) return "text-destructive";
    return "text-foreground/70";
  })();

  const safeFilename = React.useMemo(() => {
    const base = filename.trim() || "signature";
    return base.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  }, [filename]);

  const isEmpty = strokeCount === 0;

  const handleUndo = React.useCallback(() => {
    padRef.current?.undo();
  }, []);

  const handleRedo = React.useCallback(() => {
    padRef.current?.redo();
  }, []);

  const handleClear = React.useCallback(() => {
    if (isEmpty) return;
    padRef.current?.clear();
    toast.message("Cleared", {
      description: "Your canvas is ready for a fresh signature.",
    });
  }, [isEmpty]);

  const handleDownload = React.useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;

    if (pad.getStrokes().length === 0) {
      toast.error("Nothing to export", {
        description: "Add at least one stroke before exporting.",
      });
      return;
    }

    pad.downloadSVG({ filename: `${safeFilename}.svg` });
    toast.success("Downloaded", {
      description: `${safeFilename}.svg`,
    });
  }, [safeFilename]);

  const handleCopySvg = React.useCallback(async () => {
    const pad = padRef.current;
    if (!pad) return;

    if (pad.getStrokes().length === 0) {
      toast.error("Nothing to copy", {
        description: "Add at least one stroke before copying.",
      });
      return;
    }

    const svg = pad.getSVG();

    try {
      await navigator.clipboard.writeText(svg);
      toast.success("Copied SVG", {
        description: "You can paste it into an editor or upload field.",
      });
    } catch {
      toast.error("Could not copy", {
        description: "Clipboard permission was denied by the browser.",
      });
    }
  }, []);

  useHotkey("Mod+Z", () => {
    handleUndo();
  });

  useHotkey("Mod+Shift+Z", () => {
    handleRedo();
  });

  useHotkey("Mod+Backspace", () => {
    handleClear();
  });

  return (
    <div className="flex flex-col col-start-2 border-x h-full py-6">
      <div className="px-6 sm:px-10 mt-4 mb-6">
        <div className="flex items-baseline justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl text-foreground font-mono font-bold">autographa</h1>
            <p className="text-sm text-muted-foreground">
              Create beautiful handwritten signatures — export clean SVG.
            </p>
          </div>

          <div className="text-xs tracking-widest uppercase">
            <span className={apiStatusTone}>API: {apiStatus}</span>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-10 flex-1">
        <Card className="rounded-none">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Signature</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Tip: try a slower stroke for cleaner curves.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" className="gap-2">
                      <BrushSwatch brushId={brushId} className="text-foreground/80" />
                      <span>{brushLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-72">
                    {BRUSH_PRESETS.map((b) => (
                      <DropdownMenuItem
                        key={b.id}
                        onClick={() => {
                          setBrushId(b.id);
                          setStrokeWidth(b.defaultWidth);
                          toast.message("Brush selected", {
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

                <span className="text-xs text-muted-foreground ml-2">File</span>
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-56"
                  placeholder="signature"
                  aria-label="Export filename"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-0">
            <SignaturePad
              ref={padRef}
              showToolbar={false}
              className="rounded-none border-x-0 border-y"
              strokeWidth={strokeWidth}
              brush={{ id: brushId }}
              onCanUndoChange={setCanUndo}
              onCanRedoChange={setCanRedo}
              onStrokesChange={(strokes) => setStrokeCount(strokes.length)}
              onStrokeEnd={(strokes) => setStrokeCount(strokes.length)}
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo"
              >
                <Undo2Icon />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo"
              >
                <Redo2Icon />
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              <Button
                variant="destructive"
                size="icon"
                onClick={handleClear}
                disabled={isEmpty}
                aria-label="Clear"
                title="Clear"
              >
                <EraserIcon />
              </Button>

              <div className="ml-2 text-xs text-muted-foreground hidden sm:block">
                {isEmpty ? "Empty" : `${strokeCount} stroke${strokeCount === 1 ? "" : "s"}`}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="sm:hidden flex-1">
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="signature"
                  aria-label="Export filename"
                />
              </div>

              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" className="shrink-0">
                      Export
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem onClick={handleDownload}>
                      <DownloadIcon />
                      Download SVG
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleCopySvg}>
                      <CopyIcon />
                      Copy SVG
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <div className="px-2 py-2 text-[10px] tracking-widest uppercase text-muted-foreground">
                      {safeFilename}.svg
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopySvg}
                  disabled={isEmpty}
                  aria-label="Copy SVG"
                  title="Copy SVG"
                >
                  <CopyIcon />
                  Copy
                </Button>

                <Button
                  onClick={handleDownload}
                  disabled={isEmpty}
                  aria-label="Download SVG"
                  title="Download SVG"
                >
                  <DownloadIcon />
                  Download
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
