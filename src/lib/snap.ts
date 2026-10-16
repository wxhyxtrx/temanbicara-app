import type { SnapPayCallbacks } from '@/types/midtrans';

let snapPromise: Promise<void> | null = null;

function getSnapConfig(): { scriptUrl: string; clientKey: string } {
  const clientKey = process.env.NEXT_PUBLIC_PAYMENT_CLIENT_KEY;
  if (!clientKey || !clientKey.trim()) {
    throw new Error('Konfigurasi Midtrans client key (NEXT_PUBLIC_PAYMENT_CLIENT_KEY) tidak ditemukan');
  }

  const isProduction = process.env.NEXT_PUBLIC_PAYMENT_IS_PRODUCTION === 'true';
  const scriptUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  return { scriptUrl, clientKey: clientKey.trim() };
}

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
    let config: { scriptUrl: string; clientKey: string };
    try {
      config = getSnapConfig();
    } catch (err) {
      snapPromise = null;
      return reject(err);
    }

    const { scriptUrl, clientKey } = config;

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      if (window.snap) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => {
          snapPromise = null;
          reject(new Error('Gagal memuat script Midtrans Snap'));
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.setAttribute('data-client-key', clientKey);
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
