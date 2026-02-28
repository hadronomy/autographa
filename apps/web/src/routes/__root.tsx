import type { AppRouter } from "@autographa/api/routers/index";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { TanStackDevtools } from "@tanstack/react-devtools";
import { hotkeysDevtoolsPlugin } from "@tanstack/react-hotkeys-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Toaster } from "sileo";

import { env } from "@autographa/env/web";

import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

const SITE_NAME = "autographa | animated signatures";
const ROOT_DESCRIPTION = "Create beautiful handwritten signatures";
const BASE_URL = env.VITE_APP_URL;
const OG_IMAGE_URL = "/api/og/autographa";

function getJsonLd() {
  const siteUrl = new URL("/", BASE_URL).toString();
  const ogImageUrl = new URL(OG_IMAGE_URL, BASE_URL).toString();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "autographa",
        url: siteUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: "autographa",
        description: ROOT_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${siteUrl}#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}#app`,
        name: "autographa",
        url: siteUrl,
        description: ROOT_DESCRIPTION,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        image: ogImageUrl,
        featureList: [
          "Draw a signature with brush presets",
          "Undo, redo, and clear",
          "Export as SVG",
          "Copy SVG to clipboard",
        ],
      },
    ],
  };
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    title: SITE_NAME,
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "robots",
        content: "index,follow",
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
        content: new URL(OG_IMAGE_URL, BASE_URL).toString(),
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
        content: new URL(OG_IMAGE_URL, BASE_URL).toString(),
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(getJsonLd()),
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "canonical",
        href: BASE_URL,
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
        {import.meta.env.DEV && (
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
        )}
        <Scripts />
      </body>
    </html>
  );
}
