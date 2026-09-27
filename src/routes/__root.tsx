import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { OPERATOR, SITE_URL } from "@/lib/site";
import { emitConversion } from "@/lib/conversion-events";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Stránka nenalezena</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Domů
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Něco se pokazilo</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "no-referrer" },
      ...(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string }]
        : []),
      { title: "RealityScanner — Investiční byty a domy | Výnos z nájmu & ČSÚ ceny" },
      {
        name: "description",
        content: "Agregátor inzerátů ze Sreality, Bezrealitky a dalších portálů. Okamžitý výpočet čistého výnosu z pronájmu, srovnání cen domů s ČSÚ a automatický hlídací pes.",
      },
      { property: "og:title", content: "RealityScanner — Investiční byty a domy | Výnos z nájmu & ČSÚ ceny" },
      {
        property: "og:description",
        content: "Agregátor inzerátů ze Sreality, Bezrealitky a dalších portálů. Okamžitý výpočet čistého výnosu z pronájmu, srovnání cen domů s ČSÚ a automatický hlídací pes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.realityscanner.cz/" },
      { name: "twitter:title", content: "RealityScanner — Investiční byty a domy | Výnos z nájmu & ČSÚ ceny" },
      {
        name: "twitter:description",
        content: "Agregátor inzerátů ze Sreality, Bezrealitky a dalších portálů. Okamžitý výpočet čistého výnosu z pronájmu, srovnání cen domů s ČSÚ a automatický hlídací pes.",
      },
      { property: "og:image", content: "https://www.realityscanner.cz/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
      { name: "twitter:image", content: "https://www.realityscanner.cz/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Person",
              "@id": SITE_URL + "/#operator",
              "name": OPERATOR.name,
              "identifier": { "@type": "PropertyValue", "propertyID": "IČO", "value": OPERATOR.ico },
              "email": OPERATOR.email,
              "address": { "@type": "PostalAddress", "streetAddress": OPERATOR.street, "addressLocality": OPERATOR.city, "postalCode": OPERATOR.postalCode, "addressCountry": "CZ" }
            },
            {
              "@type": "WebApplication",
              "name": "RealityScanner",
              "provider": { "@id": SITE_URL + "/#operator" },
              "url": "https://www.realityscanner.cz/",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web Browser",
              "description": "Nástroj pro analýzu investičních nemovitostí v ČR. Výpočet čistého výnosu z nájmu a srovnání cen s daty ČSÚ.",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "CZK"
              }
            },
            {
              "@type": "WebSite",
              "name": "RealityScanner",
              "url": "https://www.realityscanner.cz/"
            }
          ]
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    try {
      const referrer = new URL(document.referrer);
      if (/(^|\.)(google\.[a-z.]+|bing\.com|search\.seznam\.cz)$/.test(referrer.hostname)) emitConversion("organic_landing");
    } catch { /* Direct navigation: no referrer. */ }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}
