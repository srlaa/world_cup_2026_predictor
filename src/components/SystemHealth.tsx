import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SyncRun = { id: number; job_name: string; started_at: string; completed_at: string | null; success: boolean; summary: Record<string, unknown>; error_message: string | null };

export function SystemHealth() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(20).then(({ data, error }) => error ? setError(error.message) : setRuns((data ?? []) as SyncRun[])); }, []);
  const latest = ['sync-matches', 'update-scores', 'sync-odds'].flatMap((job) => runs.find((run) => run.job_name === job) ?? []);
  return <div><h2 className="mb-2 flex items-center gap-3 text-2xl font-bold text-white"><Activity className="text-emerald-400" />System health</h2><p className="mb-6 text-sm text-white/45">Visible only to the application administrator.</p>{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}<div className="grid gap-4 md:grid-cols-3">{latest.map((run) => <div key={run.id} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center gap-2">{run.success ? <CheckCircle className="text-emerald-400" /> : <AlertTriangle className="text-red-400" />}<strong className="text-white">{run.job_name}</strong></div><p className="mt-3 text-sm text-white/50">{new Date(run.started_at).toLocaleString()}</p>{run.error_message && <p className="mt-2 text-sm text-red-300">{run.error_message}</p>}<pre className="mt-3 overflow-auto text-xs text-white/40">{JSON.stringify(run.summary, null, 2)}</pre></div>)}</div>{!latest.length && !error && <p className="rounded-xl border border-white/10 p-6 text-white/45">No sync runs have been recorded yet.</p>}</div>;
}
