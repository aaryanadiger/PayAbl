import type { Recipient } from './payment';

const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000 };

export function spokenAmount(transcript: string): string | null {
  const text = transcript.toLowerCase().trim().replace(/[.!?]$/, '').replace(/^₹\s*/, '').replace(/\s+rupees?$/, '').replace(/-/g, ' ');
  // Only accept the entire utterance, never extract a plausible number from unrelated speech.
  if (/^-/.test(transcript.trim()) || /\b(minus|negative|point|paise|paisa)\b/.test(text)) return null;
  let value: number;
  if (/^\d[\d,\s]*$/.test(text)) value = Number(text.replace(/[,\s]/g, ''));
  else {
    const words = text.split(/\s+/).filter(word => word !== 'and');
    if (!words.length || words.some(word => !(word in SMALL) && !(word in SCALE))) return null;
    if (words.every(word => word in SMALL && SMALL[word] < 10)) value = Number(words.map(word => SMALL[word]).join(''));
    else {
      let total = 0, part = 0, previousScale = Infinity, previousSmall: number | null = null;
      for (const word of words) {
        if (word in SMALL) {
          const small = SMALL[word];
          if (previousSmall !== null && !(previousSmall >= 20 && previousSmall % 10 === 0 && small > 0 && small < 10)) return null;
          part += small; previousSmall = small; continue;
        }
        const scale = SCALE[word];
        if (!part || (scale !== 100 && scale >= previousScale)) return null;
        if (scale === 100) { if (part >= 10) return null; part *= 100; }
        else { total += part * scale; part = 0; previousScale = scale; }
        previousSmall = null;
      }
      value = total + part;
    }
  }
  return Number.isInteger(value) && value >= 1 && value <= 100000 ? String(value) : null;
}

export function spokenContact(transcript: string, contacts: Recipient[]): Recipient | null {
  const matches = matchingContacts(transcript, contacts);
  return matches.length === 1 ? matches[0] : null;
}

function normalizeName(text: string) {
  return text.toLocaleLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ');
}

export function matchingContacts(transcript: string, contacts: Recipient[]): Recipient[] {
  const name = normalizeName(transcript).replace(/^(send money to\s+|pay\s+(?:to\s+)?|to\s+)/, '');
  return name ? contacts.filter(contact => normalizeName(contact.name) === name) : [];
}

export type VoiceIntent =
  | { type: 'scan' | 'contacts' | 'repeat' | 'stop' | 'back' | 'help' | 'unknown' }
  | { type: 'recipient'; name: string };

// Match whole commands. Never extract an action from an unrelated utterance,
// and deliberately provide no payment-confirmation or authentication intent.
export function voiceIntent(transcript: string): VoiceIntent {
  const text = transcript.trim().replace(/[.!?]+$/, '').toLocaleLowerCase().replace(/\s+/g, ' ').replace(/^please /, '').replace(/ please$/, '');
  if (/^(scan qr|scan qr code|scan a qr code|scan code|open scanner|open qr scanner|scan a code)$/.test(text)) return { type: 'scan' };
  if (/^(pay contacts|pay to contacts|pay contact|pay to contact|pay my contacts|pay family|choose contact|choose a contact|choose recipient|contacts|open contacts|show contacts|send money to contacts|send money to a contact|pay someone)$/.test(text)) return { type: 'contacts' };
  if (/^(repeat|repeat that|say that again|repeat again)$/.test(text)) return { type: 'repeat' };
  if (/^(stop|stop speaking|stop talking|be quiet)$/.test(text)) return { type: 'stop' };
  if (/^(back|go back|previous screen)$/.test(text)) return { type: 'back' };
  if (/^(help|help me|instructions|what can i say)$/.test(text)) return { type: 'help' };
  const recipient = /^(?:send money to|pay(?: to)?) (.+)$/.exec(text);
  if (recipient) return { type: 'recipient', name: recipient[1] };
  return { type: 'unknown' };
}

export function contactChoice(transcript: string, count: number): number | null {
  const text = transcript.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(option|choose|number)\s+/, '');
  const value = /^\d+$/.test(text) ? Number(text) : SMALL[text];
  return Number.isInteger(value) && value >= 1 && value <= count ? value - 1 : null;
}

export function recipientIdentity(recipient: Recipient): string {
  return recipient.phone ? `${recipient.name}, phone ${recipient.phone.split('').join(' ')}` : `${recipient.name}, UPI ID ${recipient.upi}`;
}

// Approximate names are suggestions only, never automatic recipient selections.
export function suggestedContacts(transcript: string, contacts: Recipient[]): Recipient[] {
  const name = normalizeName(transcript);
  if (name.length < 3 || name.length > 80) return [];
  const distance = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 2) return Infinity;
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
      row = next;
    }
    return row[b.length];
  };
  return contacts.filter(contact => {
    const candidate = normalizeName(contact.name);
    const parts = candidate.split(' ');
    if (parts.includes(name)) return true;
    return [candidate, ...parts].some(part => part.length >= 3 && distance(name, part) <= (Math.max(name.length, part.length) >= 6 ? 2 : 1));
  });
}
