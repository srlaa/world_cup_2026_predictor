import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, User, Shield, Target, Users, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { MundictoBrand, MundictoMark } from './MundictoBrand';

interface LoginPageProps {
  onToggleForm: () => void;
}

export function LoginPage({ onToggleForm }: LoginPageProps) {
  const { signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const resetPassword = async () => {
    setError(null); setMessage(null);
    if (!email) return setError('Enter your email address first.');
    const { error } = await requestPasswordReset(email);
    if (error) setError(error.message); else setMessage('Password reset link sent. Check your email.');
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex">
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-emerald-900/10 to-transparent" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-10"><MundictoBrand /></div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
            Predict. <br />
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              Compete.
            </span>
            <br />
            Win.
          </h2>

          <p className="text-white/60 text-lg mb-10 max-w-md">
            Challenge your friends in the ultimate World Cup prediction game. Pick winners, guess scores, and climb the leaderboard.
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div className="p-5 bg-white/5 rounded-xl border border-white/10">
              <Target className="w-8 h-8 text-emerald-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Match Predictions</h3>
              <p className="text-white/50 text-sm">Predict outcomes and exact scores</p>
            </div>
            <div className="p-5 bg-white/5 rounded-xl border border-white/10">
              <Shield className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Round Goals</h3>
              <p className="text-white/50 text-sm">Guess total goals per round</p>
            </div>
            <div className="p-5 bg-white/5 rounded-xl border border-white/10">
              <Users className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Leaderboard</h3>
              <p className="text-white/50 text-sm">Compete with friends</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="lg:hidden absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-transparent" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <MundictoBrand centered />
          </div>

          <div className="bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-white/50 mb-8">Sign in to continue your prediction journey</p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs">!</span>
                </div>
                <span>{error}</span>
              </div>
            )}
            {message && <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-white/70 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    id="login-email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><label htmlFor="login-password" className="block text-sm font-medium text-white/70">Password</label><button type="button" onClick={resetPassword} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Forgot password?</button></div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/35 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="relative w-full mt-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#0a0f1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative">
                  {loading ? 'Signing in...' : 'Sign In'}
                </span>
                {!loading && <ChevronRight className="relative w-4 h-4" />}
              </button>
            </form>

            <p className="mt-8 text-center text-white/50">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onToggleForm}
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UpdatePasswordPage() {
  const { updatePassword, finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError('Password must contain at least 8 characters.');
    setLoading(true); setError(null);
    const result = await updatePassword(password);
    if (result.error) setError(result.error.message);
    setLoading(false);
  };
  return <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] p-6"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl"><div className="mb-7"><MundictoBrand /></div><h1 className="text-2xl font-bold text-white">Set a new password</h1><p className="mt-2 text-sm text-white/50">Choose a new password for your Mundicto account.</p>{error && <p className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="New password" className="mt-6 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#41f4c2]/50" /><button disabled={loading} className="mt-4 w-full rounded-xl bg-[#12d49a] py-3 font-semibold text-[#061017] disabled:opacity-50">{loading ? 'Updating...' : 'Update password'}</button><button type="button" onClick={finishPasswordRecovery} className="mt-3 w-full py-2 text-sm text-white/50">Cancel</button></form></div>;
}

export function RegisterPage({ onToggleForm }: LoginPageProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (displayName.length < 2) {
      setError('Display name must be at least 2 characters');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, displayName);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-8 relative">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-transparent" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
          <div className="mb-6 flex justify-center"><MundictoMark /></div>
          <h2 className="text-2xl font-bold text-white mb-3">Account Created!</h2>
          <p className="text-white/50 mb-8">Check your email to confirm your account and start making predictions.</p>
          <button
            onClick={onToggleForm}
            className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors flex items-center gap-2 mx-auto"
          >
            Back to Sign In
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-8 relative">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-transparent" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <MundictoBrand centered />
          <p className="mt-4 text-white/50">Join the prediction challenge</p>
        </div>

        <div className="bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-white/50 mb-8">Start predicting and climb the leaderboard</p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs">!</span>
              </div>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-white/70 mb-2">Display Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  id="register-name"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="Your name"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-white/70 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="email"
                  id="register-email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-white/70 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/35 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full mt-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#0a0f1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">
                {loading ? 'Creating account...' : 'Create Account'}
              </span>
              {!loading && <ChevronRight className="relative w-4 h-4" />}
            </button>
          </form>

          <p className="mt-8 text-center text-white/50">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onToggleForm}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
