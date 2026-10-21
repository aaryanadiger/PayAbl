import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactChoice, matchingContacts, suggestedContacts, recipientIdentity, spokenAmount, spokenContact, voiceIntent } from '../src/voice.ts';
import { CONTACTS } from '../src/payment.ts';

test('voice amounts accept whole rupees, digit dictation, and Indian units', () => {
  for (const [speech, amount] of [['250 rupees', '250'], ['two hundred and fifty', '250'], ['2 5 0', '250'], ['two five zero', '250'], ['one thousand two hundred fifty', '1250'], ['one lakh', '100000']]) assert.equal(spokenAmount(speech), amount);
});

test('assistant supports only whole deterministic commands', () => {
  for (const [input, type] of [['Scan QR', 'scan'], ['Scan QR code.', 'scan'], ['Pay contacts', 'contacts'], ['Pay family', 'contacts'], ['Repeat that', 'repeat'], ['Stop speaking', 'stop'], ['Go back', 'back'], ['Help', 'help']]) {
    assert.equal(voiceIntent(input).type, type);
  }
  assert.deepEqual(voiceIntent('Send money to Rahul'), { type: 'recipient', name: 'rahul' });
  assert.deepEqual(voiceIntent('Pay to माँ'), { type: 'recipient', name: 'माँ' });
  for (const input of ['confirm', 'yes', 'confirm payment', 'enter PIN', '1234', 'scan qr and pay', 'help then confirm', 'please go back and pay', '']) {
    assert.equal(voiceIntent(input).type, 'unknown', input);
  }
});

test('duplicate names return every candidate and require an explicit valid option', () => {
  const contacts = [{ name: 'Rahul', upi: '', phone: '1111111111' }, { name: 'Rahul', upi: '', phone: '2222222222' }, { name: 'Rahul Sharma', upi: 'rahul@demo' }];
  assert.deepEqual(matchingContacts('Rahul', contacts), contacts.slice(0, 2));
  assert.equal(spokenContact('Rahul', contacts), null);
  assert.equal(matchingContacts('Rah', contacts).length, 0);
  assert.equal(contactChoice('option two', 2), 1);
  assert.equal(contactChoice('1', 2), 0);
  for (const input of ['0', '3', '-1', '1.5', 'one or two', 'choose someone', '1111111111']) assert.equal(contactChoice(input, 2), null);
  assert.notEqual(recipientIdentity(contacts[0]), recipientIdentity(contacts[1]));
});
test('voice amounts reject ambiguous, fractional, negative, unrelated, and oversized input', () => {
  for (const speech of ['zero', '-250', 'minus two hundred', '1.5 rupees', 'one point five', 'twenty twenty', 'one hundred hundred', 'send dad 250', 'two lakh', '', 'one thousand thousand']) assert.equal(spokenAmount(speech), null, speech);
});
test('voice contact selection requires one exact name', () => {
  assert.equal(spokenContact('Pay Dad.', CONTACTS)?.name, 'Dad');
  assert.equal(spokenContact('corner store', CONTACTS)?.name, 'Corner Store');
  assert.equal(spokenContact('Dan', CONTACTS), null);
  assert.equal(spokenContact('Dad', [...CONTACTS, { name: 'Dad', upi: 'other@demo' }]), null);
  const local = [{ name: 'माँ', upi: '', phone: '1234567890' }];
  assert.equal(spokenContact('माँ', local)?.name, 'माँ');
  assert.equal(spokenContact('पापा', local), null);
});

test('common contact navigation phrases never become recipient searches', () => {
  for (const text of ['Pay to contacts', 'Please open contacts', 'Show contacts please', 'Send money to contacts', 'Pay someone']) assert.equal(voiceIntent(text).type, 'contacts', text);
  for (const text of ['open scanner', 'scan a code']) assert.equal(voiceIntent(text).type, 'scan');
  for (const text of ['pay to contacts and confirm', 'scan qr then pay', 'please go back and pay']) assert.notEqual(voiceIntent(text).type, 'contacts');
});
test('imperfect names produce suggestions without becoming exact selections', () => {
  const contacts = [{ name: 'Rahul Sharma', upi: 'a@demo' }, { name: 'Rahul Shah', upi: 'b@demo' }, { name: 'Ananya', upi: 'c@demo' }];
  assert.deepEqual(suggestedContacts('Rahul', contacts), contacts.slice(0, 2));
  assert.deepEqual(suggestedContacts('Anaya', contacts), [contacts[2]]);
  assert.equal(spokenContact('Anaya', contacts), null);
  assert.deepEqual(suggestedContacts('xy', contacts), []);
  assert.deepEqual(suggestedContacts('unrelated person', contacts), []);
});
