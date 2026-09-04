// Client-side private-key generation.
//
// The key is created locally in the browser with the platform CSPRNG
// (crypto.getRandomValues) and shown to the user exactly once. It is
// stored in localStorage for re-unlock and transmitted over the wire
// only when unlocking; the server keeps just its SHA-256 fingerprint.

const STORAGE_KEY = 'nnx_private_key';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePrivateKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `nnx_${toBase64Url(bytes)}`;
}

export function savePrivateKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function loadPrivateKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPrivateKey() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
