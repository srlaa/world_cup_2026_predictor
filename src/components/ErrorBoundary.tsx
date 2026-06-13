import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application error', error, info); }
  render() {
    if (this.state.failed) return <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] p-6 text-center"><div><h1 className="text-2xl font-bold text-white">Something went wrong</h1><p className="mt-2 text-white/50">Your predictions are safe. Reload the page and try again.</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white">Reload application</button></div></div>;
    return this.props.children;
  }
}
