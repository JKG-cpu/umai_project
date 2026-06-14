const CHAIN_PATTERNS: Array<{
  patterns: RegExp[];
  chain: string;
}> = [
  {
    patterns: [/^lidl/i, /\blidl\b/i],
    chain: "lidl",
  },
  {
    patterns: [/^walmart/i, /\bwalmart\b/i],
    chain: "walmart",
  },
  {
    patterns: [/^carrefour/i, /\bcarrefour\b/i],
    chain: "carrefour",
  },
  {
    patterns: [/^tesco/i, /\btesco\b/i],
    chain: "tesco",
  },
  {
    patterns: [/^aldi/i, /\baldi\b/i],
    chain: "aldi",
  },
  {
    patterns: [/^coop/i, /\bcoop\b/i],
    chain: "coop",
  },
  {
    patterns: [/^esselunga/i, /\besselunga\b/i],
    chain: "esselunga",
  },
  {
    patterns: [/^conad/i, /\bconad\b/i],
    chain: "conad",
  },
  {
    patterns: [/^eurospin/i, /\beurospin\b/i],
    chain: "eurospin",
  },
  {
    patterns: [/^costco/i, /\bcostco\b/i],
    chain: "costco",
  },
  {
    patterns: [/^kroger/i, /\bkroger\b/i],
    chain: "kroger",
  },
  {
    patterns: [/^target/i, /\btarget\b/i],
    chain: "target",
  },
  {
    patterns: [/^safeway/i, /\bsafeway\b/i],
    chain: "safeway",
  },
  {
    patterns: [/^whole foods/i, /\bwhole foods?\b/i],
    chain: "whole-foods",
  },
  {
    patterns: [/^trader joe/i, /\btrader\s?joe['']?s?\b/i],
    chain: "trader-joes",
  },
  {
    patterns: [/^publix/i, /\bpublix\b/i],
    chain: "publix",
  },
  {
    patterns: [/^wegmans/i, /\bwegmans\b/i],
    chain: "wegmans",
  },
  {
    patterns: [/^dollar\s?general/i, /\bdollar\s?general\b/i],
    chain: "dollar-general",
  },
  {
    patterns: [/^kmart/i, /\bkmart\b/i],
    chain: "kmart",
  },
  {
    patterns: [/^morrisons/i, /\bmorrisons\b/i],
    chain: "morrisons",
  },
  {
    patterns: [/^asda/i, /\basda\b/i],
    chain: "asda",
  },
  {
    patterns: [/^sainsbury/i, /\bsainsbury['']?s?\b/i],
    chain: "sainsburys",
  },
  {
    patterns: [/^waitrose/i, /\bwaitrose\b/i],
    chain: "waitrose",
  },
  {
    patterns: [/^monoprix/i, /\bmonoprix\b/i],
    chain: "monoprix",
  },
];

const LOCALE_HINTS: Record<string, string> = {
  lidl: "de",
  walmart: "us",
  carrefour: "fr",
  tesco: "gb",
  aldi: "de",
  coop: "it",
  esselunga: "it",
  conad: "it",
  eurospin: "it",
  costco: "us",
  kroger: "us",
  target: "us",
  safeway: "us",
  "whole-foods": "us",
  "trader-joes": "us",
  publix: "us",
  wegmans: "us",
  morrisons: "gb",
  asda: "gb",
  sainsburys: "gb",
  waitrose: "gb",
  monoprix: "fr",
};

export type StoreResult = {
  storeId: string | null;
  chain: string | null;
  locale: string;
};

export function detectStore(ocrLines: string[]): StoreResult {
  if (!ocrLines || ocrLines.length === 0) {
    return { storeId: null, chain: null, locale: "us" };
  }

  const headerLines = ocrLines.slice(0, 5).join("\n");

  for (const entry of CHAIN_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(headerLines)) {
        const locale = LOCALE_HINTS[entry.chain] ?? "us";
        return {
          storeId: `${entry.chain}-${locale}`,
          chain: entry.chain,
          locale,
        };
      }
    }
  }

  return { storeId: null, chain: null, locale: "us" };
}
