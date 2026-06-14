import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Flame, Lock, Target, X, Zap } from 'lucide-react';
import { ROUND_LABELS, supabase, type MatchRound, type MatchStatus } from '../lib/supabase';
import { getCountryFlag } from '../lib/countries';
import { useDialog } from '../hooks/useDialog';

type VisibleMatchPrediction = {
  prediction_id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  round: MatchRound;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  winner_team: string | null;
  exact_score_enabled: boolean;
  predicted_outcome: '1' | 'X' | '2';
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_advancing_team: string | null;
  boost_used: boolean;
  is_outcome_correct: boolean;
  is_exact_score_correct: boolean;
  is_advancer_correct: boolean;
  advancement_points: number;
  points_awarded: number;
};

type VisibleRoundGoal = {
  prediction_id: string;
  round: MatchRound;
  predicted_total_goals: number;
  actual_total_goals: number | null;
  points_awarded: number | null;
  round_started: boolean;
};

interface PlayerPredictionHistoryProps {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  onClose: () => void;
}

function outcomeLabel(outcome: '1' | 'X' | '2', home: string, away: string) {
  if (outcome === '1') return home;
  if (outcome === '2') return away;
  return 'Draw';
}

export function PlayerPredictionHistory({ userId, displayName, isCurrentUser, onClose }: PlayerPredictionHistoryProps) {
  const [matches, setMatches] = useState<VisibleMatchPrediction[]>([]);
  const [roundGoals, setRoundGoals] = useState<VisibleRoundGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const [matchResult, roundResult] = await Promise.all([
        supabase.rpc('get_visible_match_predictions', { target_user_id: userId }),
        supabase.rpc('get_visible_round_goal_predictions', { target_user_id: userId }),
      ]);

      if (matchResult.error || roundResult.error) {
        setError(matchResult.error?.message || roundResult.error?.message || 'Could not load predictions');
      } else {
        setMatches((matchResult.data ?? []) as VisibleMatchPrediction[]);
        setRoundGoals((roundResult.data ?? []) as VisibleRoundGoal[]);
      }
      setLoading(false);
    };

    void load();
  }, [userId]);

  const dialogRef = useDialog(true, onClose);

  return createPortal((
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-24" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={`Prediction history for ${displayName}`}>
      <div
        ref={dialogRef}
        className="flex h-[100dvh] min-h-0 w-full max-w-4xl flex-col overflow-hidden bg-[#101827] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-7rem)] sm:rounded-3xl sm:border sm:border-white/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="z-30 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#101827]/95 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur sm:px-7 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Prediction history</p>
            <h3 className="mt-1 truncate text-xl font-bold text-white">{displayName}{isCurrentUser ? ' (You)' : ''}</h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] p-3 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close prediction history"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-12rem)] sm:p-7">
          {!isCurrentUser && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/80">
              <Lock className="h-4 w-4 shrink-0" />
              Future predictions stay hidden until each match starts.
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-white/50">Loading predictions...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
          ) : matches.length === 0 && roundGoals.length === 0 ? (
            <div className="py-16 text-center">
              <Target className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-white/50">No visible predictions yet.</p>
            </div>
          ) : (
            <>
              {roundGoals.length > 0 && (
                <section className="mb-7">
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">Round goals</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {roundGoals.map((goal) => (
                      <div key={goal.prediction_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">{ROUND_LABELS[goal.round]}</span>
                          <span className="text-lg font-bold text-amber-300">{goal.predicted_total_goals} goals</span>
                        </div>
                        <p className="mt-2 text-xs text-white/45">
                          {goal.actual_total_goals === null
                            ? 'Round in progress'
                            : `Actual: ${goal.actual_total_goals} · ${goal.points_awarded ?? 0} pts`}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">Match predictions</h4>
                <div className="space-y-3">
                  {matches.map((prediction) => {
                    const finished = prediction.status === 'finished';
                    const scorePick = prediction.predicted_home_score !== null
                      ? `${prediction.predicted_home_score}:${prediction.predicted_away_score}`
                      : null;
                    return (
                      <div key={prediction.prediction_id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-white/40">{ROUND_LABELS[prediction.round]}</p>
                            <p className="mt-1 font-semibold text-white">
                              {getCountryFlag(prediction.home_team)} {prediction.home_team}
                              <span className="mx-2 text-white/30">vs</span>
                              {getCountryFlag(prediction.away_team)} {prediction.away_team}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {prediction.boost_used && (
                              <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-300">
                                <Flame className="h-3.5 w-3.5" /> x2
                              </span>
                            )}
                            {finished ? (
                              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${prediction.is_outcome_correct ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                                {prediction.is_outcome_correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                {prediction.is_outcome_correct ? 'Hit' : 'Miss'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs text-blue-300">
                                <Clock className="h-3.5 w-3.5" /> {prediction.status === 'live' ? 'Live' : 'Started'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                          <div className="rounded-xl bg-black/15 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-white/35">Pick</p>
                            <p className="mt-1 font-semibold text-white">{outcomeLabel(prediction.predicted_outcome, prediction.home_team, prediction.away_team)}</p>
                          </div>
                          {prediction.predicted_advancing_team && (
                            <div className="hidden rounded-xl bg-black/15 p-3 sm:block">
                              <p className="text-[11px] uppercase tracking-wide text-white/35">Eventual winner</p>
                              <p className={`mt-1 font-semibold ${prediction.is_advancer_correct ? 'text-blue-300' : 'text-white'}`}>
                                {prediction.predicted_advancing_team} {prediction.is_advancer_correct ? `+${prediction.advancement_points}` : ''}
                              </p>
                            </div>
                          )}
                          <div className="hidden rounded-xl bg-black/15 p-3 sm:block">
                            <p className="text-[11px] uppercase tracking-wide text-white/35">Exact score</p>
                            <p className={`mt-1 font-semibold ${finished && prediction.is_exact_score_correct ? 'text-amber-300' : 'text-white'}`}>
                              {scorePick ?? 'Not selected'} {prediction.is_exact_score_correct && <Zap className="inline h-3.5 w-3.5" />}
                            </p>
                          </div>
                          <div className="rounded-xl bg-black/15 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-white/35">Result</p>
                            <p className="mt-1 font-semibold text-white">
                              {prediction.home_score === null ? 'In progress' : `${prediction.home_score}:${prediction.away_score}`}
                            </p>
                          </div>
                          <div className="rounded-xl bg-emerald-500/10 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-emerald-300/60">Points</p>
                            <p className="mt-1 text-lg font-bold text-emerald-300">{finished ? Math.ceil(Number(prediction.points_awarded)) : 'Pending'}</p>
                          </div>
                        </div>
                        {(prediction.predicted_advancing_team || scorePick) && (
                          <details className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 sm:hidden">
                            <summary className="cursor-pointer text-xs font-semibold text-white/50">More prediction details</summary>
                            <div className="mt-2 space-y-1 text-sm text-white/65">
                              {scorePick && <p>Exact score: <strong className="text-white">{scorePick}</strong></p>}
                              {prediction.predicted_advancing_team && <p>Eventual winner: <strong className="text-white">{prediction.predicted_advancing_team}</strong></p>}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}
