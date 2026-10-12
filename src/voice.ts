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
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');
  const name = normalize(transcript).replace(/^(pay\s+(?:to\s+)?|to\s+)/, '');
  const matches = contacts.filter(contact => normalize(contact.name) === name);
  return matches.length === 1 ? matches[0] : null;
}
