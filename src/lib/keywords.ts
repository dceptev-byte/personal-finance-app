/**
 * Extracts a normalised, human-meaningful keyword from a raw bank transaction
 * description so it can be stored in the categoryMappings table.
 *
 * Examples:
 *   "UPI/P2M/609011529203/DAVID S/UPI/State Bank Of India" → "david s"
 *   "SWIGGY ORDER 123456789"                               → "swiggy"
 *   "NEFT/HDFC0001234/NETFLIX"                             → "netflix"
 *   "ATM/WDL/000123/SBI ATM CHENNAI"                       → "sbi atm chennai"
 */

// Tokens to strip outright — UPI prefixes, transfer type codes, bank names etc.
const STRIP_PATTERNS = [
  /\bUPI\b/gi,
  /\bP2M\b/gi,
  /\bP2P\b/gi,
  /\bNEFT\b/gi,
  /\bIMPS\b/gi,
  /\bRTGS\b/gi,
  /\bACH\b/gi,
  /\bECS\b/gi,
  /\bEMI\b/gi,
  /\bATM\b/gi,
  /\bWDL\b/gi,
  /\bPOS\b/gi,
  /\bBILL\b/gi,
  /\bINB\b/gi,
  /\bMB\b/gi,
  /\bONLINE\b/gi,
  /\bPAYMENT\b/gi,
  /\bPAYMENTS\b/gi,
  /\bTRANSFER\b/gi,
  /\bTXN\b/gi,
  /\bRef\b/gi,
  /State Bank Of India/gi,
  /Axis Bank/gi,
  /HDFC Bank/gi,
  /ICICI Bank/gi,
  /Kotak Bank/gi,
  /Bank Of Baroda/gi,
  /Punjab National Bank/gi,
];

// Branch/IFSC codes: all-caps 4-letter prefix + digits e.g. HDFC0001234, UTIB0000001
const IFSC_RE = /\b[A-Z]{4}0\d{6}\b/g;
// Pure numbers or short IDs (6+ digits)
const NUMBER_RE = /\b\d{4,}\b/g;
// Slash-delimited segments we want to split on
const SLASH_RE = /\//g;

export function extractKeyword(description: string): string {
  let s = description;

  // Replace slashes with spaces so segments can be individually evaluated
  s = s.replace(SLASH_RE, " ");

  // Remove IFSC codes
  s = s.replace(IFSC_RE, " ");

  // Strip bank/transfer jargon
  for (const pat of STRIP_PATTERNS) {
    s = s.replace(pat, " ");
  }

  // Remove long numbers (transaction/reference IDs)
  s = s.replace(NUMBER_RE, " ");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // Take first 4 meaningful words (drop single-char tokens)
  const words = s.split(" ").filter(w => w.length > 1);
  const keyword = words.slice(0, 4).join(" ").toLowerCase().trim();

  return keyword;
}

/**
 * Returns true if the keyword is too generic to be a useful mapping
 * (e.g. just "bank", "transfer", or empty).
 */
export function isKeywordUseful(keyword: string): boolean {
  if (!keyword || keyword.length < 3) return false;
  const useless = new Set(["bank", "transfer", "payment", "online", "atm", "upi", "cash", "debit", "credit"]);
  return !useless.has(keyword);
}
