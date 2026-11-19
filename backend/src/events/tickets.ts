import { randomBytes } from 'node:crypto';
import { toBuffer, toDataURL } from 'qrcode';

/** Long random secret used in the ticket link and QR code. */
export const newTicketCode = () => randomBytes(32).toString('base64url');

export const ticketUrl = (site: string, code: string) =>
  `${site}/tickets/${code}`;

const QR = { width: 360, margin: 2, errorCorrectionLevel: 'M' as const };

/** QR image (PNG) of the ticket link, for email attachments. */
export const qrPng = (url: string) => toBuffer(url, { ...QR, type: 'png' });

/** QR image as a data URL, for the ticket web page. */
export const qrDataUrl = (url: string) => toDataURL(url, QR);

/** Accept either a bare code or a full ticket link (what the QR contains). */
export function codeFrom(input: string): string {
  const trimmed = input.trim();
  const m = /\/tickets\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(trimmed);
  return m ? m[1] : trimmed;
}
