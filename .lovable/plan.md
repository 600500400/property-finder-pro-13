# Server-only listings access + atomic AI quota reservation

Apply the pasted migration verbatim, then adapt the app code so nothing breaks and the AI analysis flow uses the new reservation function.

## Migration (verbatim, as pasted)

1. Lock down `public.listings`: revoke all from PUBLIC/anon/authenticated, grant ALL to service_role, replace the read policy with a restrictive `listings_server_only` (SELECT for anon/authenticated = false).
2. Revoke INSERT/UPDATE/DELETE on `public.ai_analysis_usage` from PUBLIC/anon/authenticated (users keep their existing read-own SELECT policy).
3. Create `public.reserve_ai_analysis(uuid, uuid)` — SECURITY DEFINER, advisory lock per user, premium = 50/month vs free = 1 lifetime, validates the listing exists and is active, inserts the usage row atomically, returns `{allowed, used, quota_limit, reservation_id}`. EXECUTE granted to service_role only.

## Code changes required

1. **`src/lib/ai/analyze.functions.ts` — switch to the reservation RPC**
   - After the cache check (cached results must NOT consume quota), replace the manual lifetime/monthly counts + direct `ai_analysis_usage` insert with one `supabaseAdmin.rpc("reserve_ai_analysis", { _user_id, _listing_id })` call.
   - Map the result: `allowed=false` → existing error shapes (`free_sample_used` for non-premium, `monthly_limit_reached` for premium) using returned `used`/`quota_limit`.
   - Keep the AI call and `ai_analyses` cache upsert as-is; drop the final manual `ai_analysis_usage` insert (the reservation already wrote it).
   - Note: the reservation intentionally counts attempted (uncached) analyses, including provider failures — matches the function's comment.

2. **Carry the listing id to the dialog** — `reserve_ai_analysis` requires a non-null `_listing_id` of an active stored listing, but `Listing` (`src/lib/scanner/types.ts`) has no `id` and the dialog input sends none.
   - Add `id?: string` to `Listing` and map it from the DB row in `src/lib/listings/query.functions.ts` (add `id` to the select if missing).
   - Pass `listing_id: listing.id` in `AIAnalysisDialog.tsx`.
   - Guard: if a listing has no id (shouldn't happen for DB-backed results), disable the analysis button with a tooltip rather than calling the RPC (it raises "Listing is unavailable").

## Verification

- Apply migration via the database migration tool, byte-for-byte as pasted.
- Run `node node_modules/typescript/bin/tsc --noEmit --pretty false` and `node node_modules/vitest/vitest.mjs run`.
- New unit tests with mocks only — no live AI call, no real quota consumption: stub the Supabase admin client and the AI gateway `fetch`, then assert (a) a cache hit returns without calling the reservation RPC, (b) `allowed=false` for a non-premium user maps to `free_sample_used`, (c) `allowed=false` for premium maps to `monthly_limit_reached` with used/limit, (d) `allowed=true` proceeds and does not insert usage a second time.
- No live AI analysis is run and the Free sample is not consumed. Live end-to-end verification (homepage results still load under service-role-only access, real quota decrement) is left to the project owner after deploy.

## Already verified (no change needed)

- No browser code reads `listings` directly — every read goes through `supabaseAdmin` on the server (`query.functions.ts`, `analyze.functions.ts`, scanners, alerts, cron), so the lockdown breaks nothing.
- `plan.functions.ts` and `admin.functions.ts` only SELECT from `ai_analysis_usage`; the existing read-own policy and service role keep them working.
