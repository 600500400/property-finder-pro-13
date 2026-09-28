# RealityScanner – nasazení SEO, provozovatele a bezpečných plateb

## Stav a pořadí nasazení

Kód a migrace jsou v tomto PR. Testy používají Stripe mocky a izolovaný PostgreSQL
(PGlite), nikoli produkční Stripe ani produkční Supabase.

1. Sloučit PR do main a počkat na synchronizaci GitHub → Lovable.
2. **Před Publish aplikovat migraci** `supabase/migrations/20260927090000_billing_safety.sql`
   přes důvěryhodný migrační nástroj připojený ke správnému projektu. Git sync ani
   Publish samy o sobě nejsou důkazem provedení migrace.
   Je aditivní: dvě server-only tabulky a čtyři funkce. Nedotýká se skenerů ani AI.
   Bez ní nové checkouty bezpečně selžou a webhook vrátí 500 k opakování.
3. V Lovable ověřit existující secrets (nikdy je nevkládat do Gitu):
   - `STRIPE_SECRET_KEY` a odpovídající `STRIPE_WEBHOOK_SECRET` ze stejného test/live prostředí;
   - `PUBLIC_APP_URL=https://www.realityscanner.cz`;
   - stávající Supabase serverové proměnné, zejména service role.
     Tato implementace žádné klíče nepřepíná. Test/live štítek odvozuje server
     z typu klíče a klientovi posílá pouze štítek.
4. V existujícím Stripe endpointu ověřit URL
   `https://www.realityscanner.cz/api/public/stripe/webhook` a události
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created/updated/deleted/paused/resumed`,
   `invoice.paid`, `invoice.payment_failed`. Ověřit aktivní Customer Portal,
   možnost vypnout obnovování a údaje obchodníka / support e-mail.
5. V Supabase Auth ověřit Site URL a povolené potvrzovací redirecty pro vlastní
   produkční doménu a odděleně pro používaný preview. Nepovolovat libovolné cizí domény.
6. Publikovat. Ověřit veřejné stránky, ceník, přihlášení a webhook logy.
   Nasazení zde nebylo ověřeno reálnou platbou. Funkční sandbox není důkazem live aktivace.

## Kontrola migrace (bez mutace dat)

```sql
select to_regclass('public.billing_operations'), to_regclass('public.stripe_processed_events');
select
  has_function_privilege('anon', 'public.acquire_billing_operation(uuid)', 'EXECUTE') as anon_must_be_false,
  has_function_privilege('authenticated', 'public.apply_stripe_subscription(uuid,uuid,text,jsonb)', 'EXECUTE') as authenticated_must_be_false,
  has_function_privilege('service_role', 'public.apply_stripe_subscription(uuid,uuid,text,jsonb)', 'EXECUTE') as service_must_be_true;
```

Událost a změna předplatného se zapíší v jedné transakci. Čtení Stripe probíhá
pod 120s zámkem pro uživatele; starý držitel se svým tokenem nemůže přepsat nového.
Při souběhu webhook vrátí 500, aby Stripe opakoval doručení. Uchovat upozornění
na opakovaně selhávající webhooky. DB chyby se nesmějí obcházet vracením 200.
PGlite testuje SQL a tokeny, nenahrazuje zátěžový test více produkčních DB spojení.

Checkout ukládá idempotency key před voláním Stripe, znovu používá rozpracovanou
session a při změně tarifu předchozí session ukončí. Předplatná se ověřují přímo
ve Stripe, včetně `past_due` a `incomplete`. Existující zákazník jde do portálu.

### Nejasný checkout po dlouhém výpadku

Pokud nemáme session ID a od vytvoření pokusu uběhlo 23 hodin, nový checkout se
nezakládá naslepo: Stripe nemusí po 24 hodinách držet idempotency key.
Podpora ověří zákazníka ve Stripe a session podle `metadata.attempt_id`.
Při nalezení propojí její ID s uloženým pokusem. Pokus nemažte bez ověření,
že neexistuje platba, aktivní předplatné ani otevřený checkout.
Stejně ručně řešte historická duplicitní předplatná; migrace je automaticky neruší.

## SEO a měření

- Nové SSR stránky: `/investicni-nemovitosti`, `/kalkulacka-vynosu`,
  `/jak-poznat-predrazeny-byt`, `/kontakt`; sitemap je generuje z registrace rout.
- Canonical je na každé veřejné cílové stránce právě jednou, ne zděděný z rootu.
- Přesměrování domén spravuje pouze hosting: www → realityscanner.cz.
  Aplikace nesmí přesměrovávat opačně na www; vznikla by produkční smyčka.
  Po Publish ověřit GET na obou doménách: konečná odpověď musí být 200.
  Tato hotfix oprava nevyžaduje novou migraci ani změnu Stripe konfigurace.
- Search Console: ověřit vlastnictví domény přes DNS nebo nastavit veřejnou
  `VITE_GOOGLE_SITE_VERIFICATION` (URL-prefix property), následně odeslat
  `https://www.realityscanner.cz/sitemap.xml`. Token ani účet zde nejsou nastavené.
- Připravený DOM event `realityscanner:conversion` obsahuje pouze `detail.event`:
  `organic_landing`, `signup_confirmation_required`, `signup_completed`,
  `checkout_started`, `premium_confirmed`. Žádný e-mail, user ID ani URL inzerátu.
  Sám nic neodesílá, neukládá cookies a **není aktivní analytickou službou**.
  Pro skutečný funnel je třeba připojit odsouhlasený analytický nástroj,
  ošetřit souhlas a deduplikaci i registraci dokončenou potvrzovacím e-mailem.
  Klientské Premium potvrzení není účetní evidence plateb; zdrojem je Stripe.

## Údaje a právní kontrola před ostrým prodejem

Společný zdroj: `src/lib/site.ts`. Provozovatel Ing. Kamil Němec, IČO 88549836,
Javorová 266/4, 250 64 Zlonín; potvrzený kontakt kamelpost@gmail.com.
Dobrovolná garance 14 dnů vrácení peněz byla na pokyn provozovatele odstraněna.
Zákonná spotřebitelská práva zůstávají nedotčena. Nepřidáváme tvrzení o DPH.

Text není právní posudek. Před live prodejem potvrdit úplné předsmluvní informace,
reklamační/odstupovací postup a případný formulář, datum účinnosti a způsob
oznámení stávajícím zákazníkům; ověřit skutečné zpracovatele AI, regiony,
uchovávání logů, daňový status a smlouvy s poskytovateli.
Neznámé údaje nebyly doplněny odhadem. Odkazy k právnímu ověření:
https://coi.gov.cz/faq/smlouvy-o-poskytovani-digitalniho-obsahu-ci-sluzby/
https://coi.gov.cz/informace-o-adr/

## Lokální ověření

```sh
bun install --frozen-lockfile
bunx vitest run tests/billing-flow.test.ts tests/billing-migration.test.ts tests/auth-return-seo.test.ts tests/conversion-events.test.ts tests/premium-tier.test.ts tests/ai-quota.test.ts
bunx tsc --noEmit
bun run build
```

Kalkulačka používá vlastní náklady a neobsazenost místo paušálu skeneru;
stávající výnosové vzorce a kalibrace ČSÚ se nezměnily.
Po přihlášení se zachovává tarif a návrat k tlačítku vybraného inzerátu.
AI analýza se automaticky nespouští a nespotřebovává tím kredit.
