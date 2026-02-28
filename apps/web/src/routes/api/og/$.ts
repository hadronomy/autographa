import { createFileRoute } from "@tanstack/react-router";

import { createOgResponse } from "@/components/og";

export const Route = createFileRoute("/api/og/$")({
  server: {
    handlers: {
      GET: async () => {
        const res = await createOgResponse();
        res.headers.set("X-Robots-Tag", "noindex");
        return res;
      },
    },
  },
});
