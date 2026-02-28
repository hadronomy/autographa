import { Resvg } from "@resvg/resvg-js";
import type { Connect, Plugin } from "vite";

import type { BrushId } from "../../src/components/signature-pad/machine";
import { renderFaviconSvg } from "../../src/lib/favicon";

type FaviconArgs = Readonly<{
  brushId: BrushId;
  size: number;
  background: string;
  ink: string;
}>;

const FAVICON_ARGS: FaviconArgs = {
  brushId: "sharpie-brush",
  size: 64,
  background: "#FCFCFB",
  ink: "#2A2624",
};

function svgToPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    // Background is already in your SVG via <rect>, so no need to set here
  });

  return Buffer.from(resvg.render().asPng());
}

function createFaviconMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";

    const isSvg = url === "/favicon.svg";
    const isPng32 = url === "/favicon-32.png";
    const isPng48 = url === "/favicon-48.png";
    const isApple = url === "/apple-touch-icon.png";

    if (!isSvg && !isPng32 && !isPng48 && !isApple) return next();

    if (req.method && req.method !== "GET") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    try {
      const svg = renderFaviconSvg(FAVICON_ARGS);

      if (isSvg) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(svg);
        return;
      }

      const size = isPng32 ? 32 : isPng48 ? 48 : 180;
      const png = svgToPng(svg, size);

      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache");
      res.end(png);
    } catch {
      res.statusCode = 500;
      res.end("Failed to render favicon");
    }
  };
}

export function faviconPlugin(): Plugin {
  const middleware = createFaviconMiddleware();

  return {
    name: "autographa:favicon",

    configureServer(server) {
      server.middlewares.use(middleware);
    },

    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },

    async generateBundle() {
      // TanStack Start builds multiple environments. If you're unsure what the
      // client env is called, remove this guard and emit in all envs.
      //
      // Safer guard than strict equality:
      const envName = this.environment?.name ?? "";
      const isClientEnv = envName.includes("client");
      if (!isClientEnv) return;

      const svg = renderFaviconSvg(FAVICON_ARGS);

      this.emitFile({
        type: "asset",
        fileName: "favicon.svg",
        source: svg,
      });

      this.emitFile({
        type: "asset",
        fileName: "favicon-32.png",
        source: svgToPng(svg, 32),
      });

      this.emitFile({
        type: "asset",
        fileName: "favicon-48.png",
        source: svgToPng(svg, 48),
      });

      this.emitFile({
        type: "asset",
        fileName: "apple-touch-icon.png",
        source: svgToPng(svg, 180),
      });
    },
  };
}
