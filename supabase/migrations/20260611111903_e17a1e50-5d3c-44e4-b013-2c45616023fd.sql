WITH parsed AS (
  SELECT
    l.id,
    l.area_m2 AS old_area,
    regexp_match(
      COALESCE(NULLIF(l.raw_data->>'name', ''), l.title, ''),
      '(\d{1,4})(?:[.,](\d{1,2}))?\s*m[²2]'
    ) AS m
  FROM public.listings l
),
calc AS (
  SELECT
    id,
    old_area,
    CASE
      WHEN m IS NULL THEN NULL
      ELSE round(
        (m[1])::numeric
        + COALESCE((m[2])::numeric / power(10, length(m[2])), 0)
      )::integer
    END AS raw_area
  FROM parsed
),
clamped AS (
  SELECT
    id,
    old_area,
    CASE
      WHEN raw_area IS NULL OR raw_area < 10 OR raw_area > 2000 THEN NULL
      ELSE raw_area
    END AS new_area
  FROM calc
)
UPDATE public.listings AS l
SET area_m2 = c.new_area
FROM clamped c
WHERE l.id = c.id
  AND c.new_area IS DISTINCT FROM c.old_area;