import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Match, type Prediction, type RoundGoal, ROUND_LABELS, type MatchRound } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MatchCard } from './MatchCard';
import { RoundGoalForm } from './RoundGoalForm';
import { PlayerPredictionHistory } from './PlayerPredictionHistory';
import { LeaguePanel } from './LeaguePanel';
import { RoundSummary } from './RoundSummary';
import { RulesModal } from './RulesModal';
import { SystemHealth } from './SystemHealth';
import { Trophy, Target, LogOut, Flame, Zap, Crown, Activity, Calendar, TrendingUp, Users, BookOpen, ShieldCheck, WifiOff, Bell } from 'lucide-react';

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

const BOOST_LIMITS: Record<MatchRound, number> = {
  group_round_1: 6,
  group_round_2: 6,
  group_round_3: 6,
  round_of_32: 4,
  round_of_16: 2,
  quarter_finals: 1,
  semi_finals: 0,
  third_place: 0,
  final: 0,
};

const ROUND_MULTIPLIERS: Record<MatchRound, number> = {
  group_round_1: 1,
  group_round_2: 1,
  group_round_3: 1,
  round_of_32: 1,
  round_of_16: 1,
  quarter_finals: 1.5,
  semi_finals: 2,
  third_place: 1,
  final: 2,
};

interface LeaderboardEntry {
  user_id: string;
  total_match_points: number;
  total_round_goal_points: number;
  exact_score_bonuses: number;
  profiles: { display_name: string } | null;
}

export function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<MatchRound>('group_round_1');
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [roundGoalPrediction, setRoundGoalPrediction] = useState<RoundGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'matches' | 'leaderboard' | 'leagues' | 'health'>(() =>
    new URLSearchParams(window.location.search).has('league') ? 'leagues' : 'matches'
  );
  const [showRules, setShowRules] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalPredictions: 0, liveMatches: 0, upcomingMatches: 0 });
  const initialRoundSelected = useRef(false);

  useEffect(() => {
    if (!user || initialRoundSelected.current) return;
    initialRoundSelected.current = true;

    const selectCurrentRound = async () => {
      const { data } = await supabase
        .from('matches')
        .select('round, status, kickoff_at')
        .in('status', ['live', 'scheduled'])
        .order('kickoff_at', { ascending: true });

      if (!data?.length) return;
      const liveMatch = data.find((match) => match.status === 'live');
      const nextMatch = data.find((match) => new Date(match.kickoff_at) > new Date());
      const current = liveMatch ?? nextMatch ?? data[0];
      setActiveTab(current.round as MatchRound);
    };

    void selectCurrentRound();
  }, [user]);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('round', activeTab)
        .order('kickoff_at', { ascending: true });
      if (matchesError) throw matchesError;

      if (matchesData) setMatches(matchesData);

      const matchIds = (matchesData ?? []).map((match) => match.id);
      const predictionsQuery = supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id);

      const [liveResult, upcomingResult, predictionCountResult, predictionsResult] = await Promise.all([
        supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        matchIds.length > 0 ? predictionsQuery.in('match_id', matchIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (liveResult.error) throw liveResult.error;
      if (upcomingResult.error) throw upcomingResult.error;
      if (predictionCountResult.error) throw predictionCountResult.error;
      if (predictionsResult.error) throw predictionsResult.error;

      const predictionsData = predictionsResult.data;
      if (predictionsData) {
        const predMap: Record<string, Prediction> = {};
        predictionsData.forEach((prediction) => {
          predMap[prediction.match_id] = prediction;
        });
        setPredictions(predMap);
        setStats({
          totalPredictions: predictionCountResult.count ?? 0,
          liveMatches: liveResult.count ?? 0,
          upcomingMatches: upcomingResult.count ?? 0,
        });
      }

      const { data: roundGoalData, error: roundGoalError } = await supabase
        .from('round_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('round', activeTab)
        .maybeSingle();
      if (roundGoalError) throw roundGoalError;

      setRoundGoalPrediction(roundGoalData);
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`match-updates-${user?.id ?? 'anonymous'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          if (document.visibilityState === 'visible') void fetchData(false);
        },
      )
      .subscribe();

    const refreshInterval = 10 * 60_000;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchData(false);
    }, refreshInterval);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData(false);
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [fetchData, user?.id]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  const unpredicted = matches.filter((match) => match.status === 'scheduled' && new Date(match.kickoff_at) > new Date() && !predictions[match.id]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0f1a] pb-24 sm:pb-0">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex min-w-0 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-500" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="hidden min-w-0 sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">World Cup 2026</h1>
                <p className="text-xs text-emerald-400/80 font-medium tracking-wide">Predictor Challenge</p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
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

              <div className="fixed inset-x-3 bottom-3 z-[70] grid grid-cols-4 items-center gap-1 rounded-2xl border border-white/10 bg-[#141d2b]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:static sm:z-auto sm:flex sm:rounded-xl sm:border-white/5 sm:bg-[#1a2332] sm:p-1 sm:shadow-none">
                <button
                  onClick={() => setActiveView('matches')}
                  className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeView === 'matches'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  <span className="hidden sm:inline">Matches</span>
                </button>
                <button
                  onClick={() => setActiveView('leagues')}
                  className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-lg text-sm font-medium transition-all duration-300 ${activeView === 'leagues' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  title="Private leagues"
                >
                  <Users className="w-4 h-4" /><span className="hidden xl:inline">Leagues</span>
                </button>
                {profile?.is_admin && <button onClick={() => setActiveView('health')} className={`hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all lg:flex ${activeView === 'health' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`} title="System health"><ShieldCheck className="h-4 w-4" /></button>}
                <button onClick={() => setShowRules(true)} className="flex items-center justify-center rounded-xl px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white sm:rounded-lg" title="Game rules"><BookOpen className="h-4 w-4" /></button>
                <button
                  onClick={() => setActiveView('leaderboard')}
                  className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-lg text-sm font-medium transition-all duration-300 ${
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
                <div className="hidden items-center gap-3 bg-gradient-to-r from-[#1a2332] to-[#141d2b] rounded-xl border border-white/10 p-1.5 sm:flex sm:px-4 sm:py-2">
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

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!isOnline && <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"><WifiOff className="h-4 w-4" />You are offline. Saved data remains visible, but new predictions cannot be submitted.</div>}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
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

            {matches.length > 0 && (
              <div className="mb-8 animate-fadeIn">
                <RoundGoalForm
                  round={activeTab}
                  roundStartAt={matches[0].kickoff_at}
                  existingPrediction={roundGoalPrediction || undefined}
                  onUpdate={fetchData}
                />
              </div>
            )}

            {unpredicted.length > 0 && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-100/80">
                <Bell className="h-5 w-5 shrink-0 text-blue-300" />
                <span><strong>{unpredicted.length}</strong> {unpredicted.length === 1 ? 'match is' : 'matches are'} still waiting for your prediction in this round. Next kickoff: {new Date(unpredicted[0].kickoff_at).toLocaleString()}.</span>
              </div>
            )}

            <RoundSummary matches={matches} predictions={predictions} roundGoal={roundGoalPrediction} />

            {matches.length > 0 && (BOOST_LIMITS[activeTab] > 0 || ROUND_MULTIPLIERS[activeTab] > 1) && (
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-white/70">
                {BOOST_LIMITS[activeTab] > 0 && (
                  <span className="flex items-center gap-2">
                    <Flame className="w-4 h-4 fill-orange-400 text-orange-300" />
                    Fireballs x2: {Object.values(predictions).filter((prediction) =>
                      prediction.boost_used && matches.some((match) => match.id === prediction.match_id)
                    ).length}/{BOOST_LIMITS[activeTab]} used
                  </span>
                )}
                {ROUND_MULTIPLIERS[activeTab] > 1 && (
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-300">
                    Round outcome multiplier: x{ROUND_MULTIPLIERS[activeTab]}
                  </span>
                )}
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
                      boostLimit={BOOST_LIMITS[activeTab]}
                      boostsUsed={Object.values(predictions).filter((prediction) =>
                        prediction.boost_used && matches.some((roundMatch) => roundMatch.id === prediction.match_id)
                      ).length}
                      roundMultiplier={ROUND_MULTIPLIERS[activeTab]}
                      onUpdate={fetchData}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'leaderboard' && <Leaderboard />}
        {activeView === 'leagues' && <LeaguePanel />}
        {activeView === 'health' && profile?.is_admin && <SystemHealth />}
      </main>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const { user } = useAuth();

  const totalPoints = useCallback((entry: LeaderboardEntry) =>
    Math.ceil(Number(entry.total_match_points || 0) + Number(entry.total_round_goal_points || 0)), []);

  const profileName = (entry: LeaderboardEntry) => entry.profiles?.display_name || 'Unknown';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data, error: leaderboardError } = await supabase
          .from('user_scores')
          .select(`
            user_id,
            total_match_points,
            total_round_goal_points,
            exact_score_bonuses,
            profiles ( display_name )
          `)
          .order('total_match_points', { ascending: false });
        if (leaderboardError) throw leaderboardError;

        if (data) {
          const normalized: LeaderboardEntry[] = data.map((entry) => ({
            user_id: entry.user_id,
            total_match_points: Number(entry.total_match_points || 0),
            total_round_goal_points: Number(entry.total_round_goal_points || 0),
            exact_score_bonuses: Number(entry.exact_score_bonuses || 0),
            profiles: Array.isArray(entry.profiles) ? entry.profiles[0] ?? null : entry.profiles,
          }));
          normalized.sort((a, b) => totalPoints(b) - totalPoints(a));
          setEntries(normalized);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [totalPoints]);

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
        <div className="flex items-center gap-3">
          {entries.find((entry) => entry.user_id === user?.id) && (
            <button
              type="button"
              onClick={() => setSelectedPlayer(entries.find((entry) => entry.user_id === user?.id) ?? null)}
              className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              My picks
            </button>
          )}
          <div className="hidden items-center gap-2 text-sm text-white/50 sm:flex">
            <Users className="w-4 h-4" />
            {entries.length} players
          </div>
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
              <div className="relative flex items-center gap-4 sm:gap-6">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/40">
                    <Crown className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold shadow-lg">
                    1
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-amber-300/70 text-sm font-medium mb-1">Current Leader</p>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(entries[0])}
                    className="block max-w-full truncate text-left text-xl font-bold text-white hover:text-emerald-300 sm:text-2xl"
                    title={profileName(entries[0])}
                  >
                    {profileName(entries[0])}
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold text-lg">{totalPoints(entries[0])}</span>
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
            <div className="grid grid-cols-12 gap-2 px-3 py-4 text-xs font-semibold uppercase tracking-wider text-white/40 bg-white/5 border-b border-white/5 sm:gap-4 sm:px-6">
              <div className="col-span-2 text-center sm:col-span-1">Rank</div>
              <div className="col-span-7 sm:col-span-5">Player</div>
              <div className="hidden text-right sm:col-span-2 sm:block">Match</div>
              <div className="hidden text-right sm:col-span-2 sm:block">Round</div>
              <div className="col-span-3 text-right sm:col-span-2">Total</div>
            </div>

            <div className="divide-y divide-white/5">
              {entries.map((entry, index) => {
                const isCurrentUser = entry.user_id === user?.id;
                const total = totalPoints(entry);

                return (
                  <div
                    key={entry.user_id}
                    className={`grid grid-cols-12 gap-2 px-3 py-4 items-center transition-all duration-300 sm:gap-4 sm:px-6 ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="col-span-2 sm:col-span-1">
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
                    <div className="col-span-7 flex min-w-0 items-center gap-2 sm:col-span-5 sm:gap-3">
                      <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-semibold text-sm sm:h-10 sm:w-10 ${
                        isCurrentUser
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/30'
                          : 'bg-gradient-to-br from-slate-600 to-slate-700'
                      } text-white`}>
                        {profileName(entry)[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPlayer(entry)}
                            className={`min-w-0 truncate text-left font-semibold hover:text-emerald-300 ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}
                            title={profileName(entry)}
                          >
                            {profileName(entry)}
                          </button>
                          {isCurrentUser && (
                            <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500 sm:px-2 sm:text-xs">
                              You
                            </span>
                          )}
                        </div>
                        {entry.exact_score_bonuses > 0 && (
                          <div className="flex items-center gap-1 text-amber-400/70 text-xs mt-0.5">
                            <Zap className="w-3 h-3" />
                            {entry.exact_score_bonuses} perfect
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="hidden text-right sm:col-span-2 sm:block">
                      <span className="text-white/80 font-medium">
                        {Math.ceil(Number(entry.total_match_points || 0))}
                      </span>
                    </div>
                    <div className="hidden text-right sm:col-span-2 sm:block">
                      <span className="text-white/80 font-medium">
                        {entry.total_round_goal_points || 0}
                      </span>
                    </div>
                    <div className="col-span-3 text-right sm:col-span-2">
                      <span className={`font-bold text-lg ${
                        index === 0 ? 'text-amber-400' :
                        index === 1 ? 'text-slate-300' :
                        index === 2 ? 'text-amber-600' :
                        'text-emerald-400'
                      }`}>
                        {total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selectedPlayer && (
        <PlayerPredictionHistory
          userId={selectedPlayer.user_id}
          displayName={profileName(selectedPlayer)}
          isCurrentUser={selectedPlayer.user_id === user?.id}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
