let audioContext: AudioContext | null = null;

export function supportsWebVibration() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

// Call from a button press so the browser can unlock sound and vibration.
export async function enableWebPostureAlerts() {
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextClass) {
    audioContext ??= new AudioContextClass();
    await audioContext.resume();
  }
}

export function startWebPostureAlert() {
  let tone: OscillatorNode | null = null;
  function stopPulse() {
    if (supportsWebVibration()) navigator.vibrate(0);
    tone?.stop();
    tone = null;
  }
  function pulse() {
    if (document.hidden) {
      stopPulse();
      return;
    }
    if (supportsWebVibration()) navigator.vibrate([150, 100, 150]);
    if (audioContext?.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    tone = oscillator;
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (tone === oscillator) tone = null;
    };
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }
  pulse();
  const timer = window.setInterval(pulse, 1500);
  document.addEventListener("visibilitychange", pulse);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", pulse);
    stopPulse();
  };
}
