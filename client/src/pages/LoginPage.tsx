import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, getRolePortalPath } from '../context/AuthContext';
import {
  ArrowRight,
  Eye,
  EyeSlash
} from '@phosphor-icons/react';

export const LoginPage: React.FC = () => {
  const { user, login, registerAttendee, getPrimaryPortalPath } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectParam = searchParams.get('redirect');
  const modeParam = searchParams.get('mode');

  const [mode, setMode] = useState<'signin' | 'signup'>(modeParam === 'signup' ? 'signup' : 'signin');

  // Form Fields - clean, unpopulated
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (redirectParam) {
        navigate(redirectParam, { replace: true });
      } else {
        navigate(getPrimaryPortalPath(user), { replace: true });
      }
    }
  }, [user, navigate, getPrimaryPortalPath, redirectParam]);

  useEffect(() => {
    if (modeParam === 'signup') {
      setMode('signup');
      setEmail('');
      setPassword('');
      setError(null);
    } else if (modeParam === 'signin') {
      setMode('signin');
      setError(null);
    }
  }, [modeParam]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!password) {
      setError('Please provide your password.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerAttendee({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        });
        if (redirectParam) {
          navigate(redirectParam);
        } else {
          navigate('/portal/attendee');
        }
      } else {
        const loggedUser = await login(email.trim(), password);
        if (redirectParam) {
          navigate(redirectParam);
        } else {
          const targetPortal = getRolePortalPath(loggedUser.roles?.[0]?.role);
          navigate(targetPortal);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 sm:py-12 px-4">
      <div className="editorial-card overflow-hidden shadow-modal bg-white">
        {/* Brand Header */}
        <div className="bg-ink text-white p-6 sm:p-8 text-center space-y-3 border-b border-ink-light">
          <div className="flex justify-center mb-1">
            <img
              src="/iconic-logo.png"
              alt="Iconic Open University"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>

          {/* Mode Switcher: Sign In vs Create Account */}
          <div className="pt-2 max-w-sm mx-auto">
            <div className="grid grid-cols-2 p-1 rounded-btn bg-ink-light border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-btn transition cursor-pointer text-center ${
                  mode === 'signin'
                    ? 'bg-white text-ink font-bold shadow-subtle'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setEmail('');
                  setPassword('');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-btn transition cursor-pointer text-center ${
                  mode === 'signup'
                    ? 'bg-white text-ink font-bold shadow-subtle'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {redirectParam && (
            <div className="p-3.5 bg-ivory border border-slate-200 text-slate-800 rounded-card text-xs">
              <span>Please sign in or create an account to continue.</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-card bg-crimson-subtle border border-crimson-border text-crimson text-xs">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Standard Authentication Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="login-fullname" className="block text-xs font-semibold text-ink mb-1.5">
                    Full Name <span className="text-tangerine">*</span>
                  </label>
                  <input
                    id="login-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                  />
                </div>

                <div>
                  <label htmlFor="login-phone" className="block text-xs font-semibold text-ink mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    id="login-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. +234 803 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1.5">
                Email Address <span className="text-tangerine">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-ink mb-1.5">
                Password <span className="text-tangerine">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="Enter your password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 pr-10 py-2.5 rounded-btn border border-slate-300 bg-white text-xs text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tangerine focus:border-tangerine transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeSlash size={16} weight="regular" /> : <Eye size={16} weight="regular" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-btn bg-tangerine hover:bg-tangerine-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-subtle transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'signup' ? (
                <>
                  <span>{redirectParam ? 'Create Account & Continue' : 'Create Account'}</span>
                  <ArrowRight size={16} weight="regular" />
                </>
              ) : (
                <>
                  <span>{redirectParam ? 'Sign In & Continue' : 'Sign In'}</span>
                  <ArrowRight size={16} weight="regular" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Helper */}
          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
            {mode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setEmail('');
                    setPassword('');
                    setError(null);
                  }}
                  className="text-tangerine font-bold hover:underline cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-tangerine font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
