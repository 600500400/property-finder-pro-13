import { indexPriceComps, computePriceCompare, priceCompareLabel } from "../src/lib/listings/price-compare";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const comps: any[] = [];
for (let from=0; from<30000; from+=1000) {
  const { data } = await supabaseAdmin.from("listings").select("property_type, kraj, city, area_m2, price, url").eq("is_active", true).eq("deal_type","prodej").not("area_m2","is",null).not("price","is",null).range(from, from+999);
  if (!data?.length) break; comps.push(...data); if (data.length<1000) break;
}
console.log("comps", comps.length, "domy", comps.filter(c=>c.property_type==="domy").length);
const idx = indexPriceComps(comps as any);
for (const pt of ["domy","byty"]) {
  const { data: rows } = await supabaseAdmin.from("listings").select("city, kraj, area_m2, price, url, property_type").eq("is_active",true).eq("property_type",pt).not("area_m2","is",null).not("price","is",null).limit(60);
  let n=0;
  console.log("=== "+pt);
  for (const h of rows ?? []) {
    const pc = computePriceCompare({propertyType:h.property_type,kraj:h.kraj,city:h.city,areaM2:h.area_m2,price:h.price,index:idx,selfUrl:h.url});
    if (!pc && n>3) continue;
    console.log(`${(h.city??"?").slice(0,24)} | ${h.area_m2} m² | ${h.price} | ${pc ? `${pc.own_per_m2} Kč/m² vs medián ${pc.median_per_m2}, n=${pc.samples}, ${pc.scope}, ${priceCompareLabel(pc)}` : "nedostatek dat"}`);
    if (++n>=5) break;
  }
}
