import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Speech from 'expo-speech';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { boundedPrompt, selectSpeechService, speechErrorMessage } from './voiceService';

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
  const starting = useRef(false);
  const requestingPermission = useRef(false);

  const clear = useCallback(() => {
    session.current++;
    starting.current = false;
    if (timeout.current) clearTimeout(timeout.current);
    listeners.current.splice(0).forEach(listener => listener.remove());
    module.current?.abort();
    void Speech.stop();
    onFinish();
  }, [onFinish]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      // Permission sheets on some Android phones background the activity.
      if (state === 'background' && !requestingPermission.current) { clear(); setActive(false); setMessage(''); }
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
    if (active || starting.current) { clear(); setActive(false); setMessage(''); return; }
    clear();
    starting.current = true;
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
      requestingPermission.current = true;
      const permission = await recognition.requestPermissionsAsync().finally(() => { requestingPermission.current = false; });
      if (token !== session.current) return;
      if (!permission.granted) {
        setSettings(Platform.OS !== 'web' && !permission.canAskAgain);
        throw new Error('Allow microphone and speech recognition to use voice input.');
      }
      if (AppState.currentState === 'background') throw new Error('Return to Payabl and tap Speak to start the microphone.');
      const service = Platform.OS === 'android'
        ? selectSpeechService(recognition.getSpeechRecognitionServices(), recognition.getDefaultRecognitionService().packageName)
        : undefined;
      if (Platform.OS === 'android' ? !service : !recognition.isRecognitionAvailable()) {
        setSettings(Platform.OS !== 'web');
        throw new Error(speechErrorMessage('service-not-allowed'));
      }
      await Speech.stop();
      if (token !== session.current) return;
      await boundedPrompt(done => Speech.speak(prompt, { language: 'en-IN', volume: 1, rate: .9, useApplicationAudioSession: false, onDone: done, onStopped: done, onError: done }));
      if (token !== session.current) return;
      await Speech.stop();
      // Release TTS/assistant audio before the Android recognizer takes focus.
      await new Promise(resolve => setTimeout(resolve, 250));
      if (token !== session.current) return;
      let received = false;
      let retried = false;
      let retrying = false;
      let currentService = service;
      let language = 'en-IN';
      const fail = (text: string) => {
        if (token !== session.current) return;
        clear(); setActive(false); setMessage(text); onMessage(text);
      };
      const beginRecognition = () => {
        if (token !== session.current) return;
        timeout.current = setTimeout(() => fail('Listening stopped. Try again or use the buttons.'), 15000);
        try {
          recognition.start({ lang: language, interimResults: true, continuous: false, maxAlternatives: 1, contextualStrings: phrases, androidRecognitionServicePackage: currentService, recordingOptions: { persist: false } });
        } catch { fail('The speech service could not start. Check your phone’s speech recognition settings.'); }
      };
      listeners.current = [
        recognition.addListener('start', () => { if (token === session.current) { retrying = false; setMessage('Listening…'); onStarted(); } }),
        recognition.addListener('result', event => {
          if (token !== session.current || !event.isFinal || received) return;
          const text = event.results[0]?.transcript?.trim();
          if (!text) return;
          received = true;
          clear(); setActive(false); setMessage(''); onResult(text);
        }),
        recognition.addListener('error', event => {
          if (token !== session.current) return;
          if (event.error === 'aborted') return;
          const alternate = Platform.OS === 'android'
            ? selectSpeechService(recognition.getSpeechRecognitionServices().filter(item => item !== currentService), '')
            : undefined;
          // Xiaomi/vendor recognizers can fail with a client/service error even
          // after permission is granted. Retry once with another installed service.
          const switchService = ['client', 'service-not-allowed'].includes(event.error) && !!alternate;
          const switchLanguage = event.error === 'language-not-supported';
          if (Platform.OS === 'android' && !retried && (switchService || switchLanguage || event.error === 'busy')) {
            retried = true; retrying = true;
            if (switchService) currentService = alternate;
            if (switchLanguage) language = 'en-US';
            if (timeout.current) clearTimeout(timeout.current);
            setMessage('Restarting speech recognition…');
            recognition.abort();
            timeout.current = setTimeout(beginRecognition, 600);
            return;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') setSettings(Platform.OS !== 'web');
          fail(speechErrorMessage(event.error));
        }),
        recognition.addListener('end', () => { if (!received && !retrying) fail('No speech received. Try again or use the buttons.'); }),
      ];
      beginRecognition();
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
