import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

export type Profile = { name: string; phone: string };
export default function AccountPage({ profile, contactCount, busy, onSave, onImport, onVoice, onHistory, onMessage }: {
  profile: Profile; contactCount: number; busy: boolean;
  onSave: (profile: Profile) => void; onImport: () => void; onVoice: () => void; onHistory: () => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [error, setError] = useState('');
  function save() {
    const cleanPhone = phone.replace(/[^+\d]/g, '');
    if (!name.trim()) { setError('Enter your name.'); onMessage('Enter your name.'); return; }
    if (cleanPhone && !/^\+?\d{7,15}$/.test(cleanPhone)) { setError('Enter a valid phone number, or leave it empty.'); onMessage('Enter a valid phone number, or leave it empty.'); return; }
    setError(''); onSave({ name: name.trim(), phone: cleanPhone });
  }
  function button(label: string, action: () => void, disabled = false) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={s.button}><Text style={s.text}>{label}</Text></Pressable>; }
  return <View style={s.container}>
    <View style={s.avatar} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Feather accessible={false} name="user" size={40} color="#f5f5f5" /></View>
    <Text style={s.text}>Demo account · No bank linked</Text>
    <View style={s.field}><Text style={s.label}>Your name</Text><TextInput accessibilityLabel="Your name" autoComplete="name" value={name} onChangeText={setName} maxLength={60} style={s.input} /></View>
    <View style={s.field}><Text style={s.label}>Phone number (optional)</Text><TextInput accessibilityLabel="Phone number, optional" autoComplete="tel" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={20} style={s.input} /></View>
    {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.text}>{error}</Text>}
    {button('Save account', save)}
    {button(busy ? 'Importing contacts…' : 'Import phone contacts', onImport, busy)}
    <Text style={s.label}>{contactCount} phone contacts · Stored on this device</Text>
    {button('Allow voice payments', onVoice)}
    {button('Payment history', onHistory)}
  </View>;
}
const s = StyleSheet.create({
  container: { gap: 20 }, avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#f5f5f5', fontSize: 22, lineHeight: 30 }, label: { color: '#b9b9b9', fontSize: 18, lineHeight: 26 }, field: { gap: 8 },
  input: { color: '#f5f5f5', minHeight: 64, fontSize: 22, padding: 16, borderWidth: 2, borderColor: '#f5f5f5', borderRadius: 16 },
  button: { minHeight: 72, borderWidth: 2, borderColor: '#f5f5f5', borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'center' },
});
