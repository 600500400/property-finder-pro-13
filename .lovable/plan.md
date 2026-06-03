## Problém

Vite hlásí `Cannot find module '@/lib/scanner/scan-internal.server'` při SSR. Soubor existuje, ale je to `.server.ts` modul a importuje se na top-level v `src/routes/api/public/hooks/run-schedules.ts`. Tento route soubor je registrován v `routeTree.gen.ts`, který je client-reachable z `src/router.tsx`. Import-protection TanStack Start proto modul nepustí dovnitř — celý router se nenačte a každá stránka shoří na SSR 500, na klientovi se zobrazí "Something went wrong".

## Oprava (1 soubor)

V `src/routes/api/public/hooks/run-schedules.ts`:

1. Odstranit top-level `import { executeScan } from "@/lib/scanner/scan-internal.server"`.
2. Uvnitř `POST` handleru (těsně před prvním použitím) přidat:
   ```ts
   const { executeScan } = await import("@/lib/scanner/scan-internal.server");
   ```
3. `ScanFilters` typ je čistě typový import (`import type`) — může zůstat na top-levelu, není to runtime modul.

Stejný pattern jako se už používá pro `@/integrations/supabase/client.server` níž v souboru — konzistentní s pravidly v `tanstack-supabase-import-graph`.

## Ověření

- Po restartu dev serveru musí `/` načíst stránku bez "Something went wrong".
- Dev-server log už nesmí obsahovat `Cannot find module '@/lib/scanner/scan-internal.server'`.

## Mimo scope

Nic jiného nemění — žádné úpravy datového modelu, scrapperů ani UI.