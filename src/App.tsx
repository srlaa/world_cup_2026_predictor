import { useState } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { LoginPage, RegisterPage, UpdatePasswordPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading, passwordRecovery } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (showRegister) {
      return <RegisterPage onToggleForm={() => setShowRegister(false)} />;
    }
    return <LoginPage onToggleForm={() => setShowRegister(true)} />;
  }

  if (passwordRecovery) return <UpdatePasswordPage />;

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
