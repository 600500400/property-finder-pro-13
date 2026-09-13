# Fix: desktop sidebar nejde scrollovat — root cause + oprava

## Root cause (změřeno v živém preview, 1280×800)

Řetězec předků sidebaru:

```text
div.flex h-[100dvh] min-h-0 flex-col          h=800   (viewport)
└─ div.grid flex-1 overflow-hidden            h=739, scrollHeight=1275  ← klipuje
   └─ div.hidden h-full md:block              h=1275  ← nafoukl se na výšku obsahu
      └─ aside.h-full overflow-y-auto         h=1275, scrollHeight=1275 → není co scrollovat
```

Grid má `overflow-hidden`, ale řádek gridu je `auto` → přizpůsobí se obsahu.
Buňka (`h-full`) i `aside` se roztáhnou na plnou výšku obsahu (1275 px) a grid je
pouze ořízne. `aside` tedy má `scrollHeight === clientHeight` → kolečko/touchpad
nemají co scrollovat, dolní filtry (cena, zdroje dat, hlídací pes) jsou fyzicky
mimo viditelnou plochu. Blokující prvek: grid řádek bez výškového omezení —
žádný prvek v řetězci nevynutí, aby se aside vešel do viewportu.

Proč předchozí fix nepomohl: změnil `h-screen` → `h-[100dvh]` na nejvnějším
wrapperu, ale problém je v grid buňce, ne ve výšce wrapperu.

## Oprava (src/routes/index.tsx + src/components/FilterSidebar.tsx)

1. Grid (ř. 185): přidat `min-h-0` → `grid flex-1 min-h-0 overflow-hidden md:grid-cols-[300px_1fr]`
2. Wrapper buňka (ř. 186): `hidden min-h-0 overflow-y-auto md:block`
   - `min-h-0` + neviditelný overflow nastaví automatické minimum grid itemu na 0,
     takže se řádek smrští na výšku gridu místo výšky obsahu.
   - Scroll container se přesune sem (na buňku), ne na aside.
3. FilterSidebar `aside` (ř. 87): odebrat `h-full overflow-y-auto`, nechat
   `flex flex-col gap-5 …` — aside teď roste přirozeně a scrolluje wrapper.
   - Mobilní Sheet: `SheetContent` už má vlastní `overflow-y-auto`, takže mobilní
     chování zůstane beze změny (aside bez h-full v Sheetu funguje stejně).
4. `<main className="overflow-y-auto">` beze změny — výsledky scrollují samostatně.

## Ověření (Playwright, 1280×800)

- Po načtení: `aside`/`wrapper` má `scrollHeight > clientHeight` a wheel nad
  sidebarem posune `scrollTop` až na konec — poslední prvek (hlídací pes) viditelný.
- Wheel nad výsledky posune `main`, sidebar zůstane stát (nezávislé scrolly).
- Mobilní viewport: Sheet s filtry stále scrolluje.

## Technické poznámky

- Neřešíme sticky — scroll container přímo ve sloupci je jednodušší a robustnější.
- Žádná změna logiky, filtrů ani mobilní cesty.
