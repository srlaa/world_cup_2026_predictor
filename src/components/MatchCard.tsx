import { useState, useEffect, type FormEvent } from 'react';
import { supabase, type Match, type Prediction, ROUND_LABELS, type MatchRound } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCountryFlag } from '../lib/countries';
import { Clock, MapPin, Lock, Check, Target, Zap, TrendingUp, ChevronDown, ChevronUp, Radio, Flag, Flame } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  boostLimit: number;
  boostsUsed: number;
  roundMultiplier: number;
  onUpdate: () => void;
}

function isMatchLocked(kickoffAt: string): boolean {
  return new Date(kickoffAt) <= new Date();
}

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case '1': return 'Home Win';
    case 'X': return 'Draw';
    case '2': return 'Away Win';
    default: return '';
  }
}

function calculateOutcome(homeScore: number | null, awayScore: number | null): '1' | 'X' | '2' | null {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return '1';
  if (homeScore < awayScore) return '2';
  return 'X';
}

function outcomeFromPrediction(homeScore: number, awayScore: number): '1' | 'X' | '2' {
  if (homeScore > awayScore) return '1';
  if (homeScore < awayScore) return '2';
  return 'X';
}

function scoreForOutcome(outcome: '1' | 'X' | '2', homeScore: number, awayScore: number): [number, number] {
  if (outcome === '1' && homeScore <= awayScore) return [awayScore + 1, awayScore];
  if (outcome === '2' && awayScore <= homeScore) return [homeScore, homeScore + 1];
  if (outcome === 'X' && homeScore !== awayScore) return [Math.min(homeScore, awayScore), Math.min(homeScore, awayScore)];
  return [homeScore, awayScore];
}

function formatTimeLeft(kickoffAt: string): string {
  const diff = new Date(kickoffAt).getTime() - Date.now();
  if (diff <= 0) return 'Started';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function requiresAdvancer(round: MatchRound): boolean {
  return ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'].includes(round);
}

export function MatchCard({ match, prediction, boostLimit, boostsUsed, roundMultiplier, onUpdate }: MatchCardProps) {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(isMatchLocked(match.kickoff_at));
  const [editing, setEditing] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'1' | 'X' | '2'>(
    prediction?.predicted_outcome || (match.exact_score_enabled ? 'X' : '1'),
  );
  const [homeScore, setHomeScore] = useState(prediction?.predicted_home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.predicted_away_score ?? 0);
  const [boostUsed, setBoostUsed] = useState(prediction?.boost_used ?? false);
  const [advancingTeam, setAdvancingTeam] = useState(
    prediction?.predicted_advancing_team ?? match.home_team,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedOutcome(prediction?.predicted_outcome || (match.exact_score_enabled ? 'X' : '1'));
    setHomeScore(prediction?.predicted_home_score ?? 0);
    setAwayScore(prediction?.predicted_away_score ?? 0);
    setBoostUsed(prediction?.boost_used ?? false);
    setAdvancingTeam(prediction?.predicted_advancing_team ?? match.home_team);
  }, [match.exact_score_enabled, match.home_team, prediction]);

  useEffect(() => {
    const checkLock = () => {
      const locked = isMatchLocked(match.kickoff_at);
      setIsLocked(locked);
      if (locked && editing) {
        setEditing(false);
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [match.kickoff_at, editing]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || isLocked || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (prediction) {
        const { error } = await supabase
          .from('predictions')
          .update({
            predicted_outcome: selectedOutcome,
            predicted_home_score: match.exact_score_enabled ? homeScore : null,
            predicted_away_score: match.exact_score_enabled ? awayScore : null,
            predicted_advancing_team: requiresAdvancer(match.round) ? advancingTeam : null,
            boost_used: boostUsed,
          })
          .eq('id', prediction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('predictions')
          .insert({
            user_id: user.id,
            match_id: match.id,
            predicted_outcome: selectedOutcome,
            predicted_home_score: match.exact_score_enabled ? homeScore : null,
            predicted_away_score: match.exact_score_enabled ? awayScore : null,
            predicted_advancing_team: requiresAdvancer(match.round) ? advancingTeam : null,
            boost_used: boostUsed,
          });

        if (error) throw error;
      }

      setEditing(false);
      onUpdate();
    } catch (saveError) {
      console.error('Error saving prediction:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save prediction');
    } finally {
      setSaving(false);
    }
  };

  const formatKickoff = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  const actualOutcome = calculateOutcome(match.home_score, match.away_score);
  const pointsDisplay = match.status === 'finished' && prediction
    ? prediction.points_awarded
    : null;

  const oddsForOutcome = (outcome: '1' | 'X' | '2') => {
    switch (outcome) {
      case '1': return match.odds_home;
      case 'X': return match.odds_draw;
      case '2': return match.odds_away;
    }
  };

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const homeFlag = getCountryFlag(match.home_team);
  const awayFlag = getCountryFlag(match.away_team);
  const canEnableBoost = prediction?.boost_used || boostsUsed < boostLimit;
  const outcomePoints = Math.ceil(oddsForOutcome(selectedOutcome) * 10 * roundMultiplier * (boostUsed ? 2 : 1));
  const predictionState = prediction
    ? isLocked ? 'Locked pick' : 'Pick saved'
    : isLocked ? 'Locked' : 'Needs pick';

  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-[#101824]/85 p-5 transition-all duration-500 hover:bg-[#121d2b] hover:shadow-xl ${
      isLive
        ? 'border-[#12d49a]/45 shadow-lg shadow-[#12d49a]/10 ring-1 ring-[#12d49a]/20'
        : isFinished
          ? 'border-white/10'
          : prediction
            ? 'border-[#12d49a]/20'
            : 'border-white/10 hover:border-white/20'
    }`}>
      {isLive && (
        <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#41f4c2] to-transparent" />
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/55">
            {ROUND_LABELS[match.round as MatchRound]}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            prediction
              ? 'border-[#12d49a]/20 bg-[#12d49a]/10 text-[#41f4c2]'
              : isLocked
                ? 'border-white/10 bg-white/[0.04] text-white/45'
                : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
          }`}>
            {predictionState}
          </span>
          {prediction?.boost_used && (
            <span className="flex items-center gap-1 rounded-full border border-orange-400/25 bg-orange-400/10 px-2.5 py-1 text-xs font-bold text-orange-300">
              <Flame className="h-3.5 w-3.5 fill-orange-400" />
              2x
            </span>
          )}
          {match.status === 'finished' && prediction && prediction.points_awarded > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-[#12d49a]/20 bg-[#12d49a]/10 px-2.5 py-1 text-xs font-semibold text-[#41f4c2]">
              <TrendingUp className="w-3 h-3" />
              +{Math.ceil(Number(prediction.points_awarded))} pts
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#12d49a] to-[#0ca678] px-3 py-1.5 text-xs font-bold text-[#061017] shadow-lg shadow-[#12d49a]/30">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#061017]" />
              LIVE
            </span>
          )}
          {isFinished && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
              <Flag className="w-3 h-3" />
              FT
            </span>
          )}
          {!isLocked && !isLive && !isFinished && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/55">
              <Clock className="w-3 h-3" />
              {formatTimeLeft(match.kickoff_at)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-stretch justify-between gap-4 mb-5">
        <div className="flex-1 flex flex-col items-center text-center">
          <div className={`text-5xl mb-3 transition-transform duration-300 ${
            isLive ? 'scale-110' : ''
          }`}>
            {homeFlag}
          </div>
          <p className="font-semibold text-white text-sm leading-tight">{match.home_team}</p>
        </div>

        <div className="flex flex-col items-center justify-center min-w-[80px]">
          {match.home_score !== null && match.away_score !== null ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-bold ${
                  match.home_score > match.away_score ? 'text-emerald-400' : 'text-white/90'
                }`}>
                  {match.home_score}
                </span>
                <span className="text-white/30 text-xl">-</span>
                <span className={`text-3xl font-bold ${
                  match.away_score > match.home_score ? 'text-emerald-400' : 'text-white/90'
                }`}>
                  {match.away_score}
                </span>
              </div>
              {isLive && (
                <div className="mt-2 flex items-center gap-1 text-emerald-400 text-xs">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Live
                </div>
              )}
              {isFinished && match.final_home_score !== null && match.final_away_score !== null
                && (match.final_home_score !== match.home_score || match.final_away_score !== match.away_score) && (
                <p className="mt-2 text-center text-xs text-white/45">
                  Final: {match.final_home_score}-{match.final_away_score}
                  {match.score_duration === 'PENALTY_SHOOTOUT' ? ' after penalties' : ' after extra time'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/25 text-xl font-light">vs</span>
              <div className="flex items-center gap-1 text-xs text-white/40">
                <Clock className="w-3 h-3" />
                {formatTimeLeft(match.kickoff_at)}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center text-center">
          <div className={`text-5xl mb-3 transition-transform duration-300 ${
            isLive ? 'scale-110' : ''
          }`}>
            {awayFlag}
          </div>
          <p className="font-semibold text-white text-sm leading-tight">{match.away_team}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-white/40 mb-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatKickoff(match.kickoff_at)}
        </div>
        {match.venue && (
          <>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {match.venue.split(',')[0]}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLocked && !prediction && !isFinished && (
        <div className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-xl border border-white/10">
          <Lock className="w-4 h-4 text-white/40" />
          <span className="text-white/50 text-sm">Prediction locked - match started</span>
        </div>
      )}

      {isFinished && prediction && (
        <div className="bg-gradient-to-b from-white/[0.06] to-transparent rounded-xl p-4 border border-white/10 mt-2">
          <div className={`grid gap-3 text-center ${match.exact_score_enabled || requiresAdvancer(match.round) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <div>
              <p className="text-white/40 text-xs mb-1">Your Pick</p>
              <p className={`font-semibold text-sm flex items-center justify-center gap-1 ${
                prediction.is_outcome_correct ? 'text-emerald-400' : 'text-white/60'
              }`}>
                {getOutcomeLabel(prediction.predicted_outcome)}
                {prediction.is_outcome_correct && <Check className="w-4 h-4" />}
              </p>
            </div>
            {match.exact_score_enabled && (
              <div>
                <p className="text-white/40 text-xs mb-1">Your Score</p>
                <p className={`font-semibold text-sm flex items-center justify-center gap-1 ${
                  prediction.is_exact_score_correct ? 'text-amber-400' : 'text-white/60'
                }`}>
                  {prediction.predicted_home_score}:{prediction.predicted_away_score}
                  {prediction.is_exact_score_correct && <Zap className="w-3.5 h-3.5" />}
                </p>
              </div>
            )}
            {requiresAdvancer(match.round) && (
              <div>
                <p className="text-white/40 text-xs mb-1">Eventual Winner</p>
                <p className={`font-semibold text-sm flex items-center justify-center gap-1 ${
                  prediction.is_advancer_correct ? 'text-blue-300' : 'text-white/60'
                }`}>
                  {prediction.predicted_advancing_team}{prediction.advancement_points > 0 ? ` +${prediction.advancement_points}` : ''}
                  {prediction.is_advancer_correct && <Check className="w-4 h-4" />}
                </p>
              </div>
            )}
            <div>
              <p className="text-white/40 text-xs mb-1">Result</p>
              <p className="font-semibold text-sm text-white">
                {actualOutcome ? getOutcomeLabel(actualOutcome) : '-'}
              </p>
            </div>
          </div>

          {pointsDisplay !== null && (
            <div className="flex items-center justify-center pt-3 mt-3 border-t border-white/10">
              <span className={`text-base font-bold flex items-center gap-1.5 ${
                pointsDisplay > 0 ? 'text-emerald-400' : 'text-white/40'
              }`}>
                {pointsDisplay > 0 ? <TrendingUp className="w-4 h-4" /> : null}
                +{Math.ceil(Number(pointsDisplay))} pts
              </span>
            </div>
          )}
        </div>
      )}

      {!isLocked && !isLive && !isFinished && (
        <>
          {!editing && !prediction && (
            <button
              onClick={() => setEditing(true)}
              className="group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#12d49a]/30 bg-[#12d49a]/10 py-3 font-semibold text-[#41f4c2] transition-all duration-300 hover:bg-[#12d49a]/15"
            >
              <Target className="w-4 h-4" />
              Make pick
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>
          )}

          {!editing && prediction && (
            <button
              onClick={() => setEditing(true)}
              className="group/btn flex w-full items-center justify-center gap-2 rounded-xl border border-[#12d49a]/20 bg-[#12d49a]/10 py-3 font-semibold text-[#41f4c2] transition-all duration-300 hover:bg-[#12d49a]/15"
            >
              <Check className="w-4 h-4" />
              Edit pick
              <ChevronUp className="w-4 h-4 opacity-50" />
            </button>
          )}

          {editing && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">
                  Match Outcome
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1', 'X', '2'] as const).map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => {
                        setSelectedOutcome(outcome);
                        if (requiresAdvancer(match.round) && outcome !== 'X') {
                          setAdvancingTeam(outcome === '1' ? match.home_team : match.away_team);
                        }
                        if (match.exact_score_enabled) {
                          const [nextHomeScore, nextAwayScore] = scoreForOutcome(outcome, homeScore, awayScore);
                          setHomeScore(nextHomeScore);
                          setAwayScore(nextAwayScore);
                        }
                      }}
                      className={`relative py-3 px-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        selectedOutcome === outcome
                          ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/30'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {selectedOutcome === outcome && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#12d49a] to-[#41f4c2] blur-xl opacity-30 -z-10" />
                      )}
                      <div className="text-lg font-bold">{outcome}</div>
                      <div className="text-xs opacity-80">
                        {outcome === '1' ? 'Home' : outcome === 'X' ? 'Draw' : 'Away'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {boostLimit > 0 && (
                <button
                  type="button"
                  onClick={() => canEnableBoost && setBoostUsed((current) => !current)}
                  disabled={!boostUsed && !canEnableBoost}
                  className={`group/boost relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                    boostUsed
                      ? 'border-orange-400/60 bg-gradient-to-r from-orange-500/25 via-red-500/15 to-transparent text-orange-100 shadow-lg shadow-orange-500/15'
                      : 'border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-transparent text-white/70 hover:border-orange-400/40 hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  {boostUsed && <div className="absolute inset-0 bg-orange-400/5 animate-pulse" />}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
                        boostUsed ? 'bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600' : 'bg-orange-500/15'
                      }`}>
                        <Flame className={`h-7 w-7 ${boostUsed ? 'fill-yellow-200 text-white' : 'text-orange-400'}`} />
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-[#0a0f1a] px-1.5 py-0.5 text-[10px] font-black text-orange-300 ring-1 ring-orange-400/40">x2</span>
                      </div>
                      <div>
                        <p className="font-bold text-orange-200">Fireball x2</p>
                        <p className="text-xs opacity-70">Doubles points for a correct match outcome</p>
                      </div>
                    </div>
                    <span className="relative rounded-full bg-black/20 px-3 py-1 text-xs font-bold text-orange-200">
                      {Math.max(0, boostLimit - boostsUsed)} left
                    </span>
                  </div>
                </button>
              )}

              {match.exact_score_enabled && (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Exact Score Prediction
                  </label>
                  </div>
                  <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <div className="text-3xl mb-2">{homeFlag}</div>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={homeScore}
                      onChange={(e) => {
                        const score = parseInt(e.target.value) || 0;
                        setHomeScore(score);
                        const outcome = outcomeFromPrediction(score, awayScore);
                        setSelectedOutcome(outcome);
                        if (requiresAdvancer(match.round) && outcome !== 'X') setAdvancingTeam(outcome === '1' ? match.home_team : match.away_team);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center text-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#12d49a]/50 focus:border-[#12d49a]/50 transition-all"
                    />
                    <p className="text-[10px] text-white/40 mt-1.5 truncate">{match.home_team}</p>
                  </div>
                  <span className="text-white/25 text-2xl font-light">:</span>
                  <div className="flex-1 text-center">
                    <div className="text-3xl mb-2">{awayFlag}</div>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={awayScore}
                      onChange={(e) => {
                        const score = parseInt(e.target.value) || 0;
                        setAwayScore(score);
                        const outcome = outcomeFromPrediction(homeScore, score);
                        setSelectedOutcome(outcome);
                        if (requiresAdvancer(match.round) && outcome !== 'X') setAdvancingTeam(outcome === '1' ? match.home_team : match.away_team);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center text-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#12d49a]/50 focus:border-[#12d49a]/50 transition-all"
                    />
                    <p className="text-[10px] text-white/40 mt-1.5 truncate">{match.away_team}</p>
                  </div>
                  </div>
                </div>
              )}

              {requiresAdvancer(match.round) && selectedOutcome === 'X' && (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                      {match.round === 'final' ? 'Who Wins The Final?' : 'Who Advances After The Draw?'}
                    </label>
                    <span className="text-xs font-semibold text-blue-300">+20 pts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[match.home_team, match.away_team].map((team) => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setAdvancingTeam(team)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                          advancingTeam === team
                            ? 'border-blue-400/60 bg-blue-500/20 text-blue-100 shadow-lg shadow-blue-500/10'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span className="mr-2">{team === match.home_team ? homeFlag : awayFlag}</span>
                        {team}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/40">This choice covers extra time and penalties. The X and exact score still refer to 90 minutes.</p>
                </div>
              )}

              {requiresAdvancer(match.round) && selectedOutcome !== 'X' && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100/70">
                  Your {selectedOutcome} pick also selects <strong className="text-blue-200">{selectedOutcome === '1' ? match.home_team : match.away_team}</strong> as the eventual winner. If the match is drawn after 90 minutes but that team advances, you receive 8 consolation points.
                </div>
              )}

              <div className="bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/50 mb-1">Potential outcome points</p>
                    <p className="text-amber-400 font-bold text-lg">
                      {outcomePoints} pts
                    </p>
                  </div>
                  {match.exact_score_enabled && selectedOutcome === (
                    homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
                  ) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-400">+50 pts bonus</span>
                    </div>
                  )}
                  {requiresAdvancer(match.round) && selectedOutcome === 'X' && (
                    <div className="ml-2 rounded-lg bg-blue-500/15 px-3 py-1.5 text-sm font-semibold text-blue-300">
                      +20 pts winner
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 font-medium transition-all duration-200"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="relative flex-1 rounded-xl bg-gradient-to-r from-[#12d49a] to-[#0ca678] py-3 font-semibold text-[#061017] shadow-lg shadow-[#12d49a]/25 transition-all duration-300 hover:from-[#41f4c2] hover:to-[#12d49a] disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Target className="w-4 h-4" />
                      Save Prediction
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
