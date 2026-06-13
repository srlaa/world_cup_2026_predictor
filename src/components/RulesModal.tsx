import { Flame, ShieldCheck, Target, Trophy, X, Zap } from 'lucide-react';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101827] p-6 shadow-2xl sm:rounded-3xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-400">How to play</p><h2 className="mt-1 text-2xl font-bold text-white">Game rules</h2></div>
          <button onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Rule icon={<Target />} title="Match outcome" text="Pick 1, X or 2 for the score after 90 minutes. Points are the decimal odds x10, rounded up." />
          <Rule icon={<Zap />} title="Exact score" text="Selected group matches and every match from the round of 16 award 50 bonus points for the exact 90-minute score." />
          <Rule icon={<Flame />} title="Fireball x2" text="A Fireball doubles outcome points only. It never doubles exact-score or knockout-winner bonus points." />
          <Rule icon={<ShieldCheck />} title="Knockout winner" text="With an X pick, choose who wins after extra time or penalties for +20. With 1/2, that team is selected automatically and earns +8 if it advances after a 90-minute draw." />
          <Rule icon={<Trophy />} title="Round multipliers" text="Quarter-final outcome points are x1.5. Semi-final and final outcome points are x2." />
          <Rule icon={<Target />} title="Round goals" text="Predict total 90-minute goals in a round. Exact is 100 points; every goal away subtracts 2 points. Cancelled matches are void." />
        </div>
        <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80">Every prediction locks at kickoff. Other players' picks become visible only after that match starts.</p>
      </div>
    </div>
  );
}

function Rule({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">{icon}</div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-white/55">{text}</p></div>;
}
