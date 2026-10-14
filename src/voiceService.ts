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

// Some Android TTS engines never deliver onDone. Do not let them block the mic.
export function boundedPrompt(play: (done: () => void) => void, maxMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, maxMs);
    const done = () => { clearTimeout(timer); resolve(); };
    try { play(done); } catch (error) { clearTimeout(timer); reject(error); }
  });
}
