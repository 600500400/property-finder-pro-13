import { indexPriceComps } from "../src/lib/listings/price-compare";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data: comps } = await supabaseAdmin.from("listings").select("property_type, kraj, city, area_m2, price, url").eq("is_active", true).eq("deal_type","prodej").limit(20000);
console.log("rows", comps?.length, "domy", comps?.filter((c:any)=>c.property_type==="domy").length);
const idx = indexPriceComps(comps as any);
const keys=[...idx.keys()].filter(k=>k.startsWith("domy")).map(k=>[k,idx.get(k)!.length] as const).sort((a,b)=>b[1]-a[1]).slice(0,12);
console.log(keys);
