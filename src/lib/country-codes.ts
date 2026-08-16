/**
 * Country-code normalisation for the `reviews.country` column, which is
 * `char(2)` (ISO 3166-1 alpha-2).
 *
 * Upstreams disagree about the shape:
 *   - Google Play / iTunes RSS  → alpha-2 ("in", "us")
 *   - App Store Connect         → alpha-3 ("IND", "USA") in `territory`
 *   - AppFollow CSV export      → free text ("United States", "en-US")
 *
 * Writing a 3-char or longer value into char(2) raises Postgres 22001 and
 * fails the WHOLE insert batch, not just the offending row — so an App Store
 * Connect app or a CSV import would break sync entirely rather than lose one
 * field. Everything funnels through toAlpha2() so that cannot happen.
 */

/** ISO 3166-1 alpha-3 → alpha-2. Used for App Store Connect territory codes. */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  ABW:"AW",AFG:"AF",AGO:"AO",AIA:"AI",ALA:"AX",ALB:"AL",AND:"AD",ARE:"AE",ARG:"AR",ARM:"AM",
  ASM:"AS",ATA:"AQ",ATF:"TF",ATG:"AG",AUS:"AU",AUT:"AT",AZE:"AZ",BDI:"BI",BEL:"BE",BEN:"BJ",
  BES:"BQ",BFA:"BF",BGD:"BD",BGR:"BG",BHR:"BH",BHS:"BS",BIH:"BA",BLM:"BL",BLR:"BY",BLZ:"BZ",
  BMU:"BM",BOL:"BO",BRA:"BR",BRB:"BB",BRN:"BN",BTN:"BT",BVT:"BV",BWA:"BW",CAF:"CF",CAN:"CA",
  CCK:"CC",CHE:"CH",CHL:"CL",CHN:"CN",CIV:"CI",CMR:"CM",COD:"CD",COG:"CG",COK:"CK",COL:"CO",
  COM:"KM",CPV:"CV",CRI:"CR",CUB:"CU",CUW:"CW",CXR:"CX",CYM:"KY",CYP:"CY",CZE:"CZ",DEU:"DE",
  DJI:"DJ",DMA:"DM",DNK:"DK",DOM:"DO",DZA:"DZ",ECU:"EC",EGY:"EG",ERI:"ER",ESH:"EH",ESP:"ES",
  EST:"EE",ETH:"ET",FIN:"FI",FJI:"FJ",FLK:"FK",FRA:"FR",FRO:"FO",FSM:"FM",GAB:"GA",GBR:"GB",
  GEO:"GE",GGY:"GG",GHA:"GH",GIB:"GI",GIN:"GN",GLP:"GP",GMB:"GM",GNB:"GW",GNQ:"GQ",GRC:"GR",
  GRD:"GD",GRL:"GL",GTM:"GT",GUF:"GF",GUM:"GU",GUY:"GY",HKG:"HK",HMD:"HM",HND:"HN",HRV:"HR",
  HTI:"HT",HUN:"HU",IDN:"ID",IMN:"IM",IND:"IN",IOT:"IO",IRL:"IE",IRN:"IR",IRQ:"IQ",ISL:"IS",
  ISR:"IL",ITA:"IT",JAM:"JM",JEY:"JE",JOR:"JO",JPN:"JP",KAZ:"KZ",KEN:"KE",KGZ:"KG",KHM:"KH",
  KIR:"KI",KNA:"KN",KOR:"KR",KWT:"KW",LAO:"LA",LBN:"LB",LBR:"LR",LBY:"LY",LCA:"LC",LIE:"LI",
  LKA:"LK",LSO:"LS",LTU:"LT",LUX:"LU",LVA:"LV",MAC:"MO",MAF:"MF",MAR:"MA",MCO:"MC",MDA:"MD",
  MDG:"MG",MDV:"MV",MEX:"MX",MHL:"MH",MKD:"MK",MLI:"ML",MLT:"MT",MMR:"MM",MNE:"ME",MNG:"MN",
  MNP:"MP",MOZ:"MZ",MRT:"MR",MSR:"MS",MTQ:"MQ",MUS:"MU",MWI:"MW",MYS:"MY",MYT:"YT",NAM:"NA",
  NCL:"NC",NER:"NE",NFK:"NF",NGA:"NG",NIC:"NI",NIU:"NU",NLD:"NL",NOR:"NO",NPL:"NP",NRU:"NR",
  NZL:"NZ",OMN:"OM",PAK:"PK",PAN:"PA",PCN:"PN",PER:"PE",PHL:"PH",PLW:"PW",PNG:"PG",POL:"PL",
  PRI:"PR",PRK:"KP",PRT:"PT",PRY:"PY",PSE:"PS",PYF:"PF",QAT:"QA",REU:"RE",ROU:"RO",RUS:"RU",
  RWA:"RW",SAU:"SA",SDN:"SD",SEN:"SN",SGP:"SG",SGS:"GS",SHN:"SH",SJM:"SJ",SLB:"SB",SLE:"SL",
  SLV:"SV",SMR:"SM",SOM:"SO",SPM:"PM",SRB:"RS",SSD:"SS",STP:"ST",SUR:"SR",SVK:"SK",SVN:"SI",
  SWE:"SE",SWZ:"SZ",SXM:"SX",SYC:"SC",SYR:"SY",TCA:"TC",TCD:"TD",TGO:"TG",THA:"TH",TJK:"TJ",
  TKL:"TK",TKM:"TM",TLS:"TL",TON:"TO",TTO:"TT",TUN:"TN",TUR:"TR",TUV:"TV",TWN:"TW",TZA:"TZ",
  UGA:"UG",UKR:"UA",UMI:"UM",URY:"UY",USA:"US",UZB:"UZ",VAT:"VA",VCT:"VC",VEN:"VE",VGB:"VG",
  VIR:"VI",VNM:"VN",VUT:"VU",WLF:"WF",WSM:"WS",YEM:"YE",ZAF:"ZA",ZMB:"ZM",ZWE:"ZW",
};

/** Common full country names seen in AppFollow CSV exports. */
const NAME_TO_ALPHA2: Record<string, string> = {
  "united states": "US", "united kingdom": "GB", "great britain": "GB",
  "india": "IN", "canada": "CA", "australia": "AU", "germany": "DE",
  "france": "FR", "spain": "ES", "italy": "IT", "netherlands": "NL",
  "brazil": "BR", "mexico": "MX", "japan": "JP", "china": "CN",
  "south korea": "KR", "korea": "KR", "russia": "RU", "indonesia": "ID",
  "singapore": "SG", "malaysia": "MY", "philippines": "PH", "vietnam": "VN",
  "thailand": "TH", "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK",
  "nepal": "NP", "south africa": "ZA", "nigeria": "NG", "kenya": "KE",
  "egypt": "EG", "turkey": "TR", "poland": "PL", "sweden": "SE",
  "norway": "NO", "denmark": "DK", "finland": "FI", "ireland": "IE",
  "new zealand": "NZ", "switzerland": "CH", "austria": "AT", "belgium": "BE",
  "portugal": "PT", "greece": "GR", "israel": "IL", "saudi arabia": "SA",
  "united arab emirates": "AE", "argentina": "AR", "chile": "CL", "colombia": "CO",
};

/**
 * Coerce any upstream country/territory value into an ISO 3166-1 alpha-2 code,
 * or null when it cannot be resolved. Never returns a string longer than 2
 * characters, so the value is always safe for `reviews.country char(2)`.
 *
 * Handles: alpha-2 ("in"), alpha-3 ("IND"), BCP 47 locales ("en-IN"), and
 * common English country names ("India").
 */
export function toAlpha2(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // "en-IN" / "en_IN" → take the region subtag.
  const localeMatch = /^[a-z]{2,3}[-_]([A-Za-z]{2})$/.exec(trimmed);
  if (localeMatch) return localeMatch[1].toUpperCase();

  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (/^[A-Z]{3}$/.test(upper)) return ALPHA3_TO_ALPHA2[upper] ?? null;

  return NAME_TO_ALPHA2[trimmed.toLowerCase()] ?? null;
}
