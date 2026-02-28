import type { AppRouter } from "@autographa/api/routers/index";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { TanStackDevtools } from "@tanstack/react-devtools";
import { hotkeysDevtoolsPlugin } from "@tanstack/react-hotkeys-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Toaster } from "sileo";

import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

const SITE_NAME = "autographa | animated signatures";
const ROOT_DESCRIPTION = "Create beautiful handwritten signatures";
const BASE_URL = "https://autographa.hadronomy.com";
const OG_IMAGE_URL = "/api/og/autographa";

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: SITE_NAME,
      },
      {
        name: "description",
        content: ROOT_DESCRIPTION,
      },
      {
        name: "keywords",
        content: "signature, react, clean, svg, animated",
      },
      {
        name: "theme-color",
        content: "#050505",
      },
      {
        property: "og:site_name",
        content: SITE_NAME,
      },
      {
        property: "og:title",
        content: SITE_NAME,
      },
      {
        property: "og:description",
        content: ROOT_DESCRIPTION,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: BASE_URL,
      },
      {
        property: "og:image",
        content: OG_IMAGE_URL,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: SITE_NAME,
      },
      {
        name: "twitter:url",
        content: BASE_URL,
      },
      {
        name: "twitter:description",
        content: ROOT_DESCRIPTION,
      },
      {
        name: "twitter:image",
        content: OG_IMAGE_URL,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="grid h-svh grid-cols-[1fr_minmax(auto,48rem)_1fr]">
          <Outlet />
        </div>
        <Toaster position="top-right" options={{ duration: 1200 }} />
        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
              defaultOpen: true,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
              defaultOpen: false,
            },
            hotkeysDevtoolsPlugin(),
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
