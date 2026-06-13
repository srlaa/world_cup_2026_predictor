import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Plus, UserPlus, Users } from 'lucide-react';
import { supabase, type League } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PlayerPredictionHistory } from './PlayerPredictionHistory';

type Standing = { user_id: string; display_name: string; total_match_points: number; total_round_goal_points: number; exact_score_bonuses: number };

export function LeaguePanel() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Standing | null>(null);
  const inviteHandled = useRef(false);

  const loadLeagues = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_leagues');
    if (error) return setError(error.message);
    const next = (data ?? []) as League[];
    setLeagues(next);
    setSelected((current) => current ?? next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (inviteHandled.current) return;
    inviteHandled.current = true;
    const inviteCode = new URLSearchParams(window.location.search).get('league');
    if (!inviteCode) { void loadLeagues(); return; }
    void supabase.rpc('join_league', { code: inviteCode }).then(({ data, error }) => {
      if (error) setError(error.message); else setSelected(data as string);
      window.history.replaceState({}, '', window.location.pathname);
      void loadLeagues();
    });
  }, [loadLeagues]);
  useEffect(() => {
    if (!selected) return setStandings([]);
    void supabase.rpc('get_league_standings', { target_league_id: selected }).then(({ data, error }) => {
      if (error) setError(error.message); else setStandings((data ?? []) as Standing[]);
    });
  }, [selected]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    const { data, error } = await supabase.rpc('create_league', { league_name: name });
    if (error) return setError(error.message);
    setName(''); setSelected(data as string); await loadLeagues();
  };
  const join = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    const { data, error } = await supabase.rpc('join_league', { code });
    if (error) return setError(error.message);
    setCode(''); setSelected(data as string); await loadLeagues();
  };
  const current = leagues.find((league) => league.id === selected);
  const share = async () => {
    if (!current) return;
    await navigator.clipboard.writeText(`${window.location.origin}?league=${current.invite_code}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };

  return <div className="animate-fadeIn">
    <div className="mb-6"><h2 className="flex items-center gap-3 text-2xl font-bold text-white"><Users className="text-emerald-400" />Private leagues</h2><p className="mt-1 text-sm text-white/45">Create a league and share its invite link with friends.</p></div>
    {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    <div className="mb-7 grid gap-4 lg:grid-cols-2">
      <form onSubmit={create} className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-4"><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={50} placeholder="League name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-emerald-500/50" /><button className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white"><Plus className="h-4 w-4" />Create</button></form>
      <form onSubmit={join} className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-4"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required placeholder="Invite code" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 uppercase text-white outline-none focus:border-blue-500/50" /><button className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white"><UserPlus className="h-4 w-4" />Join</button></form>
    </div>
    {leagues.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-white/45">Create your first private league to start.</div> : <>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{leagues.map((league) => <button key={league.id} onClick={() => setSelected(league.id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${selected === league.id ? 'bg-emerald-500 text-white' : 'border border-white/10 bg-white/5 text-white/60'}`}>{league.name} <span className="ml-1 opacity-60">{league.member_count}</span></button>)}</div>
      {current && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"><div><p className="text-xs text-white/40">Invite code</p><p className="font-mono text-lg font-bold tracking-widest text-white">{current.invite_code}</p></div><button onClick={share} className="ml-auto flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy invite link'}</button></div>}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">{standings.map((entry, index) => <button key={entry.user_id} onClick={() => setHistory(entry)} className="grid w-full grid-cols-12 items-center gap-2 border-b border-white/5 px-4 py-4 text-left last:border-0 hover:bg-white/5"><span className="col-span-2 font-bold text-white/40 sm:col-span-1">#{index + 1}</span><span className="col-span-7 truncate font-semibold text-white sm:col-span-8">{entry.display_name}{entry.user_id === user?.id ? ' (You)' : ''}</span><span className="col-span-3 text-right text-lg font-bold text-emerald-300">{Math.ceil(Number(entry.total_match_points) + Number(entry.total_round_goal_points))}</span></button>)}</div>
    </>}
    {history && <PlayerPredictionHistory userId={history.user_id} displayName={history.display_name} isCurrentUser={history.user_id === user?.id} onClose={() => setHistory(null)} />}
  </div>;
}
