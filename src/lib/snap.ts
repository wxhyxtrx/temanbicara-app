import type { SnapPayCallbacks } from '@/types/midtrans';

const SNAP_SCRIPT_URL = 'https://app.sandbox.midtrans.com/snap/snap.js';
const CLIENT_KEY = process.env.NEXT_PUBLIC_PAYMENT_CLIENT_KEY || 'SB-Mid-client-rIrlvZvI6nm57Qa1';

let snapPromise: Promise<void> | null = null;

export function loadSnapScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.snap) {
    return Promise.resolve();
  }

  if (snapPromise) {
    return snapPromise;
  }

  snapPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${SNAP_SCRIPT_URL}"]`);
    if (existingScript) {
      if (window.snap) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Gagal memuat script Midtrans Snap')));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = SNAP_SCRIPT_URL;
    script.setAttribute('data-client-key', CLIENT_KEY);
    script.async = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      snapPromise = null;
      reject(new Error('Gagal mengunduh modul pembayaran Midtrans Snap'));
    };

    document.head.appendChild(script);
  });

  return snapPromise;
}

export async function openSnapModal(snapToken: string, callbacks: SnapPayCallbacks = {}): Promise<void> {
  await loadSnapScript();

  if (!window.snap) {
    throw new Error('Midtrans Snap SDK belum siap digunakan');
  }

  window.snap.pay(snapToken, callbacks);
}
