-- Re-classify house subtype: title first (portal category wording), description only as fallback.
UPDATE public.listings
SET house_subtype = coalesce(
  CASE
    WHEN s.t ~ '\musedlost|\mstatek\M|\mstatku\M' THEN 'usedlost'
    WHEN s.t ~ '\mchata\M|\mchaty\M|\mchatu\M|\mchalup|rekreacni objekt|\msrub\M' THEN 'chalupa_chata'
    WHEN s.t ~ '\mvila\M|\mvily\M|\mvilu\M|\mvilov' THEN 'vila'
    WHEN s.t ~ '\mradov|\mradovk|dvojdom' THEN 'dvojdomek_radovka'
    WHEN s.t ~ '\mrodinn|\mdomek\M|\mdum\M|\mdomu\M' THEN 'rodinny_dum'
  END,
  CASE
    WHEN s.d ~ '\musedlost|\mstatek\M|\mstatku\M' THEN 'usedlost'
    WHEN s.d ~ '\mchata\M|\mchaty\M|\mchatu\M|\mchalup|rekreacni objekt|\msrub\M' THEN 'chalupa_chata'
    WHEN s.d ~ '\mvila\M|\mvily\M|\mvilu\M|\mvilov' THEN 'vila'
    WHEN s.d ~ '\mradov|\mradovk|dvojdom' THEN 'dvojdomek_radovka'
    WHEN s.d ~ '\mrodinn|\mdomek\M|\mdum\M|\mdomu\M' THEN 'rodinny_dum'
  END,
  'jine')
FROM (
  SELECT id AS lid,
    lower(translate(coalesce(title,''), 'áčďéěíňóřšťúůýž', 'acdeeinorstuuyz')) AS t,
    lower(translate(coalesce(description_snippet,''), 'áčďéěíňóřšťúůýž', 'acdeeinorstuuyz')) AS d
  FROM public.listings WHERE property_type = 'domy'
) s
WHERE public.listings.id = s.lid AND public.listings.property_type = 'domy';
