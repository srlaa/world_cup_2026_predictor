import { createPortal } from 'react-dom';
import { Calculator, Clock, Eye, Flame, ShieldCheck, Target, Trophy, X, Zap } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

const ruleSections = [
  {
    icon: <Target />,
    accent: 'brand',
    title: 'Match outcome',
    value: 'Odds × 10',
    text: 'Choose 1, X or 2 for the result after 90 minutes. Decimal odds are multiplied by 10 and rounded up.',
  },
  {
    icon: <Zap />,
    accent: 'amber',
    title: 'Exact score',
    value: '+50 pts',
    text: 'When exact score is enabled on a match, correctly predicting the 90-minute score earns a fixed bonus.',
  },
  {
    icon: <Flame />,
    accent: 'orange',
    title: 'Fireball',
    value: 'Outcome ×2',
    text: 'Doubles outcome points only. Exact-score and knockout-winner bonuses are never doubled.',
  },
  {
    icon: <ShieldCheck />,
    accent: 'blue',
    title: 'Knockout winner',
    value: '+20 / +8',
    text: 'With an X pick, select who advances for +20. A 1/2 pick earns +8 if that team advances after a 90-minute draw.',
  },
  {
    icon: <Trophy />,
    accent: 'violet',
    title: 'Round multipliers',
    value: 'Up to ×2',
    text: 'Quarter-final outcome points are ×1.5. Semi-final and final outcome points are ×2.',
  },
  {
    icon: <Calculator />,
    accent: 'amber',
    title: 'Round goals',
    value: '100 − 2/miss',
    text: 'Predict total 90-minute goals in a round. Start at 100 points and lose 2 for every goal away. Cancelled matches are void.',
  },
];

const accentClasses: Record<string, string> = {
  brand: 'border-[#41f4c2]/15 bg-[#12d49a]/10 text-[#41f4c2]',
  amber: 'border-amber-400/15 bg-amber-400/10 text-amber-300',
  orange: 'border-orange-400/15 bg-orange-400/10 text-orange-300',
  blue: 'border-blue-400/15 bg-blue-400/10 text-blue-300',
  violet: 'border-violet-400/15 bg-violet-400/10 text-violet-300',
};

export function RulesModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog(true, onClose);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#03070d]/85 p-0 backdrop-blur-md sm:items-center sm:p-6" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Game rules">
      <div ref={dialogRef} className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101827] shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:max-h-[90dvh] sm:rounded-3xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101827]/95 px-5 py-5 backdrop-blur-xl sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#41f4c2]/70">Mundicto playbook</p>
            <h2 className="mt-1 text-2xl font-black text-white">How scoring works</h2>
            <p className="mt-1 text-sm text-white/45">The essentials first, then every way to earn points.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close game rules"><X className="h-5 w-5" /></button>
        </header>

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-7">
          <section className="grid gap-2 sm:grid-cols-3">
            <QuickRule icon={<Clock />} title="Locks at kickoff" text="Saved picks can be edited until the match starts." />
            <QuickRule icon={<Eye />} title="Picks stay private" text="Other players see a pick only after that match begins." />
            <QuickRule icon={<Target />} title="90-minute result" text="Outcome and exact score always refer to regular time." />
          </section>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Ways to score</p>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ruleSections.map((rule) => <Rule key={rule.title} {...rule} />)}
          </section>

          <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] px-4 py-3 text-sm leading-6 text-amber-100/75">
            Fireball availability and exact-score eligibility are shown directly on each match. The match card is always the final source for what can be selected.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuickRule({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="mt-0.5 text-[#41f4c2] [&>svg]:h-5 [&>svg]:w-5">{icon}</div><div><h3 className="text-sm font-bold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-white/45">{text}</p></div></div>;
}

function Rule({ icon, accent, title, value, text }: { icon: React.ReactNode; accent: string; title: string; value: string; text: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl border [&>svg]:h-5 [&>svg]:w-5 ${accentClasses[accent]}`}>{icon}</div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${accentClasses[accent]}`}>{value}</span></div><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-white/50">{text}</p></article>;
}
