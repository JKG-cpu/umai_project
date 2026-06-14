const PRICE_PATTERN = /^[\$€£¥]?\d+[.,]\d{2}$/;
const QUANTITY_PATTERN = /^\d+x$/i;
const DATE_PATTERN = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/;
const TIME_PATTERN = /^\d{1,2}:\d{2}/;
const NUMBER_ONLY_PATTERN = /^\d+$/;
const TAX_ID_PATTERN = /^(vat|iva|cod\.?\s*fisc|p\.?\s*iva|cf|partita\s*iva)/i;

const SKIP_WORDS = new Set([
  "TOTAL",
  "SUBTOTAL",
  "TAX",
  "VAT",
  "IVA",
  "CASH",
  "CHANGE",
  "CREDIT",
  "DEBIT",
  "MASTERCARD",
  "VISA",
  "AMEX",
  "CARD",
  "CONTANTI",
  "BANCOMAT",
  "EURO",
  "EUR",
  "SALDO",
  "SCONTO",
  "ARR",
  "QTY",
  "QT",
  "KG",
  "G",
  "L",
  "ML",
  "PZ",
  "CAD",
  "PIECE",
  "PCS",
  "THANK",
  "THANKS",
  "YOU",
  "YOUR",
  "WELCOME",
  "STORE",
  "RECEIPT",
  "FATTURA",
  "RICEVUTA",
  "SCONTRINO",
  "TICKET",
  "NUM",
  "N.",
  "CLIENTE",
  "OPERATORE",
  "CASSA",
  "BANCA",
  "TOTALE",
  "TOTALI",
  "IMPORTO",
  "ACCONTO",
  "RESTO",
]);

export function filterItemTokens(ocrText: string): string[] {
  const words = ocrText.split(/[\s\n\r]+/).filter(Boolean);

  const candidates: string[] = [];

  for (const word of words) {
    const trimmed = word.trim();

    if (trimmed.length < 2) continue;
    if (SKIP_WORDS.has(trimmed.toUpperCase())) continue;
    if (PRICE_PATTERN.test(trimmed)) continue;
    if (QUANTITY_PATTERN.test(trimmed)) continue;
    if (DATE_PATTERN.test(trimmed)) continue;
    if (TIME_PATTERN.test(trimmed)) continue;
    if (NUMBER_ONLY_PATTERN.test(trimmed)) continue;
    if (TAX_ID_PATTERN.test(trimmed)) continue;
    if (/^[A-Z]{6,12}$/.test(trimmed.toUpperCase())) {
      candidates.push(trimmed.toUpperCase());
      continue;
    }
    if (/[A-Z]{2,}/.test(trimmed.toUpperCase())) {
      candidates.push(trimmed.toUpperCase());
    }
  }

  const seen = new Set<string>();
  return candidates.filter((t) => {
    const key = t.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
