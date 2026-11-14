import crypto from 'crypto';

// Crockford Base32 alphabet: excludes 0, O, 1, I, L to prevent misreading
const CROCKFORD_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Returns a cryptographically random Crockford Base32 string of length n.
 */
export function generateCrockfordBlock(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CROCKFORD_CHARS[bytes[i] % CROCKFORD_CHARS.length];
  }
  return result;
}

/**
 * Generates a boarding-pass-style Registration Reference: YYMM-XXXX-XX
 * Example: 2611-8K4M-92
 */
export function generateRegistrationCode(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const part1 = generateCrockfordBlock(4);
  const part2 = generateCrockfordBlock(2);
  return `${yy}${mm}-${part1}-${part2}`;
}

/**
 * Derives a 3 to 4 character uppercase event prefix from event title.
 * e.g., "Software Engineering Summit" -> "SES" or "SESU"
 * "Test Event" -> "TEV"
 */
export function deriveEventPrefix(title?: string): string {
  if (!title || !title.trim()) return 'EVT';
  const words = title
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 3) {
    const letters = words
      .slice(0, 4)
      .map((w) => w[0].toUpperCase())
      .join('');
    return letters.slice(0, 4);
  }

  // 1 or 2 words: strip vowels if too short, or take first 3-4 chars
  const clean = words.join('').toUpperCase();
  const filtered = clean.replace(/[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g, 'X');
  if (filtered.length >= 3) {
    return filtered.slice(0, Math.min(4, Math.max(3, filtered.length)));
  }
  return 'EVT';
}

/**
 * Generates a boarding-pass-style Ticket Pass Code: EVT-XXX-XXX
 * Example: ICN-9X7-P4W
 */
export function generateTicketCode(eventTitle?: string): string {
  const prefix = deriveEventPrefix(eventTitle);
  const block1 = generateCrockfordBlock(3);
  const block2 = generateCrockfordBlock(3);
  return `${prefix}-${block1}-${block2}`;
}

/**
 * Normalizes user input in manual lookup: uppercase, removes all whitespace and hyphens.
 * E.g., "icn-9x7-p4w" -> "ICN9X7P4W"
 */
export function normalizeCodeForComparison(input: string): string {
  return input.toUpperCase().replace(/[\s\-_]/g, '');
}
