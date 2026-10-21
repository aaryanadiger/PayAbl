import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { appendDigit, parsePaymentQR, validAmount } from '../src/payment.ts';
import { canHoldToAsk, contactKeyIndex, demoTapCount, HOLD_TO_ASK_MS } from '../src/keypad.ts';

test('microphone hold shortcut is restricted to contacts, amount and review', () => {
  for (const screen of ['contacts', 'amount', 'review']) assert.equal(canHoldToAsk(screen), true);
  for (const screen of ['pin', 'home', 'success', 'scan', 'unknown']) assert.equal(canHoldToAsk(screen), false);
  assert.equal(HOLD_TO_ASK_MS, 700);
});

test('stencil number keys select only valid contacts on the current page', () => {
  assert.equal(contactKeyIndex('1', 0, 12), 0);
  assert.equal(contactKeyIndex('9', 0, 12), 8);
  assert.equal(contactKeyIndex('1', 1, 12), 9);
  assert.equal(contactKeyIndex('3', 1, 12), 11);
  for (const key of ['0', '4', '10', 'delete', 'confirm']) assert.equal(contactKeyIndex(key, 1, 12), null);
  assert.equal(contactKeyIndex('1', 0, 0), null);
});

test('demo practice retains only a bounded count and supports deletion and reset', () => {
  let count = 0;
  for (let i = 0; i < 10; i++) count = demoTapCount(count, 'tap');
  assert.equal(count, 4);
  assert.equal(demoTapCount(count, 'delete'), 3);
  assert.equal(demoTapCount(0, 'delete'), 0);
  assert.equal(demoTapCount(count, 'reset'), 0);
});
test('UPI QR parses encoded recipient and amount', () => {
  assert.deepEqual(parsePaymentQR('upi://pay?pa=shop@bank&pn=Corner%20Store&am=250.00&cu=INR'), { recipient: { name: 'Corner Store', upi: 'shop@bank' }, amount: '250' });
});
test('unsafe links and invalid payment data are rejected', () => {
  for (const qr of ['https://example.com', 'upi://collect?pa=a@bank', 'upi://pay?pa=bad', 'upi://pay?pa=shop@bank&am=-1', 'upi://pay?pa=shop@bank&am=Infinity', 'upi://pay?pa=shop@bank&am=100001', 'upi://pay?pa=shop@bank&am=1.50', 'upi://pay?pa=shop@bank&cu=USD']) assert.throws(() => parsePaymentQR(qr));
});
test('amount entry rejects zero, overflow and non-digits', () => {
  assert.equal(validAmount('0'), false); assert.equal(validAmount('100000'), true);
  assert.equal(validAmount('100001'), false); assert.equal(validAmount('1e3'), false);
  assert.equal(appendDigit('10000', '1'), '10000'); assert.equal(appendDigit('0', '5'), '5');
  assert.equal(appendDigit('50', '.'), '50');
});
test('native QR parsing does not rely on the partial React Native URL implementation', () => {
  const original = globalThis.URL;
  try {
    globalThis.URL = class { constructor() { throw new Error('Unavailable URL parser'); } } as unknown as typeof URL;
    assert.equal(parsePaymentQR('upi://pay?pa=shop@bank&pn=My+Shop').recipient.name, 'My Shop');
  } finally { globalThis.URL = original; }
});
test('duplicate fields, fragments and malformed encoded text are rejected', () => {
  for (const qr of ['upi://pay?pa=shop@bank&pa=other@bank', 'upi://pay?pa=shop@bank&pn=%ZZ', 'upi://pay?pa=shop@bank#fragment', 'upi://pay?pa=shop@bank&missing']) assert.throws(() => parsePaymentQR(qr));
});
