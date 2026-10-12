import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// One shared promise for the page. Resolving merely because the tag exists is a race: the first
// mount appends it, and a second mount moments later sees the tag but not yet `window.google`,
// so it bails out and the button is never drawn. That is exactly what a StrictMode double-mount
// does in development, and what two of these rendering at once would do anywhere.
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const settle = () => (window.google?.accounts?.id ? resolve() : reject(new Error('script failed')));
    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      if (window.google?.accounts?.id) return resolve();
      existing.addEventListener('load', settle, { once: true });
      existing.addEventListener('error', () => reject(new Error('script failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', settle, { once: true });
    script.addEventListener('error', () => reject(new Error('script failed')), { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Let a later mount try again rather than caching the failure for the life of the page.
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function GoogleSignInButton({ onCredential, text = 'continue_with' }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  callback.current = onCredential;

  useEffect(() => {
    if (!clientId) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) callback.current(response.credential);
          },
        });

        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: 320,
          logo_alignment: 'center',
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [clientId, theme, text]);

  if (failed) {
    return (
      <p className="rounded-xl border border-dashed border-hairline p-3 text-center text-xs text-content-subtle">
        {clientId
          ? 'Google sign-in could not load. Use your email and password below.'
          : 'Google sign-in is not configured on this environment.'}
      </p>
    );
  }

  return <div ref={container} className="flex min-h-[44px] justify-center" />;
}
