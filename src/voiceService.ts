export function selectSpeechService(services: string[], preferred: string): string | undefined {
  // Respect the user's configured recognizer, including non-Google services.
  return [preferred, 'com.google.android.tts', 'com.google.android.googlequicksearchbox', ...services]
    .find(service => !!service && services.includes(service));
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed': return 'Allow microphone access for Payabl in Settings, and turn on the phone’s microphone privacy switch.';
    case 'service-not-allowed': return 'Enable Google or Speech Recognition & Synthesis in phone Settings, then try again.';
    case 'audio-capture': return 'The phone could not open the microphone. Close other recording apps and check the microphone privacy switch.';
    case 'busy': case 'interrupted': return 'The microphone is busy. Finish the assistant or phone call, then try again.';
    case 'network': return 'The speech service could not connect. Check your internet connection and try again.';
    case 'language-not-supported': return 'Enable English in your phone’s speech recognition settings, then try again.';
    case 'client': return 'The phone’s speech service stopped unexpectedly. Update Google and Speech Recognition & Synthesis, then try again.';
    default: return 'No speech received. Speak after the vibration, or use the buttons.';
  }
}

// A stalled native speech operation must not leave Ask PayAbl preparing forever.
export function withSpeechDeadline<T>(operation: Promise<T>, maxMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Spoken guidance did not stop. Tap Stop speaking, then try again.')), maxMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

// Verify quiet rather than depending on a cold Android engine's stop promise.
export async function stopSpeechForInput(stop: () => Promise<void>, isSpeaking: () => Promise<boolean>, maxMs = 8000, intervalMs = 100): Promise<void> {
  void stop().catch(() => {});
  const deadline = Date.now() + maxMs;
  let quiet = 0;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const speaking = await withSpeechDeadline(isSpeaking(), Math.max(1, deadline - Date.now()));
    quiet = speaking ? 0 : quiet + 1;
    if (quiet >= 2) return;
  }
  throw new Error('Spoken guidance is still active. Stop speaking, then try again.');
}
