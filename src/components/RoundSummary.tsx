import { Check, Flame, Target, Trophy, X, Zap } from 'lucide-react';
import type { Match, Prediction, RoundGoal } from '../lib/supabase';

export function RoundSummary({ matches, predictions, roundGoal }: { matches: Match[]; predictions: Record<string, Prediction>; roundGoal: RoundGoal | null }) {
  const played = matches.filter((match) => match.status === 'finished');
  if (!played.length || played.length !== matches.filter((match) => match.status !== 'cancelled').length) return null;
  const picks = played.flatMap((match) => predictions[match.id] ? [predictions[match.id]] : []);
  const hits = picks.filter((pick) => pick.is_outcome_correct).length;
  const exact = picks.filter((pick) => pick.is_exact_score_correct).length;
  const advance = picks.filter((pick) => pick.advancement_points > 0).length;
  const fireballs = picks.filter((pick) => pick.boost_used && pick.is_outcome_correct).length;
  const points = Math.ceil(picks.reduce((sum, pick) => sum + Number(pick.points_awarded), 0) + Number(roundGoal?.points_awarded ?? 0));

  return <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent p-5">
    <div className="mb-4 flex items-center gap-3"><Trophy className="h-6 w-6 text-emerald-300" /><div><p className="text-xs uppercase tracking-wider text-emerald-300/70">Round complete</p><h3 className="font-bold text-white">Your round summary</h3></div><strong className="ml-auto text-2xl text-emerald-300">{points} pts</strong></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat icon={<Check />} label="Outcomes" value={`${hits}/${picks.length}`} />
      <Stat icon={<X />} label="Misses" value={String(picks.length - hits)} />
      <Stat icon={<Zap />} label="Exact" value={String(exact)} />
      <Stat icon={<Target />} label="Winner bonuses" value={String(advance)} />
      <Stat icon={<Flame />} label="Fireball hits" value={String(fireballs)} />
    </div>
  </div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-black/15 p-3"><div className="mb-1 flex items-center gap-1.5 text-white/40">{icon}<span className="text-xs">{label}</span></div><p className="text-lg font-bold text-white">{value}</p></div>;
}
