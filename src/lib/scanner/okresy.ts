// Mapa 77 okresů ČR + Sreality district IDs + city → okres lookup.
// Slugy bez diakritiky, lowercase, "-".

export interface OkresInfo {
  slug: string;
  label: string;
  region: string; // slug kraje (viz types.ts Region)
  sreality_id?: number; // Sreality locality_district_id
  static_rent_per_m2: number; // Kč/m²/měsíc — fallback medián (byty)
}

// Sreality district IDs (locality_district_id) – ze sreality.cz nápovědy.
// Hodnoty static_rent_per_m2 jsou odhady z Deloitte Rent Index Q4 2024 + ČSÚ + scraped průměry Sreality 2025.
export const OKRESY: OkresInfo[] = [
  // Praha (jediný okres = celá Praha; obvody řešíme zvlášť v RENT_PER_M2_DISTRICT)
  { slug: "praha", label: "Hlavní město Praha", region: "praha", sreality_id: 5000, static_rent_per_m2: 415 },
  // Středočeský
  { slug: "benesov", label: "Benešov", region: "stredocesky", sreality_id: 5001, static_rent_per_m2: 250 },
  { slug: "beroun", label: "Beroun", region: "stredocesky", sreality_id: 5002, static_rent_per_m2: 265 },
  { slug: "kladno", label: "Kladno", region: "stredocesky", sreality_id: 5003, static_rent_per_m2: 270 },
  { slug: "kolin", label: "Kolín", region: "stredocesky", sreality_id: 5004, static_rent_per_m2: 240 },
  { slug: "kutna-hora", label: "Kutná Hora", region: "stredocesky", sreality_id: 5005, static_rent_per_m2: 220 },
  { slug: "melnik", label: "Mělník", region: "stredocesky", sreality_id: 5006, static_rent_per_m2: 245 },
  { slug: "mlada-boleslav", label: "Mladá Boleslav", region: "stredocesky", sreality_id: 5007, static_rent_per_m2: 260 },
  { slug: "nymburk", label: "Nymburk", region: "stredocesky", sreality_id: 5008, static_rent_per_m2: 240 },
  { slug: "praha-vychod", label: "Praha-východ", region: "stredocesky", sreality_id: 5009, static_rent_per_m2: 310 },
  { slug: "praha-zapad", label: "Praha-západ", region: "stredocesky", sreality_id: 5010, static_rent_per_m2: 320 },
  { slug: "pribram", label: "Příbram", region: "stredocesky", sreality_id: 5011, static_rent_per_m2: 220 },
  { slug: "rakovnik", label: "Rakovník", region: "stredocesky", sreality_id: 5012, static_rent_per_m2: 200 },
  // Jihočeský
  { slug: "ceske-budejovice", label: "České Budějovice", region: "jihocesky", static_rent_per_m2: 285 },
  { slug: "cesky-krumlov", label: "Český Krumlov", region: "jihocesky", static_rent_per_m2: 240 },
  { slug: "jindrichuv-hradec", label: "Jindřichův Hradec", region: "jihocesky", static_rent_per_m2: 215 },
  { slug: "pisek", label: "Písek", region: "jihocesky", static_rent_per_m2: 235 },
  { slug: "prachatice", label: "Prachatice", region: "jihocesky", static_rent_per_m2: 210 },
  { slug: "strakonice", label: "Strakonice", region: "jihocesky", static_rent_per_m2: 220 },
  { slug: "tabor", label: "Tábor", region: "jihocesky", static_rent_per_m2: 240 },
  // Plzeňský
  { slug: "domazlice", label: "Domažlice", region: "plzensky", static_rent_per_m2: 215 },
  { slug: "klatovy", label: "Klatovy", region: "plzensky", static_rent_per_m2: 220 },
  { slug: "plzen-mesto", label: "Plzeň-město", region: "plzensky", static_rent_per_m2: 290 },
  { slug: "plzen-jih", label: "Plzeň-jih", region: "plzensky", static_rent_per_m2: 240 },
  { slug: "plzen-sever", label: "Plzeň-sever", region: "plzensky", static_rent_per_m2: 240 },
  { slug: "rokycany", label: "Rokycany", region: "plzensky", static_rent_per_m2: 235 },
  { slug: "tachov", label: "Tachov", region: "plzensky", static_rent_per_m2: 215 },
  // Karlovarský
  { slug: "cheb", label: "Cheb", region: "karlovarsky", static_rent_per_m2: 215 },
  { slug: "karlovy-vary", label: "Karlovy Vary", region: "karlovarsky", static_rent_per_m2: 235 },
  { slug: "sokolov", label: "Sokolov", region: "karlovarsky", static_rent_per_m2: 180 },
  // Ústecký
  { slug: "decin", label: "Děčín", region: "ustecky", static_rent_per_m2: 195 },
  { slug: "chomutov", label: "Chomutov", region: "ustecky", static_rent_per_m2: 175 },
  { slug: "litomerice", label: "Litoměřice", region: "ustecky", static_rent_per_m2: 215 },
  { slug: "louny", label: "Louny", region: "ustecky", static_rent_per_m2: 195 },
  { slug: "most", label: "Most", region: "ustecky", static_rent_per_m2: 170 },
  { slug: "teplice", label: "Teplice", region: "ustecky", static_rent_per_m2: 200 },
  { slug: "usti-nad-labem", label: "Ústí nad Labem", region: "ustecky", static_rent_per_m2: 220 },
  // Liberecký
  { slug: "ceska-lipa", label: "Česká Lípa", region: "liberecky", static_rent_per_m2: 210 },
  { slug: "jablonec-nad-nisou", label: "Jablonec nad Nisou", region: "liberecky", static_rent_per_m2: 250 },
  { slug: "liberec", label: "Liberec", region: "liberecky", static_rent_per_m2: 275 },
  { slug: "semily", label: "Semily", region: "liberecky", static_rent_per_m2: 215 },
  // Královéhradecký
  { slug: "hradec-kralove", label: "Hradec Králové", region: "kralovehradecky", static_rent_per_m2: 270 },
  { slug: "jicin", label: "Jičín", region: "kralovehradecky", static_rent_per_m2: 230 },
  { slug: "nachod", label: "Náchod", region: "kralovehradecky", static_rent_per_m2: 215 },
  { slug: "rychnov-nad-kneznou", label: "Rychnov nad Kněžnou", region: "kralovehradecky", static_rent_per_m2: 220 },
  { slug: "trutnov", label: "Trutnov", region: "kralovehradecky", static_rent_per_m2: 225 },
  // Pardubický
  { slug: "chrudim", label: "Chrudim", region: "pardubicky", static_rent_per_m2: 235 },
  { slug: "pardubice", label: "Pardubice", region: "pardubicky", static_rent_per_m2: 265 },
  { slug: "svitavy", label: "Svitavy", region: "pardubicky", static_rent_per_m2: 200 },
  { slug: "usti-nad-orlici", label: "Ústí nad Orlicí", region: "pardubicky", static_rent_per_m2: 215 },
  // Vysočina
  { slug: "havlickuv-brod", label: "Havlíčkův Brod", region: "vysocina", static_rent_per_m2: 215 },
  { slug: "jihlava", label: "Jihlava", region: "vysocina", static_rent_per_m2: 235 },
  { slug: "pelhrimov", label: "Pelhřimov", region: "vysocina", static_rent_per_m2: 205 },
  { slug: "trebic", label: "Třebíč", region: "vysocina", static_rent_per_m2: 195 },
  { slug: "zdar-nad-sazavou", label: "Žďár nad Sázavou", region: "vysocina", static_rent_per_m2: 210 },
  // Jihomoravský
  { slug: "blansko", label: "Blansko", region: "jihomoravsky", static_rent_per_m2: 250 },
  { slug: "brno-mesto", label: "Brno-město", region: "jihomoravsky", static_rent_per_m2: 360 },
  { slug: "brno-venkov", label: "Brno-venkov", region: "jihomoravsky", static_rent_per_m2: 290 },
  { slug: "breclav", label: "Břeclav", region: "jihomoravsky", static_rent_per_m2: 240 },
  { slug: "hodonin", label: "Hodonín", region: "jihomoravsky", static_rent_per_m2: 220 },
  { slug: "vyskov", label: "Vyškov", region: "jihomoravsky", static_rent_per_m2: 250 },
  { slug: "znojmo", label: "Znojmo", region: "jihomoravsky", static_rent_per_m2: 225 },
  // Olomoucký
  { slug: "jesenik", label: "Jeseník", region: "olomoucky", static_rent_per_m2: 180 },
  { slug: "olomouc", label: "Olomouc", region: "olomoucky", static_rent_per_m2: 270 },
  { slug: "prerov", label: "Přerov", region: "olomoucky", static_rent_per_m2: 215 },
  { slug: "prostejov", label: "Prostějov", region: "olomoucky", static_rent_per_m2: 235 },
  { slug: "sumperk", label: "Šumperk", region: "olomoucky", static_rent_per_m2: 210 },
  // Zlínský
  { slug: "kromeriz", label: "Kroměříž", region: "zlinsky", static_rent_per_m2: 225 },
  { slug: "uherske-hradiste", label: "Uherské Hradiště", region: "zlinsky", static_rent_per_m2: 235 },
  { slug: "vsetin", label: "Vsetín", region: "zlinsky", static_rent_per_m2: 215 },
  { slug: "zlin", label: "Zlín", region: "zlinsky", static_rent_per_m2: 250 },
  // Moravskoslezský
  { slug: "bruntal", label: "Bruntál", region: "moravskoslezsky", static_rent_per_m2: 175 },
  { slug: "frydek-mistek", label: "Frýdek-Místek", region: "moravskoslezsky", static_rent_per_m2: 240 },
  { slug: "karvina", label: "Karviná", region: "moravskoslezsky", static_rent_per_m2: 185 },
  { slug: "novy-jicin", label: "Nový Jičín", region: "moravskoslezsky", static_rent_per_m2: 215 },
  { slug: "opava", label: "Opava", region: "moravskoslezsky", static_rent_per_m2: 230 },
  { slug: "ostrava-mesto", label: "Ostrava-město", region: "moravskoslezsky", static_rent_per_m2: 240 },
];

export const OKRES_BY_SLUG: Record<string, OkresInfo> = Object.fromEntries(
  OKRESY.map(o => [o.slug, o]),
);

// City → okres lookup. Klíč: deaccented lowercase názvy obcí/měst (a typické varianty).
// Smysl: když inzerát říká „Beroun", „Hořovice", „Karlštejn" — víme že je to okres Beroun.
// Necílíme úplnost; cílíme největší 250+ měst kde se generuje 90 % inzerce.
export const CITY_TO_OKRES: Record<string, string> = {
  // Středočeský
  "benesov": "benesov", "vlasim": "benesov", "sazava": "benesov",
  "beroun": "beroun", "horovice": "beroun", "kralic-dub": "beroun", "karlstejn": "beroun",
  "kladno": "kladno", "slany": "kladno", "unhost": "kladno", "stochov": "kladno",
  "kolin": "kolin", "cesky-brod": "kolin", "pecky": "kolin",
  "kutna-hora": "kutna-hora", "caslav": "kutna-hora", "uhlirske-janovice": "kutna-hora",
  "melnik": "melnik", "kralupy-nad-vltavou": "melnik", "neratovice": "melnik",
  "mlada-boleslav": "mlada-boleslav", "benatky-nad-jizerou": "mlada-boleslav",
  "nymburk": "nymburk", "podebrady": "nymburk", "lysa-nad-labem": "nymburk",
  "brandys-nad-labem": "praha-vychod", "celakovice": "praha-vychod", "ricany": "praha-vychod",
  "cernosice": "praha-zapad", "ronov-nad-doubravou": "praha-zapad", "rudna": "praha-zapad", "hostivice": "praha-zapad",
  "pribram": "pribram", "dobris": "pribram", "sedlcany": "pribram",
  "rakovnik": "rakovnik", "novy-strasecí": "rakovnik",
  // Jihočeský
  "ceske-budejovice": "ceske-budejovice", "hluboka-nad-vltavou": "ceske-budejovice", "trhove-sviny": "ceske-budejovice",
  "cesky-krumlov": "cesky-krumlov", "kaplice": "cesky-krumlov",
  "jindrichuv-hradec": "jindrichuv-hradec", "trebon": "jindrichuv-hradec", "dacice": "jindrichuv-hradec",
  "pisek": "pisek", "milevsko": "pisek",
  "prachatice": "prachatice", "vimperk": "prachatice",
  "strakonice": "strakonice", "blatna": "strakonice",
  "tabor": "tabor", "sobeslav": "tabor", "veseli-nad-luznici": "tabor",
  // Plzeňský
  "domazlice": "domazlice", "horsovsky-tyn": "domazlice",
  "klatovy": "klatovy", "susice": "klatovy", "horazdovice": "klatovy",
  "plzen": "plzen-mesto",
  "stod": "plzen-jih", "prestice": "plzen-jih",
  "nyrany": "plzen-sever", "kralovice": "plzen-sever",
  "rokycany": "rokycany",
  "tachov": "tachov", "stribro": "tachov",
  // Karlovarský
  "cheb": "cheb", "marianske-lazne": "cheb", "frantiskovy-lazne": "cheb", "as": "cheb",
  "karlovy-vary": "karlovy-vary", "ostrov": "karlovy-vary", "nejdek": "karlovy-vary",
  "sokolov": "sokolov", "kraslice": "sokolov", "habartov": "sokolov",
  // Ústecký
  "decin": "decin", "rumburk": "decin", "varnsdorf": "decin",
  "chomutov": "chomutov", "jirkov": "chomutov", "kadan": "chomutov",
  "litomerice": "litomerice", "roudnice-nad-labem": "litomerice", "lovosice": "litomerice",
  "louny": "louny", "zatec": "louny", "podborany": "louny",
  "most": "most", "litvinov": "most",
  "teplice": "teplice", "duchcov": "teplice", "kr-recke-letovisko": "teplice",
  "usti-nad-labem": "usti-nad-labem",
  // Liberecký
  "ceska-lipa": "ceska-lipa", "novy-bor": "ceska-lipa", "doksy": "ceska-lipa",
  "jablonec-nad-nisou": "jablonec-nad-nisou", "tanvald": "jablonec-nad-nisou", "zelezny-brod": "jablonec-nad-nisou",
  "liberec": "liberec", "hradek-nad-nisou": "liberec",
  "semily": "semily", "turnov": "semily", "jilemnice": "semily",
  // Královéhradecký
  "hradec-kralove": "hradec-kralove",
  "jicin": "jicin", "hořice": "jicin", "novy-bydzov": "jicin", "novy-bydžov": "jicin",
  "nachod": "nachod", "broumov": "nachod", "ceska-skalice": "nachod", "jaromer": "nachod",
  "rychnov-nad-kneznou": "rychnov-nad-kneznou", "kostelec-nad-orlici": "rychnov-nad-kneznou",
  "trutnov": "trutnov", "vrchlabi": "trutnov", "dvur-kralove-nad-labem": "trutnov",
  // Pardubický
  "chrudim": "chrudim", "hlinsko": "chrudim", "skutec": "chrudim",
  "pardubice": "pardubice", "prelouc": "pardubice", "holice": "pardubice",
  "svitavy": "svitavy", "litomysl": "svitavy", "polic-ka": "svitavy", "policka": "svitavy",
  "usti-nad-orlici": "usti-nad-orlici", "vysoke-myto": "usti-nad-orlici", "ceska-trebova": "usti-nad-orlici", "lanskroun": "usti-nad-orlici",
  // Vysočina
  "havlickuv-brod": "havlickuv-brod", "chotebor": "havlickuv-brod", "svetla-nad-sazavou": "havlickuv-brod",
  "jihlava": "jihlava", "telc": "jihlava", "polna": "jihlava",
  "pelhrimov": "pelhrimov", "humpolec": "pelhrimov", "pacov": "pelhrimov",
  "trebic": "trebic", "moravske-budejovice": "trebic", "namest-nad-oslavou": "trebic",
  "zdar-nad-sazavou": "zdar-nad-sazavou", "bystrice-nad-pernstejnem": "zdar-nad-sazavou", "velke-mezirici": "zdar-nad-sazavou", "novemesto-na-morave": "zdar-nad-sazavou",
  // Jihomoravský
  "blansko": "blansko", "boskovice": "blansko", "letovice": "blansko", "adamov": "blansko",
  "brno": "brno-mesto",
  "kurim": "brno-venkov", "rajec-jestrebi": "brno-venkov", "ivancice": "brno-venkov", "tisnov": "brno-venkov", "rosice": "brno-venkov",
  "breclav": "breclav", "mikulov": "breclav", "podivin": "breclav", "hustopece": "breclav",
  "hodonin": "hodonin", "kyjov": "hodonin", "veseli-nad-moravou": "hodonin", "straznice": "hodonin",
  "vyskov": "vyskov", "buciovice": "vyskov", "slavkov-u-brna": "vyskov",
  "znojmo": "znojmo", "moravsky-krumlov": "znojmo",
  // Olomoucký
  "jesenik": "jesenik",
  "olomouc": "olomouc", "litovel": "olomouc", "unicov": "olomouc",
  "prerov": "prerov", "hranice": "prerov", "lipnik-nad-becvou": "prerov",
  "prostejov": "prostejov", "konice": "prostejov",
  "sumperk": "sumperk", "zabreh": "sumperk", "mohelnice": "sumperk",
  // Zlínský
  "kromeriz": "kromeriz", "hulin": "kromeriz", "holesov": "kromeriz",
  "uherske-hradiste": "uherske-hradiste", "uhersky-brod": "uherske-hradiste", "stare-mesto": "uherske-hradiste",
  "vsetin": "vsetin", "valasske-mezirici": "vsetin", "roznov-pod-radhostem": "vsetin",
  "zlin": "zlin", "otrokovice": "zlin", "napajedla": "zlin", "luhacovice": "zlin",
  // Moravskoslezský
  "bruntal": "bruntal", "krnov": "bruntal", "rymarov": "bruntal",
  "frydek-mistek": "frydek-mistek", "trinec": "frydek-mistek", "frydlant-nad-ostravici": "frydek-mistek",
  "karvina": "karvina", "havirov": "karvina", "orlova": "karvina", "cesky-tesin": "karvina", "bohumin": "karvina",
  "novy-jicin": "novy-jicin", "koprivnice": "novy-jicin", "stramberk": "novy-jicin", "pribor": "novy-jicin",
  "opava": "opava", "hlucin": "opava", "vitkov": "opava",
  "ostrava": "ostrava-mesto",
};

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyCity(s: string): string {
  return deaccent(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Z lokality string ("Beroun – Závodí", "obec Karlštejn, okres Beroun") → slug okresu
export function okresFromLocality(locality: string | undefined): string | null {
  if (!locality) return null;
  const norm = deaccent(locality.toLowerCase());

  // Praha
  if (/\bpraha\b/.test(norm)) return "praha";

  // Explicitní "okres X"
  const m = norm.match(/okres\s+([a-z\s-]+?)(?:[,;]|$)/);
  if (m) {
    const slug = slugifyCity(m[1].trim());
    if (OKRES_BY_SLUG[slug]) return slug;
  }

  // City lookup — vyzkoušíme všechny segmenty oddělené čárkou / pomlčkou / mezerou
  const tokens = norm
    .split(/[,;–—\-/()]/g)
    .map(t => slugifyCity(t.trim()))
    .filter(Boolean);
  for (const t of tokens) {
    if (CITY_TO_OKRES[t]) return CITY_TO_OKRES[t];
  }
  // Multi-word "kutna hora"
  const joined = slugifyCity(norm);
  for (const key of Object.keys(CITY_TO_OKRES)) {
    if (joined.includes(key)) return CITY_TO_OKRES[key];
  }
  return null;
}
