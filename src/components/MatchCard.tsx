import { useState, useEffect, type FormEvent } from 'react';
import { supabase, type Match, type Prediction, ROUND_LABELS, type MatchRound } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCountryFlag } from '../lib/countries';
import { Clock, MapPin, Lock, Check, Trophy, Target, Zap, TrendingUp, ChevronDown, ChevronUp, Radio, Flag } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
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

export function MatchCard({ match, prediction, onUpdate }: MatchCardProps) {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(isMatchLocked(match.kickoff_at));
  const [editing, setEditing] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'1' | 'X' | '2'>(prediction?.predicted_outcome || '1');
  const [homeScore, setHomeScore] = useState(prediction?.predicted_home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.predicted_away_score ?? 0);
  const [saving, setSaving] = useState(false);

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

    try {
      if (prediction) {
        const { error } = await supabase
          .from('predictions')
          .update({
            predicted_outcome: selectedOutcome,
            predicted_home_score: homeScore,
            predicted_away_score: awayScore,
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
            predicted_home_score: homeScore,
            predicted_away_score: awayScore,
          });

        if (error) throw error;
      }

      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving prediction:', error);
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

  return (
    <div className={`group relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] border rounded-2xl p-5 transition-all duration-500 hover:shadow-xl ${
      isLive
        ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
        : isFinished
          ? 'border-white/10'
          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
    }`}>
      {isLive && (
        <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
            {ROUND_LABELS[match.round as MatchRound]}
          </span>
          {match.status === 'finished' && prediction && prediction.points_awarded > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" />
              +{prediction.points_awarded} pts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
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
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
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

      {isLocked && !prediction && !isFinished && (
        <div className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-xl border border-white/10">
          <Lock className="w-4 h-4 text-white/40" />
          <span className="text-white/50 text-sm">Prediction locked - match started</span>
        </div>
      )}

      {isFinished && prediction && (
        <div className="bg-gradient-to-b from-white/[0.06] to-transparent rounded-xl p-4 border border-white/10 mt-2">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white/40 text-xs mb-1">Your Pick</p>
              <p className={`font-semibold text-sm flex items-center justify-center gap-1 ${
                prediction.is_outcome_correct ? 'text-emerald-400' : 'text-white/60'
              }`}>
                {getOutcomeLabel(prediction.predicted_outcome)}
                {prediction.is_outcome_correct && <Check className="w-4 h-4" />}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Your Score</p>
              <p className={`font-semibold text-sm flex items-center justify-center gap-1 ${
                prediction.is_exact_score_correct ? 'text-amber-400' : 'text-white/60'
              }`}>
                {prediction.predicted_home_score}:{prediction.predicted_away_score}
                {prediction.is_exact_score_correct && <Zap className="w-3.5 h-3.5" />}
              </p>
            </div>
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
                +{pointsDisplay} pts
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
              className="group/btn relative w-full py-3 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 hover:from-emerald-500/20 hover:to-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 group-hover/btn:opacity-10 transition-opacity" />
              <Target className="w-4 h-4" />
              Make Prediction
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>
          )}

          {!editing && prediction && (
            <button
              onClick={() => setEditing(true)}
              className="group/btn w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 font-medium transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Prediction Made
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
                      onClick={() => setSelectedOutcome(outcome)}
                      className={`relative py-3 px-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        selectedOutcome === outcome
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {selectedOutcome === outcome && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 blur-xl opacity-50 -z-10" />
                      )}
                      <div className="text-lg font-bold">{outcome}</div>
                      <div className="text-xs opacity-80">
                        {outcome === '1' ? 'Home' : outcome === 'X' ? 'Draw' : 'Away'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">
                  Exact Score Prediction
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <div className="text-3xl mb-2">{homeFlag}</div>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={homeScore}
                      onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center text-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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
                      onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center text-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                    <p className="text-[10px] text-white/40 mt-1.5 truncate">{match.away_team}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/50 mb-1">Potential winnings</p>
                    <p className="text-amber-400 font-bold text-lg">
                      {(oddsForOutcome(selectedOutcome) * 10).toFixed(1)} pts
                    </p>
                  </div>
                  {selectedOutcome === (
                    homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X'
                  ) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-400">+50 pts bonus</span>
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
                  className="relative flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-xl text-white font-semibold transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/30"
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
