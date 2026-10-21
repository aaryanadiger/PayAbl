import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { QR_HINTS, QR_PATTERNS, qrDirection, shouldAnnounceQR, trackQR, type QRTrack } from './qrGuidance';

export default function GuidedQRScanner({ enabled, haptics, onRead, onGuide, onError }: {
  enabled: boolean; haptics: boolean; onRead: (data: string) => void;
  onGuide: (message: string) => boolean; onError: (message: string) => void;
}) {
  const [hint, setHint] = useState('Searching for a QR. Move the phone slowly.');
  const [detected, setDetected] = useState('');
  const size = useRef({ width: 0, height: 0 });
  const track = useRef<QRTrack | null>(null);
  const feedback = useRef({ time: 0, direction: '' });
  const lastBuzz = useRef(0);
  const accepted = useRef(false);
  useEffect(() => {
    if (!enabled) { track.current = null; Vibration.cancel(); return; }
    const timer = setInterval(() => {
      if (track.current && Date.now() - track.current.seen > 1500) {
        track.current = null; setDetected(''); Vibration.cancel();
        const message = 'QR lost. Move the phone slowly to find it again.';
        setHint(message); onGuide(message);
      }
    }, 500);
    return () => { clearInterval(timer); Vibration.cancel(); };
  }, [enabled, onGuide]);
  useEffect(() => { if (!haptics) Vibration.cancel(); }, [haptics]);

  function read(data: string) {
    if (accepted.current || !enabled) return;
    accepted.current = true; Vibration.cancel(); onRead(data);
  }
  function found(event: BarcodeScanningResult) {
    if (!enabled || accepted.current || !event.data) return;
    const now = Date.now();
    const direction = qrDirection(event.bounds, event.cornerPoints, size.current);
    const next = trackQR(track.current, event.data, direction, now);
    track.current = next.track; setDetected(event.data);
    const message = QR_HINTS[direction]; setHint(message);
    if (now - lastBuzz.current >= 1000) {
      lastBuzz.current = now;
      const announce = shouldAnnounceQR(feedback.current, direction, now);
      if (haptics && Platform.OS === 'android') Vibration.vibrate(QR_PATTERNS[direction]);
      else if (haptics && Platform.OS === 'ios') void Haptics.impactAsync(direction === 'center' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Do not interrupt the same spoken direction every camera frame.
      if (announce && onGuide(message)) feedback.current = { time: now, direction };
    }
    if (next.accept) read(event.data);
  }
  return <View style={styles.container}>
    <View style={styles.camera} onLayout={event => { size.current = event.nativeEvent.layout; }}>
      {enabled && <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={found} onMountError={() => onError('Camera could not start. Close other camera apps and try again.')} />}
      <View pointerEvents="none" style={styles.target} />
    </View>
    <Text style={styles.text}>{hint}</Text>
    <Text style={styles.legend}>Buzz guide: left 1 short, right 2 short, up 1 long, down 2 long. Center: 3 short.</Text>
    {enabled && !!detected && <Pressable accessibilityRole="button" accessibilityLabel="Read detected QR" onPress={() => read(detected)} style={styles.button}><Text style={styles.text}>Read detected QR</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 16 }, camera: { height: 320, backgroundColor: '#1e1e1e', overflow: 'hidden' },
  target: { position: 'absolute', top: '20%', bottom: '20%', left: '15%', right: '15%', borderWidth: 3, borderColor: '#f5f5f5' },
  text: { color: '#f5f5f5', fontSize: 20, lineHeight: 29 }, legend: { color: '#b9b9b9', fontSize: 16, lineHeight: 24 },
  button: { padding: 20, minHeight: 72, borderWidth: 2, borderColor: '#f5f5f5', borderRadius: 8, alignItems: 'center' },
});
