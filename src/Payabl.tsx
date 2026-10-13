import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { CONTACTS, Receipt, Recipient, appendDigit, parsePaymentQR, rupees, validAmount } from './payment';
import VoiceInput from './VoiceInput';
import { spokenAmount, spokenContact } from './voice';
import AccountPage, { Profile } from './AccountPage';
import { importPhoneContacts } from './phoneContacts';

type Screen = 'home' | 'scan' | 'contacts' | 'amount' | 'review' | 'pin' | 'success' | 'history' | 'settings' | 'account';
type Preferences = { voice: boolean; haptics: boolean; autoVoice: boolean };
const DEFAULTS: Preferences = { voice: true, haptics: true, autoVoice: true };
const STORAGE = 'payabl-demo-v1';
const C = { bg: '#101010', card: '#1e1e1e', raised: '#292929', line: '#414141', white: '#f5f5f5', muted: '#b9b9b9' };
const TITLES: Record<Screen, string> = { home: '', scan: 'Scan QR', contacts: 'Choose contact', amount: 'Enter amount', review: 'Confirm payment', pin: 'Enter demo PIN', success: 'Demo complete', history: 'Payment history', settings: 'Settings', account: 'Account' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'confirm'];
type IconName = React.ComponentProps<typeof Feather>['name'];
function Icon({ name, size = 24, color = C.white }: { name: IconName; size?: number; color?: string }) { return <Feather accessible={false} accessibilityElementsHidden importantForAccessibility="no" name={name} size={size} color={color} />; }
function Action({ title, onPress, icon, light = false }: { title: string; onPress: () => void; icon?: IconName; light?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [s.action, light && s.light, pressed && s.pressed]}>{icon && <Icon name={icon} color={light ? C.bg : C.white} />}<Text style={[s.actionText, light && { color: C.bg }]}>{title}</Text></Pressable>;
}
function ContactRow({ contact, onSelect }: { contact: Recipient; onSelect: (contact: Recipient) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'Pay ' + contact.name + (contact.phone ? '. Phone ' + contact.phone : '')} accessibilityHint="Opens amount keypad" onPress={() => onSelect(contact)} style={({ pressed }) => [s.personRow, pressed && s.pressed]}><Text style={s.personName}>{contact.name}</Text>{!!contact.phone && <Text style={s.caption}>{contact.phone}</Text>}{!contact.demo && <Text style={s.caption}>{contact.upi}</Text>}</Pressable>;
}
function ReceiptRow({ receipt, onRead }: { receipt: Receipt; onRead: (receipt: Receipt) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'Demo payment. ' + receipt.amount + ' rupees to ' + receipt.recipient.name} onPress={() => onRead(receipt)} style={s.receipt}><View style={s.grow}><Text style={s.personName}>{receipt.recipient.name}</Text><Text style={s.caption}>{new Date(receipt.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View><Text style={s.receiptAmount}>{rupees(receipt.amount)}</Text></Pressable>;
}
function AppContent() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ screen?: string }>();
  const screen: Screen = params.screen && Object.hasOwn(TITLES, params.screen) ? params.screen as Screen : 'home';
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [reader, setReader] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [contacts, setContacts] = useState(CONTACTS);
  const [profile, setProfile] = useState<Profile>({ name: '', phone: '' });
  const [contactsAsked, setContactsAsked] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleContacts, setVisibleContacts] = useState(20);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [entrySource, setEntrySource] = useState<'scan' | 'contacts'>('contacts');
  const [amount, setAmount] = useState('');
  // This simulation counts PIN taps; it never retains the actual digits.
  const [pinLength, setPinLength] = useState(0);
  const [error, setError] = useState('');
  const [voiceCancelToken, setVoiceCancelToken] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const submitLock = useRef(false);
  const speechGeneration = useRef(0);
  const speechVoice = useRef<string | undefined>(undefined);
  const voiceListening = useRef(false);
  const importingLock = useRef(false);
  const keypadHeight = Math.min(296, Math.max(200, height * .42));
  const bottom = Math.max(insets.bottom, 12);
  const showKeypad = ['amount', 'pin'].includes(screen);
  const filteredContacts = contacts.filter(contact => contact.name.toLowerCase().includes(query.toLowerCase()) || contact.phone?.includes(query));

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    AsyncStorage.getItem(STORAGE).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.prefs) setPrefs({ voice: saved.guidanceConfigured === true ? saved.prefs.voice !== false : true, haptics: saved.prefs.haptics !== false, autoVoice: saved.prefs.autoVoice !== false });
        if (saved.profile && typeof saved.profile.name === 'string' && typeof saved.profile.phone === 'string') setProfile(saved.profile);
        setContactsAsked(saved.contactsAsked === true);
        if (Array.isArray(saved.receipts)) setReceipts(saved.receipts.filter((r: Receipt) => r.id && r.recipient?.name && validAmount(r.amount)).slice(0, 20));
        if (Array.isArray(saved.contacts)) setContacts(saved.contacts.filter((r: Recipient) => typeof r.name === 'string' && typeof r.upi === 'string'));
      } catch { /* Invalid cache falls back to demo defaults. */ }
    }).catch(() => {}).finally(() => setReady(true));
    return () => listener.remove();
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(STORAGE, JSON.stringify({ prefs, receipts, contacts, profile, contactsAsked, guidanceConfigured: true })).catch(() => {}); }, [ready, prefs, receipts, contacts, profile, contactsAsked]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state !== 'active') { speechGeneration.current++; Speech.stop(); setPinLength(0); }
    });
    return () => { listener.remove(); Speech.stop(); };
  }, []);
  const speak = useCallback((text: string, explicit = false) => {
    if (!foreground || voiceListening.current || (!explicit && (!prefs.voice || reader))) return;
    const generation = ++speechGeneration.current;
    Speech.stop().then(async () => {
      if (!speechVoice.current) {
        const voices = await Speech.getAvailableVoicesAsync();
        speechVoice.current = (voices.find(voice => voice.language.toLowerCase().replace('_', '-') === 'en-in') || voices.find(voice => voice.language.toLowerCase().startsWith('en')))?.identifier;
      }
      if (generation !== speechGeneration.current || voiceListening.current) return;
      Speech.speak(text, { language: 'en-IN', voice: speechVoice.current, volume: 1, rate: .88, useApplicationAudioSession: false,
        onError: () => setError('Your phone could not play spoken guidance. VoiceOver or TalkBack can still read the controls.') });
    }).catch(() => setError('Your phone could not start spoken guidance. VoiceOver or TalkBack can still read the controls.'));
  }, [prefs.voice, reader, foreground]);
  const buzz = useCallback((kind: 'tap' | 'success' | 'error' = 'tap') => {
    if (!prefs.haptics || Platform.OS === 'web') return;
    if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [prefs.haptics]);
  function navigate(next: Screen) { setError(''); setVoiceCancelToken(0); router.setParams({ screen: next }); if (next === 'scan') scanLock.current = false; }
  useEffect(() => {
    // A direct link or reload cannot restore an in-progress payment or PIN.
    if (!recipient && ['amount', 'review', 'pin', 'success'].includes(screen)) router.setParams({ screen: 'home' });
  }, [screen, recipient]);
  function home() { setRecipient(null); setAmount(''); setPinLength(0); submitLock.current = false; navigate('home'); }
  function back() {
    setError(''); setPinLength(0);
    const targets: Partial<Record<Screen, Screen>> = { amount: 'contacts', review: 'amount', pin: 'review', history: 'account' };
    if (screen === 'home' || screen === 'success') home();
    else navigate(screen === 'amount' ? entrySource : targets[screen] || 'home');
  }
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove();
    // Back reads the current screen/recipient; amount changes do not alter its destination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, entrySource]);
  function describe(): string {
    const common = 'Use Back at the top to return.';
    switch (screen) {
      case 'home': return 'Payabl. Scan QR is the top button. Pay family is the bottom button. Account and Settings are at the top right.';
      case 'scan': return permission?.granted ? `Point the rear camera at the payment QR. The recipient will be read when detected. ${common}` : 'Camera access needed. Choose Allow camera. Back returns home.';
      case 'contacts': return `Choose a contact by name or use the list. ${common}`;
      case 'amount': return `Paying ${recipient?.name}. ${Number(amount || 0)} rupees. Enter whole rupees, or choose Speak amount. Next: bottom right. Delete: bottom left. ${recipient?.demo ? '' : 'Recipient name unverified.'}`;
      case 'review': return `${Number(amount)} rupees to ${recipient?.name}. ${recipient?.phone ? 'Phone ' + recipient.phone : 'UPI ID ' + recipient?.upi}. ${recipient?.demo ? '' : 'Name unverified.'} Continue to PIN, or Back to change amount.`;
      case 'pin': return 'Enter any four demo digits. Never use your real PIN. Pay: bottom right. Delete: bottom left.';
      case 'success': return `Demo complete. ${Number(amount)} rupees to ${recipient?.name}. No money moved. Done returns home.`;
      case 'history': return receipts.length ? `Demo activity. Select a receipt to hear its details. ${common}` : `No demo payments yet. ${common}`;
      case 'settings': return `Settings. Spoken guidance ${prefs.voice ? 'on' : 'off'}. Automatic voice entry ${prefs.autoVoice ? 'on' : 'off'}. Vibration ${prefs.haptics ? 'on' : 'off'}.`;
      case 'account': return `Account. ${profile.name || 'Add your name'}. You can save your phone number, import contacts, allow voice payments, and hear payment history. Demo account. No bank is linked.`;
    }
  }
  useEffect(() => {
    if (!ready || !foreground) return;
    const instructions = describe();
    const timer = setTimeout(() => { if (voiceListening.current) return; if (reader) AccessibilityInfo.announceForAccessibility(instructions); else speak(instructions); }, 350);
    return () => clearTimeout(timer);
    // Announce once per screen transition; digit input has separate feedback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready, reader, foreground]);
  function report(message: string) { setError(message); speak(message); if (reader) AccessibilityInfo.announceForAccessibility(message); buzz('error'); }
  async function importContacts() {
    if (importingLock.current) return;
    importingLock.current = true; setImporting(true); setContactsAsked(true); setError('');
    try {
      const result = await importPhoneContacts();
      setContacts(result.contacts.length ? result.contacts : CONTACTS);
      setQuery(''); setVisibleContacts(20);
      voiceMessage(result.contacts.length ? `${result.contacts.length} contacts imported.${result.limited ? ' Only the contacts you allowed are available.' : ''}` : 'No phone contacts found. Sample contacts are available.');
    } catch (error) { report(error instanceof Error ? error.message : 'Could not import contacts.'); }
    finally { importingLock.current = false; setImporting(false); }
  }
  async function allowVoice() {
    try {
      if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) return report('Voice payments need the installed Payabl app. Expo Go does not include speech recognition.');
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) return report('Allow microphone and speech recognition for Payabl in phone Settings.');
      setPrefs(current => ({ ...current, autoVoice: true })); voiceMessage('Voice payments allowed. Payabl will ask for a name and amount.');
    } catch { report('Voice input is unavailable. The contact buttons and keypad still work.'); }
  }
  function saveProfile(value: Profile) { setProfile(value); voiceMessage('Account saved.'); }
  function accountMessage(message: string) { if (!reader) speak(message, true); }
  function voiceStarted() { buzz('success'); }
  function select(c: Recipient, initialAmount = '', source: 'scan' | 'contacts' = 'contacts') { setEntrySource(source); setRecipient(c); setAmount(initialAmount); submitLock.current = false; setPinLength(0); navigate('amount'); }
  function prepareVoice() { voiceListening.current = true; speechGeneration.current++; Speech.stop(); setError(''); }
  const finishVoice = useCallback(() => { voiceListening.current = false; }, []);
  function voiceMessage(message: string) { if (reader) AccessibilityInfo.announceForAccessibility(message); else speak(message, true); }
  useEffect(() => {
    if (!ready || screen !== 'contacts' || contactsAsked || Platform.OS === 'web') return;
    const timer = setTimeout(() => { void importContacts(); }, 50);
    return () => clearTimeout(timer);
    // Request contacts once at first use, then let Account handle retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready, contactsAsked]);
  function acceptVoice(text: string) {
    if (screen === 'contacts') {
      const contact = spokenContact(text, contacts);
      if (!contact) return report('Could not match a contact. Say the full name, or choose a contact button.');
      select(contact);
    } else if (screen === 'amount') {
      const value = spokenAmount(text);
      if (!value) return report('Could not understand the amount. Say a whole amount from 1 to 100000 rupees, or use the keypad.');
      setAmount(value); setError(''); buzz('success'); voiceMessage(`${Number(value)} rupees to ${recipient?.name}. Check the amount, then press Next.`);
    }
  }
  function readReceipt(r: Receipt) { speak('Demo payment ' + r.amount + ' rupees to ' + r.recipient.name + '. ' + new Date(r.time).toLocaleString('en-IN') + '. No money moved.', true); }
  function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    try { const p = parsePaymentQR(data); buzz('success'); select(p.recipient, p.amount, 'scan'); }
    catch (e) { report((e as Error).message); }
  }
  function confirm() {
    if (screen === 'amount') { if (!validAmount(amount)) return report('Enter 1 to 100000 whole rupees.'); navigate('review'); }
    else if (screen === 'review') { setPinLength(0); navigate('pin'); }
    else if (screen === 'pin') {
      if (pinLength !== 4) return report('Enter four demo digits first. Never use a real PIN.');
      if (submitLock.current || !recipient) return;
      submitLock.current = true;
      setReceipts(items => [{ id: `DEMO-${Date.now()}`, recipient, amount, time: new Date().toISOString() }, ...items].slice(0, 20));
      setPinLength(0); buzz('success'); navigate('success');
    } else if (screen === 'success') home(); else speak(describe(), true);
  }
  function keyPress(key: string) {
    finishVoice();
    setVoiceCancelToken(value => value + 1);
    buzz(); setError('');
    if (key === 'confirm') return confirm();
    if (key === 'delete') {
      if (screen === 'amount' && amount) { const next = amount.slice(0, -1); setAmount(next); speak(`${Number(next || 0)} rupees`); }
      else if (screen === 'pin' && pinLength) { setPinLength(n => n - 1); speak('Digit removed.'); }
      else back(); return;
    }
    if (screen === 'pin') { if (pinLength < 4) { setPinLength(n => n + 1); speak('Digit entered.'); } else report('Four digits entered. Press Pay.'); return; }
    if (screen === 'amount') { const next = appendDigit(amount, key); setAmount(next); if (next === amount && key !== '0') report('Maximum demo amount is 100000 rupees.'); else speak(`${Number(next || 0)} rupees`); return; }
    if (key === '0') return home();
    if (screen === 'home') { const links: Record<string, Screen> = { '1': 'scan', '2': 'contacts', '3': 'account', '4': 'settings' }; if (links[key]) navigate(links[key]); }
    else if (screen === 'contacts') { const c = contacts[Number(key) - 1]; if (c) select(c); else report('No contact on that key.'); }
    else if (screen === 'scan') {
      if (key === '1') requestPermission().catch(() => report('Could not request camera permission.'));
      else if (key === '2') select({ name: 'Corner Store', upi: 'cornerstore@demo', demo: true }, '', 'scan');
      else if (key === '5') { scanLock.current = false; speak(describe(), true); }
    }
    else if (screen === 'success') { if (key === '3') navigate('history'); }
    else if (screen === 'history') { const r = receipts[Number(key) - 1]; if (r) speak(`Demo receipt. ${Number(r.amount)} rupees to ${r.recipient.name}. ${new Date(r.time).toLocaleString('en-IN')}. No money moved.`, true); }
    else if (screen === 'settings') {
      if (key === '1') { setPrefs(p => ({ ...p, voice: !p.voice })); speak(`Voice guidance ${prefs.voice ? 'off' : 'on'}.`, true); }
      else if (key === '2') { setPrefs(p => ({ ...p, haptics: !p.haptics })); speak(`Haptics ${prefs.haptics ? 'off' : 'on'}.`, true); }
      else if (key === '3') { setPrefs(p => ({ ...p, autoVoice: !p.autoVoice })); voiceMessage(`Automatic voice entry ${prefs.autoVoice ? 'off' : 'on'}.`); }
    }
  }
  function keyLabel(key: string): string {
    if (key === 'delete') return screen === 'amount' || screen === 'pin' ? 'Delete last digit' : 'Back';
    if (key === 'confirm') return screen === 'pin' ? 'Confirm demo payment' : screen === 'amount' ? 'Review amount' : screen === 'review' ? 'Enter demo PIN' : 'Confirm';
    const labels: Partial<Record<Screen, Record<string, string>>> = {
      home: { '1': 'Scan QR', '2': 'Pay family', '3': 'Account', '4': 'Settings', '0': 'Home' },
      contacts: Object.fromEntries(contacts.map((c, i) => [String(i + 1), c.name])),
      settings: { '1': 'Spoken guidance', '2': 'Haptics', '3': 'Automatic voice', '0': 'Home' },
      scan: { '1': 'Allow camera', '2': 'Try sample', '5': 'Retry scan', '0': 'Home' },
    }; return labels[screen]?.[key] || key;
  }
  function content() {
    if (screen === 'home') return <View style={s.homeActions}>
      <Pressable testID="scan-action" accessibilityRole="button" accessibilityLabel="Scan QR" accessibilityHint="Top payment button. Opens camera." onPress={() => navigate('scan')} style={({ pressed }) => [s.mainAction, s.light, pressed && s.pressed]}><Text style={[s.mainActionText, { color: C.bg }]}>Scan QR</Text></Pressable>
      <Pressable testID="family-action" accessibilityRole="button" accessibilityLabel="Pay family" accessibilityHint="Bottom payment button. Choose family or a saved contact." onPress={() => navigate('contacts')} style={({ pressed }) => [s.mainAction, pressed && s.pressed]}><Text style={s.mainActionText}>Pay family</Text></Pressable>
    </View>;
    if (screen === 'scan') return <>
      <Text style={s.body}>Point the rear camera at the QR.</Text>
      <View style={s.scanSurface}>{permission?.granted && foreground ? <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scan(data)} /> : <View style={s.cameraPlaceholder}><Text style={s.body}>Camera access needed</Text></View>}{permission?.granted && <View pointerEvents="none" style={s.scanGuide} />}</View>
      {!permission?.granted && <Action title="Allow camera" light onPress={() => keyPress('1')} />}
      {permission?.status === 'denied' && !permission.canAskAgain && <Text style={s.body}>Enable camera access for Expo Go in iPhone Settings.</Text>}
      {!!error && <Action title="Scan again" onPress={() => { scanLock.current = false; setError(''); }} />}
    </>;
    if (screen === 'contacts') return <View style={s.contactList}>
      {importing ? <Text accessibilityLiveRegion="polite" style={s.body}>Importing contacts…</Text> : <VoiceInput key={`contact-voice-${voiceCancelToken}`} label="Speak name" prompt="Say a contact name after the vibration." autoStart={prefs.autoVoice && voiceCancelToken === 0} phrases={contacts.slice(0, 50).map(c => c.name)} onPrepare={prepareVoice} onFinish={finishVoice} onStarted={voiceStarted} onResult={acceptVoice} onMessage={voiceMessage} />}
      <TextInput accessibilityLabel="Search contacts by name or phone" placeholder="Search contacts" placeholderTextColor={C.muted} value={query} onChangeText={value => { setQuery(value); setVisibleContacts(20); setVoiceCancelToken(count => count + 1); }} style={s.search} />
      {filteredContacts.slice(0, visibleContacts).map(c => <ContactRow key={c.phone || c.upi} contact={c} onSelect={select} />)}
      {!filteredContacts.length && <Text style={s.body}>No matching contacts.</Text>}
      {filteredContacts.length > visibleContacts && <Action title="More contacts" onPress={() => setVisibleContacts(count => count + 20)} />}
    </View>;
    if (screen === 'amount') return <>
      <Text style={s.payeeName}>To {recipient?.name}</Text>
      <Text accessibilityLabel={Number(amount || 0) + ' rupees'} accessibilityLiveRegion="polite" style={s.paymentAmount}>{rupees(amount)}</Text>
      <VoiceInput key={`amount-voice-${voiceCancelToken}`} label="Speak amount" prompt="Say the amount in rupees after the vibration." autoStart={prefs.autoVoice && !amount && voiceCancelToken === 0} phrases={[]} onPrepare={prepareVoice} onFinish={finishVoice} onStarted={voiceStarted} onResult={acceptVoice} onMessage={voiceMessage} />
      {!recipient?.demo && <Text style={s.body}>Recipient name unverified. Check the UPI ID on the next screen.</Text>}
    </>;
    if (screen === 'review') return <View style={s.paymentDetails}>
      <Text style={s.paymentAmount}>{rupees(amount)}</Text><Text style={s.payeeName}>To {recipient?.name}</Text><Text style={s.body}>{recipient?.upi || recipient?.phone}</Text>{!recipient?.demo && <Text style={s.body}>Name unverified</Text>}
    </View>;
    if (screen === 'pin') return <>
      <Text style={s.payeeName}>{rupees(amount)} to {recipient?.name}</Text>
      <View accessible accessibilityLabel={pinLength + ' of 4 demo PIN digits entered'} accessibilityLiveRegion="polite" style={s.pinRow}>{[0, 1, 2, 3].map(i => <View key={i} style={[s.pinSlot, i < pinLength && s.pinFilled]} />)}</View>
      <Text style={s.body}>Any 4 demo digits. Never use your real PIN.</Text>
    </>;
    if (screen === 'success') return <View style={s.paymentDetails}><Text style={s.paymentAmount}>{rupees(amount)}</Text><Text style={s.payeeName}>To {recipient?.name}</Text><Text style={s.body}>No money moved.</Text></View>;
    if (screen === 'history') return <>
      {!receipts.length && <Text style={s.body}>No payments yet.</Text>}
      {receipts.map(r => <ReceiptRow key={r.id} receipt={r} onRead={readReceipt} />)}
    </>;
    if (screen === 'settings') return <>
      <Pressable accessibilityRole="switch" accessibilityLabel="Spoken guidance" accessibilityState={{ checked: prefs.voice }} onPress={() => keyPress('1')} style={s.setting}><Text style={[s.body, s.grow]}>Spoken guidance</Text><Text style={s.body}>{prefs.voice ? 'On' : 'Off'}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Vibration" accessibilityState={{ checked: prefs.haptics }} onPress={() => keyPress('2')} style={s.setting}><Text style={[s.body, s.grow]}>Vibration</Text><Text style={s.body}>{prefs.haptics ? 'On' : 'Off'}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Automatic voice entry" accessibilityState={{ checked: prefs.autoVoice }} onPress={() => keyPress('3')} style={s.setting}><Text style={[s.body, s.grow]}>Automatic voice entry</Text><Text style={s.body}>{prefs.autoVoice ? 'On' : 'Off'}</Text></Pressable>
      <Action title="Phone permissions" onPress={() => { if (Platform.OS === 'web') report('Manage permissions in your browser or open Payabl on your phone.'); else Linking.openSettings().catch(() => report('Open your phone Settings and select Payabl.')); }} />
    </>;
    if (screen === 'account') return <AccountPage profile={profile} contactCount={contacts.filter(contact => contact.phone).length} busy={importing} onSave={saveProfile} onImport={importContacts} onVoice={allowVoice} onHistory={() => navigate('history')} onMessage={accountMessage} />;
    return null;
  }
  const phone = <View style={[s.phone, { paddingTop: Math.max(insets.top, 12), paddingBottom: showKeypad ? 0 : Math.max(insets.bottom, 12) }]}>
    <View style={s.header}>{screen === 'home' ? <><Text accessibilityRole="header" accessibilityLabel="Payabl" style={s.wordmark}>payabl<Text style={s.wordmarkDot}>.</Text></Text><View style={s.headerActions}><Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => navigate('account')} style={s.iconButton}><Icon name="user" size={28} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => navigate('settings')} style={s.iconButton}><Icon name="settings" size={28} /></Pressable></View></> : <><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={s.headerButton}><Text style={s.headerText}>Back</Text></Pressable>{['amount', 'review', 'pin'].includes(screen) && <Pressable accessibilityRole="button" accessibilityLabel="Cancel payment" onPress={home} style={s.headerButton}><Text style={s.headerText}>Cancel</Text></Pressable>}</>}</View>
    {screen === 'home' ? content() : <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" style={s.content} contentContainerStyle={s.contentInner} showsVerticalScrollIndicator={false}><Text accessibilityRole="header" style={s.title}>{TITLES[screen]}</Text>{content()}{!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.error}>{error}</Text>}</ScrollView>}
    {screen === 'review' && <View style={s.primaryFooter}><Action title="Continue to PIN" light onPress={confirm} /></View>}
    {screen === 'success' && <View style={s.primaryFooter}><Action title="Done" light onPress={home} /></View>}
    {showKeypad && <View style={[s.keypadContainer, { paddingBottom: bottom }]}><View testID="fixed-keypad" style={[s.keypad, { height: keypadHeight, width: '100%' }]}>{KEYS.map(key => {
      const label = keyLabel(key); const isConfirm = key === 'confirm';
      const index = KEYS.indexOf(key);
      const spokenLabel = screen === 'pin' && /^\d$/.test(key) ? `Private PIN key. Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}` : label === key ? key : `${/^\d$/.test(key) ? key + '. ' : ''}${label}`;
      const disabled = isConfirm && ((screen === 'pin' && pinLength !== 4) || (screen === 'amount' && !validAmount(amount)));
      return <Pressable key={key} testID={`key-${key}`} accessibilityRole="button" accessibilityLabel={spokenLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={() => keyPress(key)} style={({ pressed }) => [s.key, isConfirm && s.confirmKey, key === '5' && s.anchorKey, disabled && s.disabledKey, pressed && s.keyPressed]}>{key === 'delete' || isConfirm ? <><Icon name={isConfirm ? screen === 'amount' ? 'arrow-right' : 'check' : 'delete'} size={29} color={isConfirm ? C.bg : C.white} /><Text maxFontSizeMultiplier={1.2} style={[s.specialLabel, isConfirm && { color: C.bg }]}>{isConfirm ? screen === 'amount' ? 'Next' : 'Pay' : 'Delete'}</Text></> : <><Text maxFontSizeMultiplier={1.2} style={s.keyDigit}>{key}</Text>{key === '5' && <View accessible={false} style={s.anchorDot} />}</>}</Pressable>;
    })}</View></View>}
  </View>;
  return <View style={s.root}><StatusBar style="light" /><View style={s.phoneFrame}>{phone}</View></View>;

}
export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center' }, phoneFrame: { flex: 1, minHeight: 0, width: '100%', maxWidth: 460 }, phone: { flex: 1, minHeight: 0, backgroundColor: C.bg },
  header: { minHeight: 72, flexShrink: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerActions: { flexDirection: 'row', gap: 8 }, iconButton: { width: 56, minHeight: 64, alignItems: 'center', justifyContent: 'center' }, headerButton: { minWidth: 96, minHeight: 64, alignItems: 'center', justifyContent: 'center' }, headerText: { color: C.white, fontSize: 22, fontWeight: '600' }, wordmark: { color: C.white, fontSize: 32, lineHeight: 42, fontWeight: '700', letterSpacing: -1.5, flexShrink: 1 }, wordmarkDot: { color: C.muted }, search: { minHeight: 64, padding: 16, borderWidth: 2, borderColor: C.white, borderRadius: 20, color: C.white, fontSize: 22 },
  homeActions: { flex: 1, minHeight: 0, padding: 20, gap: 20 }, mainAction: { flex: 1, minHeight: 120, borderWidth: 2, borderColor: C.white, borderRadius: 28, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', padding: 20 }, mainActionText: { color: C.white, fontSize: 36, lineHeight: 48, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, light: { backgroundColor: C.white }, pressed: { opacity: .65 },
  content: { flex: 1 }, contentInner: { padding: 20, gap: 24, paddingBottom: 28 }, title: { color: C.white, fontSize: 28, lineHeight: 36, fontWeight: '600' }, body: { color: C.white, fontSize: 20, lineHeight: 29 }, caption: { color: C.muted, fontSize: 16, lineHeight: 24 }, grow: { flex: 1 },
  action: { minHeight: 72, padding: 20, borderWidth: 2, borderColor: C.white, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, actionText: { color: C.white, fontSize: 22, lineHeight: 30, fontWeight: '600', flexShrink: 1 }, primaryFooter: { padding: 16, paddingBottom: 8 },
  contactList: { gap: 16 }, personRow: { minHeight: 104, padding: 24, borderWidth: 2, borderColor: C.white, borderRadius: 8, justifyContent: 'center' }, personName: { color: C.white, fontSize: 26, lineHeight: 34, fontWeight: '600' }, payeeName: { color: C.white, fontSize: 26, lineHeight: 34 }, paymentAmount: { color: C.white, fontSize: 58, lineHeight: 72, fontWeight: '600', marginVertical: 16 }, paymentDetails: { gap: 24, paddingTop: 16 },
  scanSurface: { height: 320, backgroundColor: C.card, overflow: 'hidden', borderWidth: 1, borderColor: C.line }, cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, scanGuide: { position: 'absolute', top: '20%', bottom: '20%', left: '15%', right: '15%', borderWidth: 3, borderColor: C.white },
  pinRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', paddingVertical: 24 }, pinSlot: { width: 24, height: 24, borderWidth: 2, borderColor: C.white, borderRadius: 12 }, pinFilled: { backgroundColor: C.white },
  keypadContainer: { paddingHorizontal: 16, alignItems: 'center', backgroundColor: C.bg }, keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' }, key: { width: '31.9%', height: '23.2%', borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: '#777', justifyContent: 'center', alignItems: 'center' }, keyDigit: { color: C.white, fontSize: 32, lineHeight: 38, fontWeight: '600' }, keyHint: { color: C.white, fontSize: 12, marginTop: 1, maxWidth: '94%' }, specialLabel: { color: C.white, fontSize: 13, marginTop: 2, fontWeight: '600' }, confirmKey: { backgroundColor: C.white, borderColor: C.white }, anchorKey: { borderColor: C.white, borderWidth: 2 }, anchorDot: { height: 3, width: 12, backgroundColor: C.white, position: 'absolute', bottom: 5 }, keyPressed: { opacity: .65 }, disabledKey: { backgroundColor: '#818181', borderColor: '#818181' },
  receipt: { flexDirection: 'row', gap: 12, paddingVertical: 24, borderBottomWidth: 1, borderColor: C.line, alignItems: 'center' }, receiptAmount: { color: C.white, fontSize: 23, fontWeight: '600' }, setting: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 72, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.line }, practiceDigit: { color: C.white, fontSize: 44, lineHeight: 56, textAlign: 'center', paddingVertical: 24 }, error: { color: C.white, fontSize: 20, lineHeight: 29, padding: 16, borderWidth: 2, borderColor: C.white },
});
