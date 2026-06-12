# Etapa 4 — Stripe Subscriptions & Freemium Gating

User-provided BYOK Stripe in TEST mode. Sandbox `sk_test_…` will be requested after plan approval and stored as `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET` after webhook is created in Stripe dashboard).

## Plans

| Capability | FREE | PREMIUM |
|---|---|---|
| Listings freshness | exclude < 24 h | real-time |
| Results per query | max 20 | unlimited |
| Saved searches | max 1, daily only | unlimited, instant + daily |
| CSV export | ❌ | ✅ |

PREMIUM: **349 Kč/měsíc** nebo **3 490 Kč/rok** (CZK).

---

## 1. Database (migration)

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text,                       -- active|trialing|past_due|canceled|incomplete|…
  plan text,                         -- 'monthly'|'yearly'|null
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own_subscription_read" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);
-- writes only via service_role (webhook)
create index on public.subscriptions(stripe_customer_id);
```

## 2. Stripe wiring

`src/lib/billing/stripe.server.ts` — lazy Stripe client (`new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-…' })`).

`src/lib/billing/products.server.ts` — `ensureProducts()` idempotent: looks up product by metadata key `app=realityscanner-premium`; if missing, creates Product + 2 recurring Prices (CZK 349 monthly, CZK 3 490 yearly) with lookup keys `premium_monthly` / `premium_yearly`. Returns price IDs. Called lazily on first checkout / on `/api/public/cron/ensure-products` (manual one-shot).

`src/lib/billing/plan.server.ts` — **`getUserPlan(userId)`** → `'free' | 'premium'`. Premium when `status in ('active','trialing')` AND `current_period_end > now()`. Used by every gate.

## 3. Server-side gates (NOT UI-only)

- **`queryListings`** (`src/lib/listings/query.functions.ts`): after auth resolution, if plan='free' → force `freshness` to exclude listings with `first_seen_at > now() - 24h` AND slice results to 20. Public/anon visitors = treated as free.
- **`upsertSavedSearch`**: if free → reject when `frequency='instant'` OR when count of existing active searches ≥ 1 (on insert). Returns typed error `{ code:'upgrade_required' }`.
- **CSV export**: move from client-side to new server fn `exportListingsCsv` requiring auth + premium; returns CSV string. Client downloads via blob. Free users → 403.
- **`processInstantAlerts`** (`notify.server.ts`): filter saved_searches to only those whose owner has premium plan; non-premium instant rows silently demoted (treated as daily by digest job).
- **Daily digest** already covers everyone — no change needed beyond including demoted instant searches (already daily-equivalent).

## 4. Checkout & Portal server functions

`src/lib/billing/billing.functions.ts` (all `requireSupabaseAuth`):
- `createCheckoutSession({ interval: 'monthly'|'yearly' })` → ensures Stripe customer (create if missing, store on subscriptions row stub), creates Checkout Session `mode:'subscription'`, line_items=[price], `client_reference_id=user_id`, `metadata:{user_id}`, `subscription_data.metadata:{user_id}`, success `/cenik?success=1`, cancel `/cenik?canceled=1`. Returns `{ url }`.
- `createPortalSession()` → Stripe Billing Portal session, returns `{ url }`.
- `getMyPlan()` → `{ plan, status, current_period_end, stripe_customer_id }` for UI.

## 5. Webhook

`src/routes/api/public/billing/stripe-webhook.ts` (raw body + signature verify via `STRIPE_WEBHOOK_SECRET`):

Events handled:
- `checkout.session.completed` → read `metadata.user_id`, expand subscription, upsert subscriptions row.
- `customer.subscription.created|updated|deleted` → upsert by `stripe_subscription_id`; resolve user via existing row's user_id OR `subscription.metadata.user_id`. Map `items.data[0].price.lookup_key` → plan ('monthly'/'yearly').
- `invoice.paid` → ensure status='active' and refresh current_period_end.
- `invoice.payment_failed` → status='past_due'.

NEVER trust email matching. If user_id missing → log + 200 (avoid retries storm).

## 6. UI (Czech, dark)

- **`/cenik`** (public route): two cards Zdarma / Premium (benefit list, ✓/✗), interval toggle Měsíčně/Ročně (with "ušetříte 2 mes."), CTA "Aktivovat Premium" → calls `createCheckoutSession` → `window.location = url`. Logged-out CTA → redirect `/auth?next=/cenik`. Handle `?success=1` / `?canceled=1` toast.
- **Header plan badge**: `<PlanBadge />` in `UserMenu` row (gold "Premium" pill / muted "Free").
- **Upgrade banner** above results when free user has freshness="24h" or hits 20-cap: "Nejlepší investice mizí během hodin — Premium vidí nové inzeráty okamžitě." with link to /cenik.
- **UserMenu**: "Správa předplatného" item (premium only) → calls `createPortalSession` → redirect.
- **SaveSearchDialog**: if free → disable "Okamžitě" radio with tooltip; on submit-and-would-exceed-limit → open `<UpgradeDialog>` instead of saving.
- **CSV button**: free → click opens `<UpgradeDialog>`.
- **`<UpgradeDialog>`** shared component with CTA to /cenik.
- `/watchdogs` shows lock icon next to instant rows for free users (after demotion).

## 7. Secrets request

After plan approval: `secrets--add_secret(['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])`. User pastes test-mode `sk_test_…`. After first deploy I'll give the webhook URL `https://property-finder-pro-13.lovable.app/api/public/billing/stripe-webhook` to register in Stripe dashboard → returns `whsec_…`.

## 8. Files

**New**
- migration `subscriptions.sql`
- `src/lib/billing/stripe.server.ts`
- `src/lib/billing/products.server.ts`
- `src/lib/billing/plan.server.ts`
- `src/lib/billing/billing.functions.ts`
- `src/routes/api/public/billing/stripe-webhook.ts`
- `src/routes/cenik.tsx`
- `src/components/PlanBadge.tsx`
- `src/components/UpgradeDialog.tsx`
- `src/components/UpgradeBanner.tsx`
- `src/lib/listings/export.functions.ts` (server CSV)
- `tests/plan-gates.test.ts`

**Edited**
- `src/lib/listings/query.functions.ts` (free gate)
- `src/lib/alerts/saved-searches.functions.ts` (count + frequency gate)
- `src/lib/alerts/notify.server.ts` (premium-only instant)
- `src/components/SaveSearchDialog.tsx` (instant disabled + upgrade modal)
- `src/components/FilterSidebar.tsx` (CSV gate hook)
- `src/components/UserMenu.tsx` (badge + portal link)
- `src/routes/index.tsx` (upgrade banner, server-driven CSV)

## 9. Acceptance / test checklist (provided after build)

Will include: create test acct → upgrade with 4242 4242 4242 4242 → verify webhook fires → DB row appears → header badge flips → instant alerts work → cancel via portal → falls back to free after period end → free user blocked at queryListings/save/csv.

---

After approval I'll request the two secrets, then implement.
