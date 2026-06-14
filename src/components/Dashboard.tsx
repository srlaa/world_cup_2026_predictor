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
import { MundictoBrand } from './MundictoBrand';
import { getCountryFlag } from '../lib/countries';
import { Trophy, Target, LogOut, Flame, Zap, Crown, Calendar, TrendingUp, Users, BookOpen, ShieldCheck, WifiOff } from 'lucide-react';

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

const ROUND_SHORT_LABELS: Record<MatchRound, string> = {
  group_round_1: 'R1',
  group_round_2: 'R2',
  group_round_3: 'R3',
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarter_finals: 'QF',
  semi_finals: 'SF',
  third_place: '3rd',
  final: 'Final',
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
  const fetchRequestId = useRef(0);

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
    const requestId = ++fetchRequestId.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('round', activeTab)
        .order('kickoff_at', { ascending: true });
      if (matchesError) throw matchesError;
      if (requestId !== fetchRequestId.current) return;

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
      if (requestId !== fetchRequestId.current) return;

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
      if (requestId !== fetchRequestId.current) return;

      setRoundGoalPrediction(roundGoalData);
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load dashboard data');
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
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

  const upcomingRoundMatches = matches.filter((match) => match.status === 'scheduled' && new Date(match.kickoff_at) > new Date());
  const unpredicted = upcomingRoundMatches.filter((match) => !predictions[match.id]);
  const completedRoundPicks = upcomingRoundMatches.length - unpredicted.length;
  const roundPickProgress = upcomingRoundMatches.length > 0
    ? (completedRoundPicks / upcomingRoundMatches.length) * 100
    : 100;
  const nextKickoff = matches.find((match) => match.status === 'scheduled' && new Date(match.kickoff_at) > new Date());
  const nextKickoffDate = nextKickoff ? new Date(nextKickoff.kickoff_at) : null;
  const nextKickoffDay = nextKickoffDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const nextKickoffTime = nextKickoffDate?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const nextHomeFlag = nextKickoff ? getCountryFlag(nextKickoff.home_team) : null;
  const nextAwayFlag = nextKickoff ? getCountryFlag(nextKickoff.away_team) : null;
  const reviewMissingPicks = () => {
    const firstMissing = unpredicted[0];
    if (!firstMissing) return;
    document.getElementById(`match-${firstMissing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const changeRound = (round: MatchRound) => {
    if (round === activeTab) return;
    fetchRequestId.current += 1;
    setLoading(true);
    setMatches([]);
    setPredictions({});
    setRoundGoalPrediction(null);
    setError(null);
    setActiveTab(round);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0f1a] pb-28 sm:pb-0">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#12d49a]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-[#12d49a]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-[#41f4c2]/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0f1a]/92 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <MundictoBrand compact />

            <div className="hidden min-w-0 flex-1 justify-center px-4 sm:flex">
              <div className="inline-flex items-center gap-1 rounded-xl border border-white/5 bg-[#111a27] p-1">
                <button
                  onClick={() => { setShowRules(false); setActiveView('matches'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
                    activeView === 'matches'
                      ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Target className="h-4 w-4" />
                  <span>Matches</span>
                </button>
                <button
                  onClick={() => { setShowRules(false); setActiveView('leagues'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ${activeView === 'leagues' ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                  title="Private leagues"
                >
                  <Users className="h-4 w-4" />
                  <span>Leagues</span>
                </button>
                {profile?.is_admin && <button onClick={() => { setShowRules(false); setActiveView('health'); }} className={`hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all lg:flex ${activeView === 'health' && !showRules ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`} title="System health"><ShieldCheck className="h-4 w-4" /></button>}
                <button onClick={() => setShowRules(true)} className={`flex items-center justify-center rounded-lg px-3 py-1.5 transition-all ${showRules ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`} title="Game rules"><BookOpen className="h-4 w-4" /></button>
                <button
                  onClick={() => { setShowRules(false); setActiveView('leaderboard'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
                    activeView === 'leaderboard'
                      ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>Leaderboard</span>
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-[#1a2332] to-[#141d2b] p-1.5 sm:flex sm:px-4 sm:py-2">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#41f4c2] to-[#12b886] text-sm font-bold text-[#061017] shadow-lg shadow-[#12d49a]/25 ring-2 ring-[#41f4c2]/20">
                    {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0f1a] bg-[#12d49a]" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-white">{profile?.display_name}</p>
                  <p className="text-xs text-white/50">Online</p>
                </div>
              </div>

              <button
                onClick={signOut}
                className="rounded-xl border border-white/5 p-2.5 text-white/60 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[70] rounded-[1.35rem] border border-white/10 bg-[#141d2b]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:hidden">
        <div className="grid items-center gap-1" style={{ gridTemplateColumns: profile?.is_admin ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
          <button
            onClick={() => { setShowRules(false); setActiveView('matches'); }}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ${
              activeView === 'matches' && !showRules
                ? 'bg-gradient-to-b from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/25'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Target className="h-5 w-5" />
            <span>Matches</span>
          </button>
          <button
            onClick={() => { setShowRules(false); setActiveView('leagues'); }}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ${activeView === 'leagues' && !showRules ? 'bg-gradient-to-b from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/25' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
          >
            <Users className="h-5 w-5" />
            <span>Leagues</span>
          </button>
          {profile?.is_admin && (
            <button
              onClick={() => { setShowRules(false); setActiveView('health'); }}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ${activeView === 'health' && !showRules ? 'bg-gradient-to-b from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/25' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Admin</span>
            </button>
          )}
          <button onClick={() => setShowRules(true)} className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ${showRules ? 'bg-gradient-to-b from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/25' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}>
            <BookOpen className="h-5 w-5" />
            <span>Rules</span>
          </button>
          <button
            onClick={() => { setShowRules(false); setActiveView('leaderboard'); }}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ${
              activeView === 'leaderboard' && !showRules
                ? 'bg-gradient-to-b from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/25'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Trophy className="h-5 w-5" />
            <span>Table</span>
          </button>
        </div>
      </nav>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!isOnline && <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"><WifiOff className="h-4 w-4" />You are offline. Saved data remains visible, but new predictions cannot be submitted.</div>}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {activeView === 'matches' && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_0.85fr]">
              <div className="col-span-2 flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 lg:col-span-1">
                <div className="flex min-h-7 items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#41f4c2]/70">Tournament pulse</p>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">WC 2026</span>
                </div>
                <div className="relative mt-3 grid flex-1 grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-[#061017]/30">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-red-400/40 via-[#41f4c2]/35 to-amber-300/40" />
                  <div className="flex min-w-0 flex-col justify-center px-4 py-3">
                    <p className="text-2xl font-black leading-none text-white">{stats.liveMatches}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full bg-red-400 ${stats.liveMatches ? 'animate-pulse' : 'opacity-45'}`} />
                      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">Live now</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col justify-center border-x border-white/10 px-4 py-3">
                    <p className="text-2xl font-black leading-none text-white">{stats.upcomingMatches}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0 text-[#41f4c2]/70" />
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">Upcoming</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col justify-center px-4 py-3">
                    <p className="text-2xl font-black leading-none text-white">{stats.totalPredictions}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Target className="h-3 w-3 shrink-0 text-amber-300/70" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">Your picks</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative col-span-2 overflow-hidden rounded-2xl border border-[#41f4c2]/15 bg-gradient-to-br from-[#12d49a]/12 via-white/[0.045] to-white/[0.025] p-4 shadow-xl shadow-black/10 sm:col-span-1">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#12d49a]/15 blur-2xl" />
                <div className="relative flex h-full flex-col">
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Next kickoff</p>
                    {nextKickoffDate && (
                      <p className="shrink-0 text-[11px] font-bold text-[#41f4c2]">{nextKickoffDay} <span className="mx-1 text-white/20">·</span> <span className="text-white/55">{nextKickoffTime}</span></p>
                    )}
                  </div>

                  {nextKickoff ? (
                    <div className="mt-3 flex flex-1 items-center rounded-2xl border border-white/10 bg-[#061017]/35 px-3 py-3">
                      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="text-3xl leading-none">{nextHomeFlag}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{nextKickoff.home_team}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Home</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 px-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#41f4c2]/70" />
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">vs</span>
                        </div>
                        <div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{nextKickoff.away_team}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Away</p>
                          </div>
                          <span className="text-3xl leading-none">{nextAwayFlag}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-[#061017]/45 p-4">
                      <p className="text-sm font-black text-white">No upcoming match</p>
                      <p className="mt-1 text-xs font-medium text-white/45">All scheduled matches are already covered.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={`col-span-2 flex h-full flex-col rounded-2xl border p-4 shadow-xl shadow-black/10 sm:col-span-1 ${
                unpredicted.length
                  ? 'border-amber-300/20 bg-amber-300/[0.07]'
                  : 'border-[#41f4c2]/15 bg-[#12d49a]/[0.07]'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Missing picks</p>
                  <Target className={`h-4 w-4 ${unpredicted.length ? 'text-amber-300/70' : 'text-[#41f4c2]/70'}`} />
                </div>

                <div className="my-auto py-3 text-center">
                  <p className={`text-4xl font-black leading-none ${unpredicted.length ? 'text-amber-300' : 'text-[#41f4c2]'}`}>{unpredicted.length}</p>
                  <p className="mt-1.5 text-xs font-semibold text-white/50">
                    {unpredicted.length ? 'matches still need a pick' : 'Every match is covered'}
                  </p>
                </div>

                <div className="mt-auto">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-white/40">
                    <span>{completedRoundPicks} of {upcomingRoundMatches.length} picked</span>
                    <span>{Math.round(roundPickProgress)}%</span>
                  </div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={`h-full rounded-full transition-all ${unpredicted.length ? 'bg-amber-300/70' : 'bg-[#41f4c2]'}`}
                      style={{ width: `${roundPickProgress}%` }}
                    />
                  </div>
                  {unpredicted.length > 0 ? (
                    <button
                      type="button"
                      onClick={reviewMissingPicks}
                      className="w-full rounded-xl border border-amber-300/25 bg-amber-300/12 px-4 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-300/18"
                    >
                      Review missing picks
                    </button>
                  ) : (
                    <div className="rounded-xl border border-[#41f4c2]/15 bg-[#12d49a]/10 px-4 py-2 text-center text-xs font-bold text-[#41f4c2]">
                      Ready for kickoff
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{ROUND_LABELS[activeTab]}</p>
                  <p className="text-xs text-white/40">
                    {matches.filter((match) => match.status === 'finished').length} of {matches.filter((match) => match.status !== 'cancelled').length} matches finished
                  </p>
                </div>
                {ROUND_MULTIPLIERS[activeTab] > 1 && (
                  <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-300">x{ROUND_MULTIPLIERS[activeTab]} points</span>
                )}
              </div>
              <div className="grid auto-cols-[minmax(4.25rem,1fr)] grid-flow-col gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1 scrollbar-hide md:grid-flow-row md:grid-cols-9 md:overflow-visible">
                {ROUNDS.map((round) => {
                  const roundMatches = matches.filter(m => m.round === round);
                  const isActive = activeTab === round;
                  const finishedCount = roundMatches.filter(m => m.status === 'finished').length;

                  return (
                    <button
                      key={round}
                      onClick={() => changeRound(round)}
                      title={ROUND_LABELS[round]}
                      aria-label={`Show ${ROUND_LABELS[round]}`}
                      className={`group relative flex min-w-[4.25rem] items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 md:min-w-0 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#12d49a] to-[#0ca678] text-[#061017] shadow-lg shadow-[#12d49a]/20'
                          : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-x-3 -bottom-1 h-px rounded-full bg-[#41f4c2]/70" />
                      )}
                      <div className="flex items-center gap-1.5">
                        <span>{ROUND_SHORT_LABELS[round]}</span>
                        {finishedCount > 0 && !isActive && (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                            {finishedCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!loading && matches.length > 0 && (
              <div className="mb-8 animate-fadeIn">
                <RoundGoalForm
                  key={activeTab}
                  round={activeTab}
                  roundStartAt={matches[0].kickoff_at}
                  existingPrediction={roundGoalPrediction || undefined}
                  onUpdate={fetchData}
                />
              </div>
            )}

            <RoundSummary matches={matches} predictions={predictions} roundGoal={roundGoalPrediction} />

            {loading ? (
              <div className="grid gap-5 2xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
                      <div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-3 text-center">
                        <div className="mx-auto h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                        <div className="mx-auto h-4 w-24 rounded bg-white/10 animate-pulse" />
                      </div>
                      <div className="h-8 w-12 rounded bg-white/10 animate-pulse" />
                      <div className="flex-1 space-y-3 text-center">
                        <div className="mx-auto h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                        <div className="mx-auto h-4 w-24 rounded bg-white/10 animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-5 h-11 rounded-xl bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-20 animate-fadeIn">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-white/20" />
                </div>
                <p className="text-white/40 text-lg">No matches scheduled for this round</p>
              </div>
            ) : (
              <div className="grid gap-5 animate-fadeIn 2xl:grid-cols-2">
                {matches.map((match, index) => (
                  <div
                    key={match.id}
                    id={`match-${match.id}`}
                    className={`scroll-mt-36 transform rounded-2xl transition-all duration-500 ${
                      unpredicted.some((missingMatch) => missingMatch.id === match.id)
                        ? 'ring-1 ring-amber-400/20'
                        : ''
                    }`}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const { user } = useAuth();

  const totalPoints = useCallback((entry: LeaderboardEntry) =>
    Math.ceil(Number(entry.total_match_points || 0) + Number(entry.total_round_goal_points || 0)), []);

  const profileName = (entry: LeaderboardEntry) => entry.profiles?.display_name || 'Unknown';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setLoadError(null);
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
        setLoadError(error instanceof Error ? error.message : 'Could not load leaderboard');
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

  const currentUserIndex = entries.findIndex((entry) => entry.user_id === user?.id);
  const currentUserEntry = currentUserIndex >= 0 ? entries[currentUserIndex] : null;

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

      {loadError && (
        <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-semibold">Leaderboard could not be loaded.</p>
          <p className="mt-1 text-red-200/70">{loadError}</p>
        </div>
      )}

      {currentUserEntry && (
        <button
          type="button"
          onClick={() => setSelectedPlayer(currentUserEntry)}
          className="mb-6 flex w-full items-center justify-between gap-4 rounded-2xl border border-[#41f4c2]/20 bg-[#12d49a]/10 px-4 py-3 text-left hover:bg-[#12d49a]/15"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#41f4c2]/70">Your position</p>
            <p className="mt-1 font-semibold text-white">#{currentUserIndex + 1} of {entries.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-[#41f4c2]">{totalPoints(currentUserEntry)}</p>
            <p className="text-xs text-white/40">points · view picks</p>
          </div>
        </button>
      )}

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
          {entries[0] && currentUserIndex !== 0 && (
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
