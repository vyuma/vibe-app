export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'vibeapp://');
    if (url.protocol === 'vibeapp:' && (url.hostname === 'pair' || url.pathname === '/pair')) {
      return `/pairing-test?pairingLink=${encodeURIComponent(url.toString())}&intent=${Date.now()}`;
    }
    return path;
  } catch {
    return '/pairing-test';
  }
}
