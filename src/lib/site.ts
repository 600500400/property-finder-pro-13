/** Public operator data verified against ARES, IČO 88549836. No VAT claim is inferred. */
export const SITE_URL = "https://www.realityscanner.cz";
export const OPERATOR = {
  name: "Ing. Kamil Němec",
  ico: "88549836",
  street: "Javorová 266/4",
  city: "Zlonín",
  postalCode: "250 64",
  address: "Javorová 266/4, 250 64 Zlonín",
  email: "kamelpost@gmail.com",
  registerUrl: "https://ares.gov.cz/ekonomicke-subjekty/res/88549836",
} as const;

export function publicPageHead(path: string, title: string, description: string) {
  return {
    meta: [
      { title: title + " | RealityScanner" },
      { name: "description", content: description },
      { property: "og:title", content: title + " | RealityScanner" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL + path },
      { name: "twitter:title", content: title + " | RealityScanner" },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: SITE_URL + path }],
  };
}
