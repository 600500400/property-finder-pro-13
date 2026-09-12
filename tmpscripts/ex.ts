import { indexPriceComps, computePriceCompare, priceCompareLabel } from "../src/lib/listings/price-compare";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data: comps } = await supabaseAdmin.from("listings").select("property_type, kraj, city, area_m2, price, url").eq("is_active", true).eq("deal_type","prodej").limit(20000);
const idx = indexPriceComps(comps as any);
const { data: houses } = await supabaseAdmin.from("listings").select("title, city, kraj, area_m2, price, url, property_type").eq("is_active",true).eq("property_type","domy").not("area_m2","is",null).not("price","is",null).limit(40);
let n=0;
for (const h of houses ?? []) {
  const pc = computePriceCompare({propertyType:h.property_type,kraj:h.kraj,city:h.city,areaM2:h.area_m2,price:h.price,index:idx,selfUrl:h.url});
  console.log(`${(h.city??"?").slice(0,28)} | ${h.area_m2} m² | ${h.price} Kč | ${pc ? `${pc.own_per_m2} vs medián ${pc.median_per_m2}, n=${pc.samples}, úroveň=${pc.scope}, ${priceCompareLabel(pc)}` : "nedostatek dat pro srovnání"}`);
  if (++n>=8) break;
}
