import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function NotFound() {
  return (
    <div className="flex flex-col col-start-2 border-x border-border/60 h-full relative bg-background">
      {/* HEADER SECTION */}
      <header className="relative border-b border-border/60 px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-4 bg-muted/5 dark:bg-muted/10">
        <Crosshair className="-bottom-px -left-px" />
        <Crosshair className="-bottom-px -right-px" />

        <div className="space-y-1.5 z-10">
          <h1 className="text-2xl text-foreground font-mono font-bold tracking-tight">404.</h1>
          <p className="text-xs text-muted-foreground font-mono">Signal lost</p>
        </div>

        <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-mono mt-2 sm:mt-0 z-10">
          <div className="size-1.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-muted-foreground">Not Found</span>
        </div>
      </header>

      {/* MAIN SECTION */}
      <main className="relative flex-1 w-full flex flex-col items-center justify-center group overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Giant faint 404 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[35vw] sm:text-[20rem] font-bold font-mono text-foreground/2 dark:text-foreground/3 select-none tracking-tighter">
            404
          </span>
        </div>

        {/* Blueprint corner markers */}
        <div className="absolute top-6 left-6 size-3 border-l border-t border-muted-foreground/30 pointer-events-none" />
        <div className="absolute top-6 right-6 size-3 border-r border-t border-muted-foreground/30 pointer-events-none" />
        <div className="absolute bottom-6 left-6 size-3 border-l border-b border-muted-foreground/30 pointer-events-none" />
        <div className="absolute bottom-6 right-6 size-3 border-r border-b border-muted-foreground/30 pointer-events-none" />

        <div className="z-10 flex flex-col items-center text-center space-y-8 px-6">
          <div className="space-y-4">
            <div className="inline-flex border border-border/60 bg-background/50 px-4 py-2 backdrop-blur-sm">
              <p className="text-foreground font-mono text-xs uppercase tracking-widest">
                Signature unknown
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono max-w-65 mx-auto leading-relaxed">
              The document you are looking for has been moved, deleted, or never was signed.
            </p>
          </div>

          <Button
            variant="ghost"
            className="h-8 gap-2 font-mono text-[10px] uppercase tracking-wider rounded-none hover:bg-primary/10 hover:text-primary border border-border/60 bg-background/50 transition-colors p-0!"
          >
            <Link className="inline-flex flex-row h-full align-middle items-center px-8" to="/">
              <ChevronLeftIcon className="size-3.5" />
              Return to base
            </Link>
          </Button>
        </div>
      </main>

      {/* FOOTER SECTION */}
      <footer className="relative border-t border-border/60 px-6 sm:px-10 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/5 dark:bg-muted/10">
        <Crosshair className="-top-px -left-px" />
        <Crosshair className="-top-px -right-px" />

        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Error 404
        </div>

        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Autographa System
        </div>
      </footer>
    </div>
  );
}
