import crypto from 'crypto';
import QRCode from 'qrcode';

export interface GeneratedToken {
  plainToken: string;
  tokenHash: string;
}

/**
 * Generates a cryptographically strong opaque token (64 hex characters)
 * and its SHA-256 hash for secure storage.
 */
export function generateSecureToken(): GeneratedToken {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(plainToken);
  return { plainToken, tokenHash };
}

/**
 * Computes SHA-256 hash of a presented token.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generates an ISO/IEC 18004 compliant QR Code Data URL.
 * The payload contains ONLY the ticket_code string (never embed personal attendee data).
 */
export async function generateQrDataUrl(ticketCode: string): Promise<string> {
  return QRCode.toDataURL(ticketCode.trim(), {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
