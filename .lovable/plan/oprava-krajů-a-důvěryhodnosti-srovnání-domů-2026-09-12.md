# Oprava krajů a důvěryhodnosti srovnání domů

## Co změním

1. **Opravím rozpoznání kraje a okresu**
   - Pokud lokalita obsahuje výslovný název kraje, použije se přednostně a nemůže jej přebít částečná shoda názvu obce.
   - Zpřesním hledání názvů obcí tak, aby se `Mikulov` neshodoval uvnitř `Mikulovice`.
   - Doplním testy pro Mikulovice u Jeseníka, Mikulovice u Pardubic, Mikulov a dříve opravený Brno-venkov.

2. **Přepočítám existující data**
   - Opravím všech 122 prokazatelně chybně přiřazených nenulových krajů podle výslovného kraje v lokalitě, včetně bytů.
   - Současně doplním 1 292 chybějících krajů tam, kde je kraj v lokalitě výslovně uveden.
   - Po změně ověřím Mikulovice u Jeseníka i souhrnný počet opravených řádků.

3. **Označím slabší srovnání domů**
   - Krajské srovnání nebo vzorek menší než 10 zobrazím tlumeně s varovnou ikonou a požadovaným tooltipem.
   - Okresní srovnání s alespoň 10 vzorky zůstane v běžném výrazném stylu.
   - Stejné pravidlo použiji v plné, kompaktní i řádkové kartě; vzhled bytů se nezmění.

4. **Doplním metodiku**
   - Přidám krátký odstavec, že domy se kvůli pozemku, stavu, novostavbě versus rekonstrukci a malým vzorkům srovnávají méně spolehlivě než byty.

## Ověření

- Spustím cílené testy mapování a kontrolu typů.
- Ověřím data po přemapování a zkontroluji zobrazení slabého i silného srovnání domu v náhledu.
