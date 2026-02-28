import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { faviconPlugin } from "./vite/plugins/favicon";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      traceDeps: ["@takumi-rs/core"],
    }),
    viteReact(),
    faviconPlugin(),
  ],
  server: {
    port: 3001,
  },
});
