import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Speech from 'expo-speech';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type Recognition = typeof ExpoSpeechRecognitionModule;
type Subscription = { remove: () => void };

export default function VoiceInput({ label, phrases, onResult, onPrepare, onMessage, onFinish, onStarted, autoStart = false, prompt }: {
  label: string; phrases: string[]; onResult: (text: string) => void;
  onPrepare: () => void; onMessage: (message: string) => void; onFinish: () => void;
  onStarted: () => void; autoStart?: boolean; prompt: string;
}) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(false);
  const session = useRef(0);
  const module = useRef<Recognition | null>(null);
  const listeners = useRef<Subscription[]>([]);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<() => Promise<void>>(async () => {});

  const clear = useCallback(() => {
    session.current++;
    if (timeout.current) clearTimeout(timeout.current);
    listeners.current.splice(0).forEach(listener => listener.remove());
    module.current?.abort();
    onFinish();
  }, [onFinish]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') { clear(); setActive(false); setMessage(''); }
    });
    return () => { listener.remove(); clear(); };
  }, [clear]);
  useEffect(() => { startRef.current = start; });
  useEffect(() => {
    if (!autoStart || Platform.OS === 'web' || !requireOptionalNativeModule('ExpoSpeechRecognition')) return;
    const timer = setTimeout(() => { void startRef.current(); }, 1000);
    return () => clearTimeout(timer);
  }, [autoStart]);

  async function start() {
    if (active) { clear(); setActive(false); setMessage(''); return; }
    clear();
    const token = session.current;
    setActive(true); setMessage('Preparing microphone…'); setSettings(false);
    onPrepare();
    try {
      if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
        throw new Error('Voice input needs the Payabl development app. It is not available in Expo Go.');
      }
      const { ExpoSpeechRecognitionModule: recognition } = await import('expo-speech-recognition');
      if (token !== session.current) return;
      module.current = recognition;
      if (!recognition.isRecognitionAvailable()) throw new Error('Speech recognition is unavailable on this device. Use the keypad or contact buttons.');
      const permission = await recognition.requestPermissionsAsync();
      if (token !== session.current) return;
      if (!permission.granted) {
        setSettings(Platform.OS !== 'web' && !permission.canAskAgain);
        throw new Error('Allow microphone and speech recognition to use voice input.');
      }
      await Speech.stop();
      await new Promise<void>(resolve => Speech.speak(prompt, { language: 'en-IN', volume: 1, rate: .9, useApplicationAudioSession: false, onDone: resolve, onStopped: resolve, onError: () => resolve() }));
      if (token !== session.current) return;
      let received = false;
      const fail = (text: string) => {
        if (token !== session.current) return;
        clear(); setActive(false); setMessage(text); onMessage(text);
      };
      listeners.current = [
        recognition.addListener('start', () => { if (token === session.current) { setMessage('Listening…'); onStarted(); } }),
        recognition.addListener('result', event => {
          if (token !== session.current || !event.isFinal || received) return;
          const text = event.results[0]?.transcript?.trim();
          if (!text) return;
          received = true;
          clear(); setActive(false); setMessage(''); onResult(text);
        }),
        recognition.addListener('error', event => {
          if (event.error === 'aborted') return;
          if (event.error === 'not-allowed') setSettings(Platform.OS !== 'web');
          fail(event.error === 'not-allowed' ? 'Allow microphone and speech recognition in Settings.' : event.error === 'network' ? 'Speech recognition needs a connection. Try again or use the keypad.' : 'Could not hear you. Try again or use the buttons.');
        }),
        recognition.addListener('end', () => { if (!received) fail('No speech received. Try again or use the buttons.'); }),
      ];
      recognition.start({ lang: 'en-IN', interimResults: false, continuous: false, maxAlternatives: 1, contextualStrings: phrases, recordingOptions: { persist: false } });
      timeout.current = setTimeout(() => fail('Listening stopped. Try again or use the buttons.'), 15000);
    } catch (error) {
      if (token !== session.current) return;
      clear(); setActive(false);
      const text = error instanceof Error ? error.message : 'Could not start voice input.';
      setMessage(text); onMessage(text);
    }
  }
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Cancel voice input' : label} onPress={start} style={styles.button}><Text style={styles.text}>{active ? 'Cancel listening' : label}</Text></Pressable>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {settings && <Pressable accessibilityRole="button" onPress={() => Linking.openSettings().catch(() => onMessage('Open your device Settings to allow microphone and speech recognition.'))} style={styles.button}><Text style={styles.text}>Open Settings</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, button: { minHeight: 64, padding: 16, borderWidth: 2, borderColor: '#f5f5f5', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#f5f5f5', fontSize: 22, fontWeight: '600' }, message: { color: '#f5f5f5', fontSize: 18, lineHeight: 26 },
});
