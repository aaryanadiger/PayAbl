import { Platform } from 'react-native';
import type { Recipient } from './payment';

export async function importPhoneContacts(): Promise<{ contacts: Recipient[]; limited: boolean }> {
  if (Platform.OS === 'web') throw new Error('Open Payabl on your phone to import contacts.');
  const { Contact, ContactField, requestPermissionsAsync } = await import('expo-contacts');
  const permission = await requestPermissionsAsync();
  if (!permission.granted) throw new Error(permission.canAskAgain ? 'Contacts access was declined. You can import contacts later from Account.' : 'Allow Contacts for Payabl in your phone Settings, then try importing again.');
  const contacts: Recipient[] = [];
  const seen = new Set<string>();
  let offset = 0;
  while (true) {
    const batch = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES] as const, { limit: 100, offset });
    for (const contact of batch) {
      for (const item of contact.phones || []) {
        const phone = item.number?.replace(/[^+\d]/g, '') || '';
        const name = contact.fullName?.trim();
        if (!name || phone.replace(/\D/g, '').length < 7 || seen.has(phone)) continue;
        seen.add(phone);
        contacts.push({ name, phone, upi: '', demo: true });
      }
    }
    offset += batch.length;
    if (batch.length < 100) break;
  }
  return { contacts: contacts.sort((a, b) => a.name.localeCompare(b.name)), limited: permission.accessPrivileges === 'limited' };
}
