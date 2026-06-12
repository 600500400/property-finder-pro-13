# Etapa 3 — Hlídací psi (saved searches with email alerts)

## Pre-check ✅
Counted `cron.job WHERE jobname LIKE 'scrape-%'` → **46 jobs** (sreality 10, bezrealitky 10, bazos 10, annonce 4, hyperinzerce 4, idnes 4, realitymix 4). Firecrawl jobs are intact — no re-creation needed.

## Scope
1. New table `saved_searches` + `email_log`
2. UI: "Uložit hledání" button on FilterSidebar + modal + `/watchdogs` management page
3. Matching engine (`match.server.ts`) reusing hybrid yield logic
4. Delivery: instant (post-scrape hook) + daily digest (06:00 UTC cron)
5. Resend integration using `onboarding@resend.dev` sandbox sender
6. Czech texts, dark design, rate-safe

---

## 1. Database (migration)

```sql
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  min_yield numeric,
  frequency text not null check (frequency in ('instant','daily')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);
create index on public.saved_searches(user_id);
create index on public.saved_searches(is_active, frequency);

grant select, insert, update, delete on public.saved_searches to authenticated;
grant all on public.saved_searches to service_role;
alter table public.saved_searches enable row level security;
create policy "own_saved_searches" on public.saved_searches
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  search_id uuid,
  listings_count int not null default 0,
  status text not null,           -- 'sent' | 'error' | 'skipped'
  error text,
  created_at timestamptz not null default now()
);
grant select on public.email_log to authenticated;
grant all on public.email_log to service_role;
alter table public.email_log enable row level security;
create policy "own_email_log" on public.email_log
  for select to authenticated using (auth.uid() = user_id);
```

## 2. Matching module — `src/lib/alerts/match.server.ts`
- Pure function `matchesSearch(listing, search, { bench, rentIndex }): boolean`
- Reuses `computeHybridYield` from `yield.server.ts` so min_yield uses identical math as the UI
- Filter checks: deal_type, property_type, kraj, sources, price_min/max (freshness intentionally ignored)
- Unit-test fixtures in `tests/match.test.ts` (Vitest): match/no-match by region, by price band, by min_yield threshold

## 3. UI

**FilterSidebar.tsx** — add "💾 Uložit hledání" button beneath existing controls.
- Logged-out: disabled `<Button>` wrapped in tooltip "Přihlaste se pro uložení hledání"
- Logged-in: opens `<SaveSearchDialog>` (new component) — fields:
  - Název (auto-prefill: `"{deal_type} {property_type} {kraj} do {price_max}"`)
  - Frekvence: radio Denní souhrn (06:00) / Okamžitě
  - Min. výnos % (optional number)

**New route `src/routes/_authenticated/watchdogs.tsx`** ("Moji hlídací psi"):
- Lists user's saved searches with name, frequency badge, filters summary, last_notified_at
- Per-row actions: ✏️ Upravit / ⏸ Pozastavit/Spustit / 🗑 Smazat
- Empty state CTA back to scanner

**Server functions** in `src/lib/alerts/saved-searches.functions.ts`:
`listSavedSearches`, `createSavedSearch`, `updateSavedSearch`, `deleteSavedSearch`, `toggleSavedSearch` — all using `requireSupabaseAuth`.

Add nav link to UserMenu.

## 4. Delivery

### a) Instant — post-scrape hook
In `src/lib/scanner/persist.server.ts`, after the upsert loop, track which URLs were genuinely new (currently counted as `newCount`); collect their full rows and call new `processInstantAlerts(newListings)` from `src/lib/alerts/notify.server.ts`:
- Load active `frequency='instant'` saved_searches
- For each user: match listings, take up to 10 hits, send ONE email per user per scrape run, update `last_notified_at`
- Log each attempt in `email_log`

### b) Daily digest — cron
New route `src/routes/api/public/cron/daily-digest.ts` (Bearer `CRON_SECRET` via existing `verifyCronSecret`):
- For each active `frequency='daily'` search: query `listings` where `first_seen_at > coalesce(last_notified_at, created_at)` AND `is_active=true` AND filters match
- Group per user → one digest email (cap 50 listings total, 10 per search section)
- Update `last_notified_at = now()`; log to `email_log`
- Skip user entirely when 0 matches

pg_cron (via `supabase--insert`):
```sql
select cron.schedule('daily-digest','0 6 * * *', $$
  select net.http_post(
    url:='https://project--46a95943-c9d6-44b9-b4b6-4d3db3fc4a74.lovable.app/api/public/cron/daily-digest',
    headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret', true)),
    body:='{}'::jsonb
  );
$$);
```
*Note:* `CRON_SECRET` is already used by existing scrape routes — same Postgres setting pattern that's currently in use will be reused (will inspect existing scrape cron entries to copy the exact header form).

## 5. Email templates (`src/lib/alerts/email.ts`)
- `renderInstantEmail({ searchName, listings })` and `renderDigestEmail({ sections })`
- HTML: dark theme matching app (bg #0f172a-ish), listing cards with image, title, price (Kč), lokalita, výnos badge (color by stars), CTA "Zobrazit inzerát"
- Footer: "Spravovat hlídací psy" → `https://<published>/watchdogs`
- Plain-text fallback generated alongside HTML
- Subject (instant): `🏠 {n} nových nemovitostí — {search_name}`
- Subject (digest): `🏠 Denní souhrn: {n} nových nemovitostí`

Send via Resend REST API (`from: 'Hlídací pes <onboarding@resend.dev>'`). Will request `RESEND_API_KEY` secret right after plan approval (user said they'll provide it).

## 6. Rate safety
- Instant: max 1 email per user per scrape run (group by user_id before send)
- Digest: max 50 listings total per user email, 10 per search section
- Skip send when listings_count = 0 (log status='skipped' only when explicitly needed; otherwise no log row)
- `email_log` lets us audit and later add per-user daily cap if abuse appears

## Files

**New**
- `supabase/migrations/<ts>_saved_searches.sql`
- `src/lib/alerts/match.server.ts`
- `src/lib/alerts/notify.server.ts`
- `src/lib/alerts/email.ts`
- `src/lib/alerts/resend.server.ts`
- `src/lib/alerts/saved-searches.functions.ts`
- `src/components/SaveSearchDialog.tsx`
- `src/routes/_authenticated/watchdogs.tsx`
- `src/routes/api/public/cron/daily-digest.ts`
- `tests/match.test.ts`

**Edited**
- `src/components/FilterSidebar.tsx` (add Uložit button)
- `src/components/UserMenu.tsx` (add Watchdogs link)
- `src/lib/scanner/persist.server.ts` (collect new listings → call `processInstantAlerts`)

## Deliverables / acceptance
- Logged-in user can save a search, see it on `/watchdogs`, pause/edit/delete
- After a scrape run with new matches, instant subscriber receives one Czech email
- 06:00 UTC cron sends digest for daily subscribers
- All sends recorded in `email_log`
- Sandbox caveat surfaced in UI: small note on watchdogs page "Aktuálně doručujeme jen na e-mail majitele Resend účtu (sandbox). Po ověření domény dorazí na vaši adresu."

After approval I'll request `RESEND_API_KEY` via the secrets tool, then implement.
