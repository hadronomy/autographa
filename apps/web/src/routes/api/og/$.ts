import { createFileRoute } from "@tanstack/react-router";

import { createOgResponse } from "@/components/og";

export const Route = createFileRoute("/api/og/$")({
  server: {
    handlers: {
      GET: async () => {
        return createOgResponse();
      },
    },
  },
});
