import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Match, type Prediction, type RoundGoal, ROUND_LABELS, type MatchRound } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MatchCard } from './MatchCard';
import { RoundGoalForm } from './RoundGoalForm';
import { Trophy, Target, LogOut, Loader2, RefreshCw, Flame, Zap, Medal, Crown, ChevronRight, Activity, Calendar, TrendingUp, Users, Database, Wifi } from 'lucide-react';

const ROUNDS: MatchRound[] = [
  'group_round_1',
  'group_round_2',
  'group_round_3',
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
];

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<MatchRound>('group_round_1');
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [roundGoalPrediction, setRoundGoalPrediction] = useState<RoundGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'matches' | 'leaderboard'>('matches');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stats, setStats] = useState({ totalPredictions: 0, liveMatches: 0, upcomingMatches: 0 });
  const updateIntervalRef = useRef<number | null>(null);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSyncResult({ success: true, message: data.message });
      } else {
        setSyncResult({ success: false, message: data.message || data.error || 'Sync failed' });
      }
      await fetchData(false);
    } catch (error) {
      console.error('Error triggering sync:', error);
      setSyncResult({ success: false, message: 'Failed to connect to sync service' });
    } finally {
      setSyncing(false);
    }
  }, []);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('round', activeTab)
        .order('kickoff_at', { ascending: true });

      if (matchesData) setMatches(matchesData);

      const { data: allMatches } = await supabase
        .from('matches')
        .select('status');

      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*');

      if (predictionsData) {
        const predMap: Record<string, Prediction> = {};
        predictionsData.forEach((p) => {
          predMap[p.match_id] = p;
        });
        setPredictions(predMap);

        if (allMatches) {
          setStats({
            totalPredictions: predictionsData.length,
            liveMatches: allMatches.filter(m => m.status === 'live').length,
            upcomingMatches: allMatches.filter(m => m.status === 'scheduled').length,
          });
        }
      }

      const { data: roundGoalData } = await supabase
        .from('round_goals')
        .select('*')
        .eq('round', activeTab)
        .maybeSingle();

      setRoundGoalPrediction(roundGoalData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const triggerScoreUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/update-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });
      await fetchData(false);
    } catch (error) {
      console.error('Error triggering score update:', error);
    } finally {
      setUpdating(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    updateIntervalRef.current = window.setInterval(() => {
      triggerScoreUpdate();
    }, 30 * 60 * 1000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [fetchData, triggerScoreUpdate]);

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-500" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">World Cup 2026</h1>
                <p className="text-xs text-emerald-400/80 font-medium tracking-wide">Predictor Challenge</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:grid grid-cols-3 gap-3 mr-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                  <Activity className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-xs text-white/70">{stats.liveMatches} Live</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-white/70">{stats.upcomingMatches} Upcoming</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-white/70">{stats.totalPredictions} Picks</span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#1a2332] backdrop-blur-sm rounded-xl p-1 border border-white/5">
                <button
                  onClick={() => setActiveView('matches')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeView === 'matches'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  <span className="hidden sm:inline">Matches</span>
                </button>
                <button
                  onClick={() => setActiveView('leaderboard')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeView === 'leaderboard'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">Leaderboard</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-[#1a2332] to-[#141d2b] rounded-xl border border-white/10">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/20">
                      {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0f1a]" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-white">{profile?.display_name}</p>
                    <p className="text-xs text-white/50">Online</p>
                  </div>
                </div>

                <button
                  onClick={triggerSync}
                  disabled={syncing}
                  className="p-2.5 text-white/60 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all duration-200 disabled:opacity-50 border border-white/5"
                  title="Sync from API"
                >
                  <Database className={`w-5 h-5 ${syncing ? 'animate-pulse' : ''}`} />
                </button>

                <button
                  onClick={() => {
                    triggerScoreUpdate();
                    fetchData();
                  }}
                  disabled={updating}
                  className="p-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 disabled:opacity-50 border border-white/5"
                  title="Refresh scores"
                >
                  <RefreshCw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={signOut}
                  className="p-2.5 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 border border-white/5"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {syncResult && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-xl animate-fadeIn ${
          syncResult.success
            ? 'bg-emerald-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {syncResult.success ? <Wifi className="w-4 h-4" /> : <Database className="w-4 h-4" />}
            <span className="text-sm font-medium">{syncResult.message}</span>
          </div>
        </div>
      )}

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeView === 'matches' && (
          <>
            <div className="mb-8">
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide [-webkit-mask-image:linear-gradient(90deg,black,black,transparent)] [mask-image:linear-gradient(90deg,black,calc(100%-20px),transparent)]">
                {ROUNDS.map((round, index) => {
                  const roundMatches = matches.filter(m => m.round === round);
                  const isActive = activeTab === round;
                  const finishedCount = roundMatches.filter(m => m.status === 'finished').length;

                  return (
                    <button
                      key={round}
                      onClick={() => setActiveTab(round)}
                      className={`group relative flex-shrink-0 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 scale-105'
                          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 blur-xl opacity-50 -z-10" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-base">{index < 3 ? '⚽' : index < 5 ? '🏆' : '👑'}</span>
                        <span>{ROUND_LABELS[round]}</span>
                        {finishedCount > 0 && !isActive && (
                          <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
                            {finishedCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab !== 'group_round_1' && (
              <div className="mb-8 animate-fadeIn">
                <RoundGoalForm
                  round={activeTab}
                  existingPrediction={roundGoalPrediction || undefined}
                  onUpdate={fetchData}
                />
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-emerald-500/80 rounded-full border-t-transparent animate-spin" />
                </div>
                <p className="mt-4 text-white/60 text-sm animate-pulse">Loading matches...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-white/20" />
                </div>
                <p className="text-white/40 text-lg">No matches scheduled for this round</p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2 animate-fadeIn">
                {matches.map((match, index) => (
                  <div
                    key={match.id}
                    className="transform transition-all duration-500"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <MatchCard
                      match={match}
                      prediction={predictions[match.id]}
                      onUpdate={fetchData}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'leaderboard' && <Leaderboard />}
      </main>
    </div>
  );
}

function Leaderboard() {
  interface LeaderboardEntry {
    user_id: string;
    total_match_points: number;
    total_round_goal_points: number;
    exact_score_bonuses: number;
    profiles: { display_name: string } | null;
  }

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_scores')
          .select(`
            user_id,
            total_match_points,
            total_round_goal_points,
            exact_score_bonuses,
            profiles ( display_name )
          `)
          .order('total_match_points', { ascending: false });

        if (data) setEntries(data as LeaderboardEntry[]);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const totalPoints = (entry: LeaderboardEntry) =>
    (entry.total_match_points || 0) + (entry.total_round_goal_points || 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-emerald-500/80 rounded-full border-t-transparent animate-spin" />
        </div>
        <p className="mt-4 text-white/60 text-sm animate-pulse">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent flex items-center gap-3">
          <div className="relative">
            <Trophy className="w-7 h-7 text-emerald-400" />
            <div className="absolute inset-0 text-emerald-400 blur-lg opacity-50" />
          </div>
          Global Leaderboard
        </h2>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Users className="w-4 h-4" />
          {entries.length} players
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 bg-gradient-to-b from-white/5 to-transparent border border-white/5 rounded-2xl">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center ring-1 ring-white/10">
            <Trophy className="w-12 h-12 text-emerald-400/40" />
          </div>
          <p className="text-white/40 text-lg font-medium">No scores yet</p>
          <p className="text-white/30 text-sm mt-2">Make predictions to compete on the leaderboard!</p>
        </div>
      ) : (
        <>
          {entries[0] && (
            <div className="mb-8 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/40">
                    <Crown className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold shadow-lg">
                    1
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-amber-300/70 text-sm font-medium mb-1">Current Leader</p>
                  <p className="text-2xl font-bold text-white">{entries[0].profiles?.display_name || 'Unknown'}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold text-lg">{totalPoints(entries[0]).toFixed(1)}</span>
                      <span className="text-sm text-white/40">pts</span>
                    </div>
                    {entries[0].exact_score_bonuses > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <Flame className="w-4 h-4" />
                        <span className="text-sm">{entries[0].exact_score_bonuses} perfect scores</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/5 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-sm font-semibold text-white/40 border-b border-white/5 uppercase tracking-wider text-xs">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-right">Match</div>
              <div className="col-span-2 text-right">Round</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            <div className="divide-y divide-white/5">
              {entries.map((entry, index) => {
                const isCurrentUser = entry.user_id === user?.id;
                const total = totalPoints(entry);

                return (
                  <div
                    key={entry.user_id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all duration-300 ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="col-span-1">
                      <div className="flex items-center justify-center">
                        {index === 0 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-400/30">
                            1
                          </div>
                        ) : index === 1 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-slate-800 font-bold shadow-lg">
                            2
                          </div>
                        ) : index === 2 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-bold shadow-lg">
                            3
                          </div>
                        ) : (
                          <span className="text-white/40 font-medium">{index + 1}</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm ${
                        isCurrentUser
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/30'
                          : 'bg-gradient-to-br from-slate-600 to-slate-700'
                      } text-white`}>
                        {entry.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className={`font-semibold ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
                          {entry.profiles?.display_name || 'Unknown'}
                        </span>
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            You
                          </span>
                        )}
                        {entry.exact_score_bonuses > 0 && (
                          <div className="flex items-center gap-1 text-amber-400/70 text-xs mt-0.5">
                            <Zap className="w-3 h-3" />
                            {entry.exact_score_bonuses} perfect
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-white/80 font-medium">
                        {Number(entry.total_match_points || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-white/80 font-medium">
                        {entry.total_round_goal_points || 0}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`font-bold text-lg ${
                        index === 0 ? 'text-amber-400' :
                        index === 1 ? 'text-slate-300' :
                        index === 2 ? 'text-amber-600' :
                        'text-emerald-400'
                      }`}>
                        {total.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
