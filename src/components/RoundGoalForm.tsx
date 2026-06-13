import { useState, useEffect, type FormEvent } from 'react';
import { supabase, ROUND_LABELS, type MatchRound, type RoundGoal } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Target, Lock, Check, TrendingUp, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface RoundGoalFormProps {
  round: MatchRound;
  existingPrediction?: RoundGoal;
  onUpdate: () => void;
}

function isRoundLocked(round: MatchRound): boolean {
  const roundStartDates: Record<MatchRound, string> = {
    group_round_1: '2026-06-11T00:00:00Z',
    group_round_2: '2026-06-17T00:00:00Z',
    group_round_3: '2026-06-24T00:00:00Z',
    round_of_32: '2026-07-03T00:00:00Z',
    round_of_16: '2026-07-05T00:00:00Z',
    quarter_finals: '2026-07-09T00:00:00Z',
    semi_finals: '2026-07-13T00:00:00Z',
    third_place: '2026-07-19T00:00:00Z',
    final: '2026-07-19T00:00:00Z',
  };

  return new Date() >= new Date(roundStartDates[round]);
}

export function RoundGoalForm({ round, existingPrediction, onUpdate }: RoundGoalFormProps) {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(isRoundLocked(round));
  const [predictedGoals, setPredictedGoals] = useState(existingPrediction?.predicted_total_goals ?? 20);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const checkLock = () => setIsLocked(isRoundLocked(round));
    checkLock();
    const interval = setInterval(checkLock, 60000);
    return () => clearInterval(interval);
  }, [round]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || isLocked || saving) return;

    setSaving(true);

    try {
      if (existingPrediction) {
        const { error } = await supabase
          .from('round_goals')
          .update({ predicted_total_goals: predictedGoals })
          .eq('id', existingPrediction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('round_goals')
          .insert({
            user_id: user.id,
            round,
            predicted_total_goals: predictedGoals,
          });

        if (error) throw error;
      }

      setShowForm(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving round goal prediction:', error);
    } finally {
      setSaving(false);
    }
  };

  if (isLocked && !existingPrediction) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-white/40">
          <Lock className="w-4 h-4" />
          <span className="text-sm">Round goals prediction locked - round has started</span>
        </div>
      </div>
    );
  }

  if (existingPrediction && existingPrediction.actual_total_goals !== null) {
    const difference = Math.abs(existingPrediction.predicted_total_goals - existingPrediction.actual_total_goals);
    const deduction = difference * 2;
    const points = Math.max(0, 100 - deduction);

    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Round Goals Challenge</h3>
              <p className="text-xs text-white/50">{ROUND_LABELS[round]}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-5">
            <div className="bg-white/5 rounded-xl py-4 border border-white/10">
              <p className="text-xs text-white/50 mb-1">Your Guess</p>
              <p className="text-3xl font-bold text-white">{existingPrediction.predicted_total_goals}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl py-4 border border-emerald-500/20">
              <p className="text-xs text-emerald-400/70 mb-1">Actual</p>
              <p className="text-3xl font-bold text-emerald-400">{existingPrediction.actual_total_goals}</p>
            </div>
            <div className={`rounded-xl py-4 border ${
              points > 0
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-white/5 border-white/10'
            }`}>
              <p className="text-xs text-white/50 mb-1">Points</p>
              <p className={`text-3xl font-bold ${points > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
                {existingPrediction.points_awarded ?? points}
              </p>
            </div>
          </div>

          {difference > 0 && (
            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <TrendingUp className="w-4 h-4" />
              Missed by {difference} goal{difference !== 1 ? 's' : ''} (-{deduction} pts)
            </div>
          )}
          {difference === 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-medium">
              <Check className="w-4 h-4" />
              Perfect prediction!
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!showForm && existingPrediction && !isLocked) {
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50 mb-0.5">Round Goals Prediction</p>
              <p className="text-white font-semibold">
                {existingPrediction.predicted_total_goals} goals
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Edit
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!showForm && !existingPrediction && !isLocked) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="group relative w-full bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent hover:from-amber-500/20 hover:via-yellow-500/10 border border-amber-500/20 rounded-2xl p-5 text-left transition-all overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-amber-400 font-semibold mb-0.5">Round Goals Challenge</p>
              <p className="text-xs text-white/50">Predict total goals scored in this round</p>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
        </div>
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 rounded-2xl p-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white">Round Goals Challenge</h3>
          <p className="text-xs text-white/50">{ROUND_LABELS[round]}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-white/70 mb-3">
            How many total goals will be scored in this round?
          </label>
          <input
            type="number"
            min="0"
            max="300"
            value={predictedGoals}
            onChange={(e) => setPredictedGoals(parseInt(e.target.value) || 0)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-center text-4xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 rounded-xl border border-amber-500/20">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">100</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Starting</p>
          </div>
          <div className="text-white/30">-</div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white/70">2</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Per Goal Missed</p>
          </div>
          <div className="text-white/30">=</div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">?</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Your Score</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 font-medium transition-all"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="relative flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-amber-500/30"
          >
            {saving ? 'Saving...' : 'Save Prediction'}
          </button>
        </div>
      </form>
    </div>
  );
}
