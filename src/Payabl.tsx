import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { CONTACTS, Receipt, Recipient, appendDigit, parsePaymentQR, rupees, validAmount } from './payment';
import VoiceInput, { type VoiceInputHandle } from './VoiceInput';
import GuidedQRScanner from './GuidedQRScanner';
import { selectSpeechService, speechErrorMessage, stopSpeechForInput, withSpeechDeadline } from './voiceService';
import { contactChoice, matchingContacts, suggestedContacts, recipientIdentity, spokenAmount, voiceIntent } from './voice';
import AccountPage, { Profile } from './AccountPage';
import { importPhoneContacts } from './phoneContacts';
import { canHoldToAsk, CONTACT_PAGE_SIZE, contactKeyIndex, demoTapCount, HOLD_TO_ASK_MS } from './keypad';

type Screen = 'home' | 'scan' | 'contacts' | 'amount' | 'review' | 'pin' | 'success' | 'history' | 'settings' | 'account';
type Preferences = { voice: boolean; haptics: boolean };
const DEFAULTS: Preferences = { voice: true, haptics: true };
const STORAGE = 'payabl-demo-v1';
const C = { bg: '#101010', card: '#1e1e1e', raised: '#292929', line: '#414141', white: '#f5f5f5', muted: '#b9b9b9' };
const TITLES: Record<Screen, string> = { home: '', scan: 'Scan QR', contacts: 'Choose contact', amount: 'Enter amount', review: 'Confirm demo payment', pin: 'Enter demo PIN', success: 'Payment demo complete', history: 'Payment history', settings: 'Settings', account: 'Account' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'confirm'];

const FeedbackContext = createContext<() => void>(() => {});
const AssistantContext = createContext<(() => void) | null>(null);
function useAssistantAction() {
  const ask = useContext(AssistantContext);
  if (!ask) return {};
  return { accessibilityActions: [{ name: 'askPayabl', label: 'Ask PayAbl' }],
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => { if (event.nativeEvent.actionName === 'askPayabl') ask(); } };
}
type IconName = React.ComponentProps<typeof Feather>['name'];
function Icon({ name, size = 24, color = C.white }: { name: IconName; size?: number; color?: string }) { return <Feather accessible={false} accessibilityElementsHidden importantForAccessibility="no" name={name} size={size} color={color} />; }
function Action({ title, onPress, icon, light = false }: { title: string; onPress: () => void; icon?: IconName; light?: boolean }) {
  const assistant = useAssistantAction();
  const feedback = useContext(FeedbackContext);
  return <Pressable {...assistant} accessibilityRole="button" accessibilityLabel={title} onPress={() => { feedback(); onPress(); }} style={({ pressed }) => [s.action, light && s.light, pressed && s.pressed]}>{icon && <Icon name={icon} color={light ? C.bg : C.white} />}<Text style={[s.actionText, light && { color: C.bg }]}>{title}</Text></Pressable>;
}
function ContactRow({ contact, onSelect, option }: { contact: Recipient; onSelect: (contact: Recipient) => void; option?: number }) {
  const assistant = useAssistantAction();
  const feedback = useContext(FeedbackContext);
  return <Pressable {...assistant} accessibilityRole="button" accessibilityLabel={(option ? `Option ${option}. ` : '') + recipientIdentity(contact)} accessibilityHint="Select recipient and enter amount" onPress={() => { feedback(); onSelect(contact); }} style={({ pressed }) => [s.personRow, pressed && s.pressed]}><Text style={s.personName}>{option ? `${option}. ` : ''}{contact.name}</Text><Text style={s.caption}>{contact.phone || contact.upi}</Text></Pressable>;
}
function ReceiptRow({ receipt, onRead }: { receipt: Receipt; onRead: (receipt: Receipt) => void }) {
  const feedback = useContext(FeedbackContext);
  return <Pressable accessibilityRole="button" accessibilityLabel={'Demo payment. ' + receipt.amount + ' rupees to ' + receipt.recipient.name} onPress={() => { feedback(); onRead(receipt); }} style={s.receipt}><View style={s.grow}><Text style={s.personName}>{receipt.recipient.name}</Text><Text style={s.caption}>{new Date(receipt.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View><Text style={s.receiptAmount}>{rupees(receipt.amount)}</Text></Pressable>;
}
function AppContent() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ screen?: string; voice?: string }>();
  const screen: Screen = params.screen && Object.hasOwn(TITLES, params.screen) ? params.screen as Screen : 'home';
  const currentScreen = useRef(screen);
  currentScreen.current = screen;
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [reader, setReader] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [contacts, setContacts] = useState(CONTACTS);
  const [profile, setProfile] = useState<Profile>({ name: '', phone: '' });
  const [contactsAsked, setContactsAsked] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [contactPage, setContactPage] = useState(0);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [entrySource, setEntrySource] = useState<'scan' | 'contacts'>('contacts');
  const [amount, setAmount] = useState('');
  const [pinLength, setPinLength] = useState(0);
  const reviewConfirmed = useRef(false);
  const microphoneBlocked = useRef(false);
  const zeroHeld = useRef(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [choices, setChoices] = useState<Recipient[]>([]);
  const [pendingName, setPendingName] = useState('');
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const voiceInput = useRef<VoiceInputHandle>(null);
  const lastMessage = useRef('Ask PayAbl. Tap anywhere in the main area to speak.');
  const speechMuted = useRef(false);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanAttempt, setScanAttempt] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const submitLock = useRef(false);
  const speechGeneration = useRef(0);
  const speechVoice = useRef<string | undefined>(undefined);
  const speechBusy = useRef(false);
  const voiceListening = useRef(false);
  const importingLock = useRef(false);
  const keypadHeight = Math.min(296, Math.max(200, height * .42));
  const showKeypad = canHoldToAsk(screen) || screen === 'pin';
  const filteredContacts = choices.length ? choices : contacts.filter(contact => contact.name.toLowerCase().includes(query.toLowerCase()) || contact.phone?.includes(query));
  const pageContacts = filteredContacts.slice(contactPage * CONTACT_PAGE_SIZE, (contactPage + 1) * CONTACT_PAGE_SIZE);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    AsyncStorage.getItem(STORAGE).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.prefs) setPrefs({ voice: saved.guidanceConfigured === true ? saved.prefs.voice !== false : true, haptics: saved.prefs.haptics !== false });
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
      if (state !== 'active') { speechGeneration.current++; void Speech.stop().catch(() => {}); setPinLength(0); }
    });
    return () => { listener.remove(); void Speech.stop().catch(() => {}); };
  }, []);
  const speak = useCallback((text: string, explicit = false) => {
    lastMessage.current = text;
    if (!foreground || voiceListening.current || (!explicit && (!prefs.voice || speechMuted.current))) return;
    if (reader) { AccessibilityInfo.announceForAccessibility(text); return; }
    const generation = ++speechGeneration.current;
    speechBusy.current = true;
    const finished = () => { if (generation === speechGeneration.current) speechBusy.current = false; };
    stopSpeechForInput(Speech.stop, Speech.isSpeakingAsync).then(async () => {
      if (!speechVoice.current) {
        const voices = await withSpeechDeadline(Speech.getAvailableVoicesAsync()).catch(() => []);
        speechVoice.current = (voices.find(voice => voice.language.toLowerCase().replace('_', '-') === 'en-in') || voices.find(voice => voice.language.toLowerCase().startsWith('en')))?.identifier;
      }
      if (generation !== speechGeneration.current || voiceListening.current || AppState.currentState === 'background') return;
      Speech.speak(text, { language: 'en-IN', voice: speechVoice.current, volume: 1, rate: .88, useApplicationAudioSession: false,
        onDone: finished, onStopped: finished,
        onError: () => { finished(); setError('Spoken guidance unavailable. Use TalkBack or the buttons.'); } });
    }).catch(() => { finished(); if (generation === speechGeneration.current && !voiceListening.current) setError('Spoken guidance unavailable. Use TalkBack or the buttons.'); });
  }, [prefs.voice, reader, foreground]);
  const invalidateSpeech = useCallback(() => { speechGeneration.current++; speechBusy.current = false; void Speech.stop().catch(() => {}); }, []);
  const buzz = useCallback((kind: 'tap' | 'success' | 'error' | 'ready' = 'tap', enabled = prefs.haptics) => {
    if (!enabled || Platform.OS === 'web') return;
    if (Platform.OS === 'android') {
      const effect = kind === 'tap' ? Haptics.AndroidHaptics.Virtual_Key : kind === 'error' ? Haptics.AndroidHaptics.Reject : Haptics.AndroidHaptics.Confirm;
      void Haptics.performAndroidHapticsAsync(effect).catch(() => {
        // Fall back only when the native haptic call fails, not when system
        // settings deliberately suppress touch feedback.
        Vibration.vibrate(kind === 'tap' ? 35 : kind === 'error' ? [0, 60, 70, 60] : 80);
      });
    } else if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else Haptics.notificationAsync(kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [prefs.haptics]);
  function stopSpeaking() {
    if (cueTimer.current) clearTimeout(cueTimer.current);
    speechGeneration.current++; speechBusy.current = false;
    speechMuted.current = true;
    void Speech.stop().catch(() => {});
  }
  function cancelInput() { voiceInput.current?.cancel(); stopSpeaking(); }
  function navigate(next: Screen) {
    currentScreen.current = next;
    microphoneBlocked.current = next === 'pin';
    cancelInput(); setError(''); setPendingName('');
    setPinLength(0);
    if (next !== 'pin') reviewConfirmed.current = false;
    if (next === 'contacts') { setContactPage(0); setQuery(''); setChoices([]); }
    router.setParams({ screen: next, voice: undefined });
    if (next === 'scan') { scanLock.current = false; setScanAttempt(value => value + 1); }
  }
  useEffect(() => {
    // A direct link or reload cannot restore an in-progress payment or PIN.
    if (!recipient && ['amount', 'review', 'pin', 'success'].includes(screen)) router.setParams({ screen: 'home' });
    else if (screen === 'pin' && !reviewConfirmed.current) router.setParams({ screen: 'review' });
  }, [screen, recipient]);
  useEffect(() => {
    microphoneBlocked.current = screen === 'pin';
    if (screen === 'pin') return () => { setPinLength(0); reviewConfirmed.current = false; };
  }, [screen]);
  function home() { setRecipient(null); setAmount(''); setChoices([]); submitLock.current = false; navigate('home'); }
  function back() {
    setError('');
    if (screen === 'contacts' && choices.length) { cancelInput(); setChoices([]); setQuery(''); setContactPage(0); return; }
    const targets: Partial<Record<Screen, Screen>> = { amount: 'contacts', review: 'amount', pin: 'review', history: 'account' };
    if (screen === 'home' || screen === 'success') home();
    else navigate(screen === 'amount' ? entrySource : targets[screen] || 'home');
  }
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove();
    // Back reads the current screen/recipient; amount changes do not alter its destination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, entrySource, choices.length]);
  function describe(): string {
    const common = 'Use Back at the top to return.';
    switch (screen) {
      case 'home': return 'Tap anywhere in the main area, then say Scan QR or Pay contacts. If voice input fails, manual buttons appear below. Never speak a payment PIN.';
      case 'scan': return permission?.granted ? `Point the rear camera at the payment QR. The recipient will be read when detected. ${common}` : 'Camera access needed. Choose Allow camera. Back returns home.';
      case 'contacts': return `Hold zero to ask PayAbl. Say a full contact name${choices.length ? ' or a displayed option number' : ''}, or use keys 1 to 9 for this page. Next shows more contacts. Phone contacts are demo recipients. ${common}`;
      case 'amount': return `Enter whole rupees from 1 to 100000. Hold zero to speak the amount; tap zero to enter zero. Next is at the bottom right. Delete is at the bottom left. ${Number(amount || 0)} rupees entered.`;
      case 'review': return `${reviewMessage()} Press Continue at the bottom right to confirm these details and open demo PIN practice. Hold zero for help. Never enter or speak a real payment PIN.`;
      case 'pin': return 'Demo PIN practice only. Tap any four practice keys, then Pay at the bottom right. Never use a real PIN. Microphone is disabled on this screen.';
      case 'success': return `Payment demo complete. ${Number(amount)} rupees to ${recipient?.name}. Done returns home.`;
      case 'history': return receipts.length ? `Demo activity. Select a receipt to hear its details. ${common}` : `No demo payments yet. ${common}`;
      case 'settings': return `Spoken guidance ${prefs.voice ? 'on' : 'off'}. Vibration ${prefs.haptics ? 'on' : 'off'}. Ask PayAbl only listens when you activate it.`;
      case 'account': return `Account. ${profile.name || 'Add your name'}. You can save your phone number, import contacts, allow microphone access, and hear payment history. Demo account. No bank is linked.`;
    }
  }
  function reviewMessage() { return `${Number(amount)} rupees to ${recipient ? recipientIdentity(recipient) : 'recipient'}.${recipient?.demo ? '' : ' Recipient name unverified.'}`; }
  function screenCue(): string {
    switch (screen) {
      case 'home': return 'Ask PayAbl. Tap anywhere in the main area to speak.';
      case 'scan': return 'Scan QR. Point the camera at the code.';
      case 'contacts': return 'Choose recipient. Hold zero to speak.';
      case 'amount': return `${recipient?.name ? `To ${recipient.name}. ` : ''}Enter amount. Hold zero to speak.`;
      case 'review': return reviewMessage() + ' Continue at bottom right. Hold zero for help.';
      case 'pin': return 'Demo PIN practice only. Never use a real PIN. Microphone disabled.';
      case 'success': return 'Payment demo complete.';
      default: return TITLES[screen] + '.';
    }
  }
  useEffect(() => {
    if (!ready || !foreground) return;
    speechMuted.current = false;
    buzz();
    const instructions = screenCue();
    lastMessage.current = instructions;
    cueTimer.current = setTimeout(() => speak(instructions), 350);
    return () => { if (cueTimer.current) clearTimeout(cueTimer.current); invalidateSpeech(); };
    // Screen cues run once per transition, never on digit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready, reader, foreground]);
  function report(message: string) { setError(message); voiceMessage(message); buzz('error'); }
  async function importContacts() {
    if (importingLock.current) return;
    const importScreen = currentScreen.current;
    cancelInput();
    importingLock.current = true; setImporting(true); setContactsAsked(true); setError('');
    try {
      const result = await importPhoneContacts();
      setContacts(result.contacts.length ? result.contacts : CONTACTS);
      if (currentScreen.current !== importScreen) return;
      setQuery(''); setChoices([]); setContactPage(0);
      voiceMessage(result.contacts.length ? `${result.contacts.length} contacts imported.${result.limited ? ' Only the contacts you allowed are available.' : ''}` : 'No phone contacts found. Sample contacts are available.');
    } catch (error) { if (currentScreen.current === importScreen) report(error instanceof Error ? error.message : 'Could not import contacts.'); }
    finally { importingLock.current = false; setImporting(false); }
  }
  async function allowVoice() {
    cancelInput();
    try {
      if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) return report('Voice payments need the installed Payabl app. Expo Go does not include speech recognition.');
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) return report('Allow microphone and speech recognition for Payabl in phone Settings.');
      if (Platform.OS === 'android' && !selectSpeechService(ExpoSpeechRecognitionModule.getSpeechRecognitionServices(), ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName)) return report(speechErrorMessage('service-not-allowed'));
      voiceMessage('Microphone allowed. Tap Ask PayAbl when you want to speak.');
    } catch { report('Voice input is unavailable. The contact buttons and keypad still work.'); }
  }
  function saveProfile(value: Profile) { setProfile(value); voiceMessage('Account saved.'); }
  function accountMessage(message: string) { if (!reader) speak(message, true); }
  function voiceStarted() { setVoiceStatus('Listening…'); buzz('ready'); }
  function select(c: Recipient, initialAmount = '', source: 'scan' | 'contacts' = 'contacts') { setEntrySource(source); setRecipient(c); setAmount(initialAmount); setChoices([]); submitLock.current = false; navigate('amount'); }
  async function prepareVoice() {
    if (screen === 'pin' || microphoneBlocked.current) throw new Error('Microphone is disabled during demo PIN practice.');
    if (cueTimer.current) clearTimeout(cueTimer.current);
    speechGeneration.current++; speechBusy.current = false;
    voiceListening.current = true; setListening(true); setError('');
    setVoiceStatus('Preparing microphone…');
    speechMuted.current = false;
    await stopSpeechForInput(Speech.stop, Speech.isSpeakingAsync);
  }
  const finishVoice = useCallback(() => { voiceListening.current = false; setListening(false); setVoiceStatus(''); }, []);
  const guideQR = useCallback((message: string) => {
    if (voiceListening.current || speechBusy.current || speechMuted.current || !foreground || !prefs.voice) return false;
    speak(message); return true;
  }, [speak, foreground, prefs.voice]);
  function voiceMessage(message: string) {
    if (cueTimer.current) clearTimeout(cueTimer.current);
    speak(message, true);
  }
  useEffect(() => {
    if (!ready || screen !== 'contacts' || contactsAsked || Platform.OS === 'web') return;
    const timer = setTimeout(() => { void importContacts(); }, 50);
    return () => clearTimeout(timer);
    // Request contacts once at first use, then let Account handle retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready, contactsAsked]);
  function chooseByName(name: string) {
    const exact = matchingContacts(name, contacts);
    const matches = exact.length ? exact : suggestedContacts(name, contacts);
    if (!matches.length) return report('No matching contact. Say the full name, or search the list.');
    if (exact.length === 1) { select(exact[0]); return; }
    setChoices(matches); setQuery(''); setContactPage(0);
    const options = matches.slice(0, 3).map((contact, index) => `Option ${index + 1}. ${recipientIdentity(contact)}.`).join(' ');
    voiceMessage(`${exact.length ? `${matches.length} matching contacts` : `Did you mean one of these contacts?`}. ${options} Say an option number or choose from the list.`);
  }
  useEffect(() => {
    if (!pendingName || screen !== 'contacts' || !ready || importing || (!contactsAsked && Platform.OS !== 'web')) return;
    const timer = setTimeout(() => { setPendingName(''); chooseByName(pendingName); }, 0);
    return () => clearTimeout(timer);
    // Resolve once after contact import has finished; do not guess before permission/import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingName, screen, ready, importing, contactsAsked, contacts]);
  function acceptVoice(text: string) {
    if (screen === 'pin' || microphoneBlocked.current) return;
    const intent = voiceIntent(text);
    switch (intent.type) {
      case 'stop': stopSpeaking(); return;
      case 'repeat': voiceMessage(lastMessage.current); return;
      case 'help': voiceMessage(describe()); return;
      case 'back': back(); return;
      case 'scan': setChoices([]); navigate('scan'); return;
      case 'contacts': setChoices([]); setQuery(''); navigate('contacts'); return;
      case 'recipient':
        setChoices([]); setQuery(''); navigate('contacts'); setPendingName(intent.name); return;
    }
    if (screen === 'contacts') {
      const index = contactChoice(text, pageContacts.length);
      if (index !== null) select(pageContacts[index]);
      else if (choices.length) report('Choose an option number, or tap the correct contact.');
      else chooseByName(text);
    } else if (screen === 'amount') {
      const value = spokenAmount(text);
      if (!value) return report('Could not understand the amount. Say a whole amount from 1 to 100000 rupees, or use the keypad.');
      setAmount(value); setError(''); buzz('success'); voiceMessage(`${Number(value)} rupees to ${recipient?.name}. Check the amount, then press Next.`);
    } else report(screen === 'review' ? 'Use the confirmation button after checking recipient and amount, or say Go back.' : 'Say Scan QR, Pay contacts, Send money to a name, or Help.');
  }
  function readReceipt(r: Receipt) { cancelInput(); speak('Demo payment ' + r.amount + ' rupees to ' + r.recipient.name + '. ' + new Date(r.time).toLocaleString('en-IN') + '. ', true); }
  function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    try { const p = parsePaymentQR(data); buzz('success'); select(p.recipient, p.amount, 'scan'); }
    catch (e) { report((e as Error).message); }
  }
  function retryScan() { cancelInput(); speechMuted.current = false; scanLock.current = false; setError(''); setScanAttempt(value => value + 1); }
  function confirm() {
    if (screen === 'contacts') {
      if ((contactPage + 1) * CONTACT_PAGE_SIZE < filteredContacts.length) { cancelInput(); setContactPage(page => page + 1); voiceMessage('Next contacts. Keys 1 to 9 select from this page.'); }
      return;
    }
    if (screen === 'amount') { if (!validAmount(amount)) return report('Enter 1 to 100000 whole rupees.'); navigate('review'); }
    else if (screen === 'review') {
      if (submitLock.current || !recipient || !validAmount(amount)) return;
      reviewConfirmed.current = true; navigate('pin');
    } else if (screen === 'pin') {
      if (pinLength !== 4 || !reviewConfirmed.current || submitLock.current || !recipient || !validAmount(amount)) return;
      submitLock.current = true;
      setReceipts(items => [{ id: `DEMO-${Date.now()}`, recipient, amount, time: new Date().toISOString() }, ...items].slice(0, 20));
      buzz('success'); navigate('success');
    } else if (screen === 'success') home(); else speak(describe(), true);
  }
  function keyPress(key: string) {
    if (key === '0' && zeroHeld.current) return;
    cancelInput();
    buzz(); setError('');
    if (key === 'confirm') return confirm();
    if (key === 'delete') {
      if (screen === 'amount') { const next = amount.slice(0, -1); setAmount(next); if (!reader && prefs.voice) speak('Deleted.', true); lastMessage.current = `${Number(next || 0)} rupees entered.`; }
      else if (screen === 'contacts' && contactPage > 0) { setContactPage(page => page - 1); voiceMessage('Previous contacts.'); }
      else back(); return;
    }
    if (screen === 'amount') { const next = appendDigit(amount, key); setAmount(next); if (next === amount && key !== '0') report('Maximum demo amount is 100000 rupees.'); else { lastMessage.current = `${Number(next || 0)} rupees entered.`; } return; }
    if (key === '0' && (screen === 'contacts' || screen === 'review')) { voiceMessage(describe()); return; }
    if (key === '0') return home();
    if (screen === 'home') { const links: Record<string, Screen> = { '1': 'scan', '2': 'contacts', '3': 'account', '4': 'settings' }; if (links[key]) navigate(links[key]); }
    else if (screen === 'contacts') { const index = contactKeyIndex(key, contactPage, filteredContacts.length); if (index !== null) select(filteredContacts[index]); else report('No contact on that key.'); }
    else if (screen === 'scan') {
      if (key === '1') requestPermission().catch(() => report('Could not request camera permission.'));
      else if (key === '2') select({ name: 'Corner Store', upi: 'cornerstore@demo', demo: true }, '', 'scan');
      else if (key === '5') { retryScan(); speak(describe(), true); }
    }
    else if (screen === 'success') { if (key === '3') navigate('history'); }
    else if (screen === 'history') { const r = receipts[Number(key) - 1]; if (r) speak(`Demo receipt. ${Number(r.amount)} rupees to ${r.recipient.name}. ${new Date(r.time).toLocaleString('en-IN')}. `, true); }
    else if (screen === 'settings') {
      if (key === '1') { setPrefs(p => ({ ...p, voice: !p.voice })); speak(`Voice guidance ${prefs.voice ? 'off' : 'on'}.`, true); }
      else if (key === '2') { const enabled = !prefs.haptics; setPrefs(p => ({ ...p, haptics: enabled })); buzz('success', enabled); speak(`Haptics ${enabled ? 'on' : 'off'}.`, true); }
    }
  }
  function keyLabel(key: string): string {
    if (key === 'delete') return screen === 'amount' || screen === 'pin' ? 'Delete last digit' : 'Back';
    if (key === 'confirm') return screen === 'contacts' ? 'Next contacts' : screen === 'review' ? 'Confirm details and continue to demo PIN' : screen === 'pin' ? 'Confirm demo payment' : 'Review amount';
    if (screen === 'pin') return `Private practice key. Row ${Math.floor(KEYS.indexOf(key) / 3) + 1}, column ${KEYS.indexOf(key) % 3 + 1}`;
    if (screen === 'contacts' && /^[1-9]$/.test(key)) return `${key}. ${pageContacts[Number(key) - 1] ? recipientIdentity(pageContacts[Number(key) - 1]) : 'No contact'}`;
    const labels: Partial<Record<Screen, Record<string, string>>> = {
      home: { '1': 'Scan QR', '2': 'Pay family', '3': 'Account', '4': 'Settings', '0': 'Home' },
      contacts: Object.fromEntries(contacts.map((c, i) => [String(i + 1), c.name])),
      settings: { '1': 'Spoken guidance', '2': 'Haptics', '3': 'Automatic voice', '0': 'Home' },
      scan: { '1': 'Allow camera', '2': 'Try sample', '5': 'Retry scan', '0': 'Home' },
    }; return labels[screen]?.[key] || key;
  }
  function content() {
    if (screen === 'home') return <View style={s.homeActions}>
      {assistantControl(true)}
      {!!error && <Text style={s.error}>{error}</Text>}
      {!!error && <><Action title="Scan QR" light onPress={() => navigate('scan')} />
      <Action title="Pay contacts" onPress={() => { setChoices([]); setQuery(''); navigate('contacts'); }} /></>}
    </View>;
    if (screen === 'scan') return <>
      <Text style={s.body}>Point the rear camera at the QR.</Text>
      {permission?.granted && foreground && !error && !listening ? <GuidedQRScanner key={scanAttempt} enabled haptics={prefs.haptics} onRead={scan} onGuide={guideQR} onError={report} /> : <View style={s.scanSurface}><View style={s.cameraPlaceholder}><Text style={s.body}>{permission?.granted ? 'Camera paused' : 'Camera access needed'}</Text></View></View>}
      {!permission?.granted && <Action title="Allow camera" light onPress={() => keyPress('1')} />}
      {permission?.status === 'denied' && !permission.canAskAgain && <Action title="Open camera settings" onPress={() => { void Linking.openSettings().catch(() => report('Open phone Settings and allow camera access for Payabl.')); }} />}
      {!!error && <Action title="Scan again" onPress={retryScan} />}
    </>;
    if (screen === 'contacts') return <View style={s.contactList}>
      {importing && <Text accessibilityLiveRegion="polite" style={s.body}>Importing contacts…</Text>}
      {!!choices.length && <><Text style={s.body}>Check the name and phone number or UPI ID, then choose an option.</Text><Action title="Show all contacts" onPress={() => { cancelInput(); setChoices([]); setQuery(''); setContactPage(0); }} /></>}
      <TextInput {...assistantAction} accessibilityLabel="Search contacts by name or phone" placeholder="Search contacts" placeholderTextColor={C.muted} value={query} onFocus={cancelInput} onChangeText={value => { cancelInput(); setChoices([]); setQuery(value); setContactPage(0); }} style={s.search} />
      <Text style={s.caption}>Hold 0 to speak. Keys 1–9 choose from this page.</Text>
      {pageContacts.map((c, i) => <ContactRow key={`${c.phone || c.upi}-${i}`} contact={c} onSelect={select} option={i + 1} />)}
      {!filteredContacts.length && <Text style={s.body}>No matching contacts.</Text>}
      {(contactPage + 1) * CONTACT_PAGE_SIZE < filteredContacts.length && <Action title="More contacts" onPress={confirm} />}
    </View>;
    if (screen === 'amount') return <>
      <Text style={s.payeeName}>To {recipient?.name}</Text>
      <Text style={s.caption}>{recipient?.phone || recipient?.upi}</Text>
      <Text {...assistantAction} accessible accessibilityLabel={Number(amount || 0) + ' rupees'} style={s.paymentAmount}>{rupees(amount)}</Text>
      {!recipient?.demo && <Text style={s.body}>Recipient name unverified. Check the UPI ID on the next screen.</Text>}
    </>;
    if (screen === 'review') return <View style={s.paymentDetails}>
      <Text style={s.paymentAmount}>{rupees(amount)}</Text><Text style={s.payeeName}>To {recipient?.name}</Text><Text style={s.body}>{recipient?.upi || recipient?.phone}</Text>{!recipient?.demo && <Text style={s.body}>Name unverified</Text>}
    </View>;
    if (screen === 'pin') return <>
      <Text style={s.payeeName}>{rupees(amount)} to {recipient?.name}</Text>
      <View testID="demo-pin-count" accessible accessibilityLabel={`${pinLength} of 4 demo practice taps entered`} accessibilityLiveRegion="polite" style={s.pinRow}>{[0, 1, 2, 3].map(i => <View key={i} style={[s.pinSlot, i < pinLength && s.pinFilled]} />)}</View>
      <Text style={s.caption}>Microphone disabled</Text>
    </>;
    if (screen === 'success') return <View style={s.paymentDetails}><Text style={s.paymentAmount}>{rupees(amount)}</Text><Text style={s.payeeName}>To {recipient?.name}</Text></View>;
    if (screen === 'history') return <>
      {!receipts.length && <Text style={s.body}>No payments yet.</Text>}
      {receipts.map(r => <ReceiptRow key={r.id} receipt={r} onRead={readReceipt} />)}
    </>;
    if (screen === 'settings') return <>
      <Pressable accessibilityRole="switch" accessibilityLabel="Spoken guidance" accessibilityState={{ checked: prefs.voice }} onPress={() => keyPress('1')} style={s.setting}><Text style={[s.body, s.grow]}>Spoken guidance</Text><Text style={s.body}>{prefs.voice ? 'On' : 'Off'}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Vibration" accessibilityState={{ checked: prefs.haptics }} onPress={() => keyPress('2')} style={s.setting}><Text style={[s.body, s.grow]}>Vibration</Text><Text style={s.body}>{prefs.haptics ? 'On' : 'Off'}</Text></Pressable>
      <Text style={s.body}>Tap Ask PayAbl to speak. Say Help for instructions or Repeat to hear the last message.</Text>
      <Action title="Phone permissions" onPress={() => { if (Platform.OS === 'web') report('Manage permissions in your browser or open Payabl on your phone.'); else Linking.openSettings().catch(() => report('Open your phone Settings and select Payabl.')); }} />
    </>;
    if (screen === 'account') return <AccountPage profile={profile} contactCount={contacts.filter(contact => contact.phone).length} busy={importing} onInteract={() => { buzz(); cancelInput(); }} onSave={saveProfile} onImport={importContacts} onVoice={allowVoice} onHistory={() => navigate('history')} onMessage={accountMessage} />;
    return null;
  }
  function ask() { if (screen !== 'pin' && !microphoneBlocked.current) voiceInput.current?.start(); }
  function holdZero() {
    if (!canHoldToAsk(screen) || zeroHeld.current || !ready || !foreground || importing || microphoneBlocked.current) return;
    zeroHeld.current = true;
    if (!voiceListening.current) ask();
  }
  function demoKey(action: 'tap' | 'delete') {
    cancelInput(); buzz(); setError('');
    setPinLength(count => demoTapCount(count, action));
    if (!reader && prefs.voice) speak(action === 'tap' ? 'Digit entered.' : 'Digit removed.', true);
  }
  const assistantAction = screen === 'pin' ? {} : { accessibilityActions: [{ name: 'askPayabl', label: 'Ask PayAbl' }], onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => { if (event.nativeEvent.actionName === 'askPayabl') ask(); } };
  function assistantControl(expanded = false) {
    return <VoiceInput key={screen} ref={voiceInput} label="Ask PayAbl" expanded={expanded} compact={!expanded} shortcutOnly={canHoldToAsk(screen)} disabled={!ready || importing || !foreground || screen === 'pin'}
      phrases={['Scan QR', 'Pay contacts', 'Pay to contacts', 'Open contacts', 'Send money to', 'Repeat', 'Stop speaking', 'Go back', 'Help', ...contacts.slice(0, 100).map(c => c.name)]}
      onPrepare={prepareVoice} onFinish={finishVoice} onStarted={voiceStarted} onResult={acceptVoice} onMessage={report} />;
  }
  const phone = <View style={[s.phone, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
    <View style={s.header}>{screen === 'home' ? <><Text {...assistantAction} accessible accessibilityRole="header" accessibilityLabel="Payabl" style={s.wordmark}>payabl<Text style={s.wordmarkDot}>.</Text></Text><View style={s.headerActions}><Pressable {...assistantAction} accessibilityRole="button" accessibilityLabel="Account" onPress={() => navigate('account')} style={s.iconButton}><Icon name="user" size={28} /></Pressable><Pressable {...assistantAction} accessibilityRole="button" accessibilityLabel="Settings" onPress={() => navigate('settings')} style={s.iconButton}><Icon name="settings" size={28} /></Pressable></View></> : <><Pressable {...assistantAction} accessibilityRole="button" accessibilityLabel="Back" onPress={() => { buzz(); back(); }} style={s.headerButton}><Text style={s.headerText}>Back</Text></Pressable></>}
      <Pressable {...assistantAction} accessibilityRole="button" accessibilityLabel="Stop speaking" onPress={() => { buzz(); cancelInput(); }} style={s.iconButton}><Icon name="volume-x" /></Pressable>
    </View>
    {screen === 'home' ? content() : <ScrollView key={screen} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" style={s.content} contentContainerStyle={s.contentInner} showsVerticalScrollIndicator={false}><Text {...assistantAction} accessible accessibilityRole="header" style={s.title}>{TITLES[screen]}</Text>{content()}{!!voiceStatus && <Text accessibilityLiveRegion="polite" style={s.caption}>{voiceStatus}</Text>}{!!error && <><Text style={s.error}>{error}</Text>{Platform.OS !== 'web' && screen !== 'pin' && <Action title="Open phone settings" onPress={() => { cancelInput(); void Linking.openSettings().catch(() => report('Open phone Settings and allow microphone access for PayAbl.')); }} />}</>}</ScrollView>}
    {screen === 'success' && <View style={s.primaryFooter}><Action title="Done" light onPress={home} /></View>}
    {showKeypad && <View style={s.keypadContainer}><View testID="fixed-keypad" style={[s.keypad, { height: keypadHeight, width: '100%' }]}>{KEYS.map(key => {
      const label = keyLabel(key); const isConfirm = key === 'confirm';
      const hasHold = key === '0' && canHoldToAsk(screen);
      const disabled = importing || (screen === 'review' && /^[1-9]$/.test(key)) || (screen === 'contacts' && /^[1-9]$/.test(key) && !pageContacts[Number(key) - 1]) || (isConfirm && (screen === 'contacts' ? (contactPage + 1) * CONTACT_PAGE_SIZE >= filteredContacts.length : screen === 'pin' ? pinLength !== 4 : !validAmount(amount)));
      const actions = hasHold ? { accessibilityActions: [{ name: 'askPayabl', label: 'Ask PayAbl' }, { name: 'longpress', label: 'Hold zero to ask PayAbl' }], onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => { if (event.nativeEvent.actionName === 'longpress' || event.nativeEvent.actionName === 'askPayabl') { zeroHeld.current = false; holdZero(); } } } : assistantAction;
      return <Pressable {...actions} key={key} testID={`key-${key}`} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hasHold ? 'Hold for Ask PayAbl. With TalkBack, double-tap and hold, or use the Ask PayAbl action.' : undefined} accessibilityState={{ disabled }} disabled={disabled}
        onPressIn={() => { zeroHeld.current = false; }} delayLongPress={HOLD_TO_ASK_MS} onLongPress={hasHold ? holdZero : undefined}
        onPress={() => { if (screen === 'pin') { if (key === 'confirm') confirm(); else demoKey(key === 'delete' ? 'delete' : 'tap'); } else keyPress(key); }}
        style={({ pressed }) => [s.key, isConfirm && s.confirmKey, key === '5' && s.anchorKey, disabled && s.disabledKey, pressed && s.keyPressed]}>{key === 'delete' || isConfirm ? <><Icon name={isConfirm ? screen === 'pin' ? 'check' : 'arrow-right' : 'delete'} size={29} color={isConfirm && !disabled ? C.bg : C.white} /><Text maxFontSizeMultiplier={1.2} style={[s.specialLabel, isConfirm && !disabled && { color: C.bg }]}>{isConfirm ? screen === 'pin' ? 'Pay' : screen === 'review' ? 'Continue' : 'Next' : screen === 'contacts' || screen === 'review' ? 'Back' : 'Delete'}</Text></> : <><Text maxFontSizeMultiplier={1.2} style={s.keyDigit}>{key}</Text>{key === '5' && <View accessible={false} style={s.anchorDot} />}</>}</Pressable>;
    })}</View></View>}
    {screen !== 'home' && <View style={s.assistantFooter}>{screen !== 'pin' && assistantControl()}{showKeypad && <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.assistantSpacer} />}</View>}
  </View>;
  return <FeedbackContext.Provider value={buzz}><AssistantContext.Provider value={screen === 'pin' ? null : ask}><View style={s.root}><StatusBar style="light" /><View style={s.phoneFrame}>{phone}</View></View></AssistantContext.Provider></FeedbackContext.Provider>;

}
export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const s = StyleSheet.create({
  assistantFooter: { paddingHorizontal: 16, paddingTop: 12, height: 76, flexShrink: 0 },
  assistantSpacer: { height: 64 },
  pinRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', paddingVertical: 24 }, pinSlot: { width: 24, height: 24, borderWidth: 2, borderColor: C.white, borderRadius: 12 }, pinFilled: { backgroundColor: C.white },
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center' }, phoneFrame: { flex: 1, minHeight: 0, width: '100%', maxWidth: 460 }, phone: { flex: 1, minHeight: 0, backgroundColor: C.bg },
  header: { minHeight: 72, flexShrink: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerActions: { flexDirection: 'row', gap: 8 }, iconButton: { width: 56, minHeight: 64, alignItems: 'center', justifyContent: 'center' }, headerButton: { minWidth: 96, minHeight: 64, alignItems: 'center', justifyContent: 'center' }, headerText: { color: C.white, fontSize: 22, fontWeight: '600' }, wordmark: { color: C.white, fontSize: 32, lineHeight: 42, fontWeight: '700', letterSpacing: -1.5, flexShrink: 1 }, wordmarkDot: { color: C.muted }, search: { minHeight: 64, padding: 16, borderWidth: 2, borderColor: C.white, borderRadius: 20, color: C.white, fontSize: 22 },
  homeActions: { flex: 1, minHeight: 0, padding: 20, gap: 20 }, mainAction: { flex: 1, minHeight: 120, borderWidth: 2, borderColor: C.white, borderRadius: 28, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', padding: 20 }, mainActionText: { color: C.white, fontSize: 36, lineHeight: 48, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, light: { backgroundColor: C.white }, pressed: { opacity: .65 },
  content: { flex: 1 }, contentInner: { padding: 20, gap: 24, paddingBottom: 28 }, title: { color: C.white, fontSize: 28, lineHeight: 36, fontWeight: '600' }, body: { color: C.white, fontSize: 20, lineHeight: 29 }, caption: { color: C.muted, fontSize: 16, lineHeight: 24 }, grow: { flex: 1 },
  action: { minHeight: 72, padding: 20, borderWidth: 2, borderColor: C.white, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, actionText: { color: C.white, fontSize: 22, lineHeight: 30, fontWeight: '600', flexShrink: 1 }, primaryFooter: { padding: 16, paddingBottom: 8 },
  contactList: { gap: 16 }, personRow: { minHeight: 104, padding: 24, borderWidth: 2, borderColor: C.white, borderRadius: 8, justifyContent: 'center' }, personName: { color: C.white, fontSize: 26, lineHeight: 34, fontWeight: '600' }, payeeName: { color: C.white, fontSize: 26, lineHeight: 34 }, paymentAmount: { color: C.white, fontSize: 58, lineHeight: 72, fontWeight: '600', marginVertical: 16 }, paymentDetails: { gap: 24, paddingTop: 16 },
  scanSurface: { height: 320, backgroundColor: C.card, overflow: 'hidden', borderWidth: 1, borderColor: C.line }, cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, scanGuide: { position: 'absolute', top: '20%', bottom: '20%', left: '15%', right: '15%', borderWidth: 3, borderColor: C.white },
  keypadContainer: { paddingHorizontal: 16, alignItems: 'center', backgroundColor: C.bg }, keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' }, key: { width: '31.9%', height: '23.2%', borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: '#777', justifyContent: 'center', alignItems: 'center' }, keyDigit: { color: C.white, fontSize: 32, lineHeight: 38, fontWeight: '600' }, keyHint: { color: C.white, fontSize: 12, marginTop: 1, maxWidth: '94%' }, specialLabel: { color: C.white, fontSize: 13, marginTop: 2, fontWeight: '600' }, confirmKey: { backgroundColor: C.white, borderColor: C.white }, anchorKey: { borderColor: C.white, borderWidth: 2 }, anchorDot: { height: 3, width: 12, backgroundColor: C.white, position: 'absolute', bottom: 5 }, keyPressed: { opacity: .65 }, disabledKey: { backgroundColor: C.card, borderColor: '#777' },
  receipt: { flexDirection: 'row', gap: 12, paddingVertical: 24, borderBottomWidth: 1, borderColor: C.line, alignItems: 'center' }, receiptAmount: { color: C.white, fontSize: 23, fontWeight: '600' }, setting: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 72, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.line }, practiceDigit: { color: C.white, fontSize: 44, lineHeight: 56, textAlign: 'center', paddingVertical: 24 }, error: { color: C.white, fontSize: 20, lineHeight: 29, padding: 16, borderWidth: 2, borderColor: C.white },
});
