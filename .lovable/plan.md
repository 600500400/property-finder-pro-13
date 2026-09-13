# Manuální udělení Premium v adminu

Cíl: admin může komukoli zapnout Premium bez platby (comped / test účty), s volitelnou expirací, s viditelným rozlišením „Stripe vs. ručně" a s auditní stopou.

## Co uvidíš v adminu

- V tabulce uživatelů nový sloupec **Zdroj Premium**: `Stripe`, `Ručně` nebo `—`, plus datum expirace (u ručního „bez omezení", pokud je neomezené).
- U každého uživatele tlačítko **Udělit Premium** / **Odebrat Premium**.
- Při udělení se zobrazí malý dialog s volbou trvání: 1 měsíc, 3 měsíce, 12 měsíců, nebo **neomezeně**.
- Pod tabulkou (v řádku detailu) info „udělil <e-mail admina>, <datum>".

## Chování

- Ruční Premium je uložené zvlášť od Stripe dat, takže ho platební webhooky nikdy nepřepíšou ani nesmažou.
- Uživatel je Premium, pokud má aktivní Stripe předplatné **nebo** platné ruční udělení. Když ruční udělení vyprší, uživatel automaticky spadne na Free.
- Vše se vyhodnocuje a povoluje na serveru; ruční udělení může provést jen admin. Běžný uživatel si nemůže nic zapnout.
- Ruční Premium dává úplně stejná práva jako placené, protože všechny limity (500 výsledků, žádné 24h zpoždění, neomezení hlídací psi, AI analýzy, export CSV/XLS) čtou jedinou funkci pro určení tarifu.

## Technické detaily

**Migrace** (nová tabulka, nemění se stávající):

```sql
CREATE TABLE public.manual_premium_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  manual_premium_until timestamptz,           -- NULL = neomezeně
  granted_by uuid REFERENCES auth.users(id),
  granted_by_email text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  note text
);
GRANT SELECT ON public.manual_premium_grants TO authenticated;  -- čtení jen vlastní řádek
GRANT ALL ON public.manual_premium_grants TO service_role;
ALTER TABLE public.manual_premium_grants ENABLE ROW LEVEL SECURITY;
-- policy: SELECT vlastního řádku (auth.uid() = user_id) + SELECT pro adminy (has_role(auth.uid(),'admin'))
-- žádné INSERT/UPDATE policy → zápis pouze service_role ze server funkce
```

Aktualizace `public.is_premium(_user_id)` (SECURITY DEFINER, stále stabilní) na `existující stripe podmínka OR EXISTS (select 1 from manual_premium_grants where user_id=_user_id and revoked_at is null and (manual_premium_until is null or manual_premium_until > now()))`. Tím se ruční override propaguje do všech gates, které už `is_premium` používají (`src/lib/billing/premium.server.ts`).

**Server funkce** v `src/lib/admin/admin.functions.ts` (obě `.middleware([requireSupabaseAuth])`, obě nejdřív ověří `supabase.rpc('has_role', {_role:'admin'})`, pak použijí `supabaseAdmin` z `client.server`):

- `grantManualPremium({ user_id, months: 1|3|12|null, note? })` → upsert řádku, `manual_premium_until = null` pro neomezeně, `revoked_at = null`, `granted_by`/`granted_by_email` z contextu volajícího admina.
- `revokeManualPremium({ user_id })` → nastaví `revoked_at = now()` (historie zůstává pro audit).

**Dashboard** `getAdminDashboard`: dotáhne `manual_premium_grants`, `AdminUserRow` dostane `premium_source: 'stripe' | 'manual' | null`, `premium_until: string | null` (null + manual = neomezeně), `granted_by_email`, `granted_at`. Souhrn „Premium" počítá i ručně udělené.

**UI** `src/routes/_authenticated/admin.tsx`: `UserRow` dostane sloupec zdroje/expirace a akční tlačítka; udělení řeší malý dialog s výběrem trvání; po akci `queryClient.invalidateQueries()` pro obnovu tabulky.

**Ověření po nasazení:** ručně udělím Premium testovacímu účtu a v prohlížeči zkontroluji, že vidí 500 výsledků bez 24h zpoždění, může přidat víc hlídacích psů, spustit AI analýzu a exportovat CSV/XLS; potom odeberu a potvrdím návrat na Free.
