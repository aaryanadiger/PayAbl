export type Recipient = { name: string; upi: string; demo?: boolean };
export type Receipt = { id: string; recipient: Recipient; amount: string; time: string };
export const CONTACTS: Recipient[] = [
  { name: 'Ananya', upi: 'ananya@demo', demo: true },
  { name: 'Corner Store', upi: 'cornerstore@demo', demo: true },
  { name: 'Dad', upi: 'dad@demo', demo: true },
];
export function parsePaymentQR(raw: string): { recipient: Recipient; amount: string } {
  if (raw.length > 2048) throw new Error('This QR code is too large. Try a UPI payment QR.');
  // React Native's built-in URL hostname parser only supports http(s).
  // Parse this narrow custom-scheme grammar consistently on native and web.
  const match = /^upi:\/\/pay\/?\?([^#\s]+)$/i.exec(raw);
  if (!match)
    throw new Error('This is not a UPI payment QR. No links will be opened.');
  const params = new Map<string, string>();
  for (const pair of match[1].split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 0) throw new Error('The QR contains malformed payment details.');
    let key: string, value: string;
    try {
      key = decodeURIComponent(pair.slice(0, separator).replace(/\+/g, ' '));
      value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '));
    } catch { throw new Error('The QR contains invalid encoded text.'); }
    if (params.has(key)) throw new Error('The QR contains duplicate payment details.');
    params.set(key, value);
  }
  const upi = params.get('pa') || '';
  if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upi)) throw new Error('The QR has an invalid UPI ID.');
  const currency = params.get('cu');
  if (currency && currency !== 'INR') throw new Error('Only Indian rupees are supported in this demo.');
  const name = (params.get('pn') || 'Unknown recipient').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 60);
  const requested = params.get('am');
  if (requested && (!/^\d+(\.\d{1,2})?$/.test(requested) || !Number.isSafeInteger(Number(requested) * 100) || Number(requested) <= 0 || Number(requested) > 100000))
    throw new Error('The QR contains an unsupported amount.');
  if (requested && !Number.isInteger(Number(requested))) throw new Error('This prototype supports whole rupees only. Try a QR without paise.');
  return { recipient: { name: name || 'Unknown recipient', upi }, amount: requested ? String(Number(requested)) : '' };
}
export function appendDigit(value: string, key: string) {
  if (!/^\d$/.test(key) || value.length >= 6) return value;
  const next = value === '0' ? key : value + key;
  return Number(next) <= 100000 ? next : value;
}
export function validAmount(value: string) { return /^\d{1,6}$/.test(value) && Number(value) > 0 && Number(value) <= 100000; }
export function rupees(value: string) { return `₹${Number(value || 0).toLocaleString('en-IN')}`; }
