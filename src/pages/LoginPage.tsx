import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';
import { useVault } from '../contexts/VaultContext';
import { isSupabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const { handleSignInEmail, handleSignInGoogle } = useVault();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address');
      return;
    }

    setSubmitting(true);
    try {
      const res = await handleSignInEmail(trimmed);
      if (res.magicLinkSent) {
        setMagicLinkSent(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleClick = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await handleSignInGoogle();
      if (!isSupabaseConfigured) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-[380px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">Vault</h1>
          <p className="text-[14px] text-[var(--text-muted)]">Personal link library</p>
        </div>

        {magicLinkSent ? (
          <div className="p-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] space-y-2">
            <p className="text-[14px] font-medium text-[var(--text)]">Check your inbox</p>
            <p className="text-[13px] text-[var(--text-muted)]">
              Sign-in link sent to {email}.
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="text-[13px] font-medium text-[var(--accent)] hover:underline"
            >
              Use another email
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={onEmailSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-[12px] font-medium text-[var(--text-muted)]">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>

              {error && (
                <p role="alert" className="text-[13px] font-medium text-[var(--danger)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[14px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors duration-150"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>{isSupabaseConfigured ? 'Send magic link' : 'Continue with email'}</span>
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-[var(--border)]" />
              <span className="px-2.5 bg-[var(--surface)] text-[12px] text-[var(--text-muted)]">or</span>
              <div className="w-full border-t border-[var(--border)]" />
            </div>

            <button
              type="button"
              onClick={onGoogleClick}
              disabled={submitting}
              className="w-full h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[14px] font-medium text-[var(--text)] inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors duration-150"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
