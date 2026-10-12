import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spokenAmount, spokenContact } from '../src/voice.ts';
import { CONTACTS } from '../src/payment.ts';

test('voice amounts accept whole rupees, digit dictation, and Indian units', () => {
  for (const [speech, amount] of [['250 rupees', '250'], ['two hundred and fifty', '250'], ['2 5 0', '250'], ['two five zero', '250'], ['one thousand two hundred fifty', '1250'], ['one lakh', '100000']]) assert.equal(spokenAmount(speech), amount);
});
test('voice amounts reject ambiguous, fractional, negative, unrelated, and oversized input', () => {
  for (const speech of ['zero', '-250', 'minus two hundred', '1.5 rupees', 'one point five', 'twenty twenty', 'one hundred hundred', 'send dad 250', 'two lakh', '', 'one thousand thousand']) assert.equal(spokenAmount(speech), null, speech);
});
test('voice contact selection requires one exact name', () => {
  assert.equal(spokenContact('Pay Dad.', CONTACTS)?.name, 'Dad');
  assert.equal(spokenContact('corner store', CONTACTS)?.name, 'Corner Store');
  assert.equal(spokenContact('Dan', CONTACTS), null);
  assert.equal(spokenContact('Dad', [...CONTACTS, { name: 'Dad', upi: 'other@demo' }]), null);
});
