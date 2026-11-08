import { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { WeaponHudSilhouette } from './InGameHud';
import type { WeaponId } from '../../game/rules';

function PingBars({ pingMs = 18 }: { pingMs?: number }) {
  const isGood = pingMs < 65;
  const colorClass = isGood ? 'bg-[#22c55e]' : 'bg-[#f59e0b]';
  return (
    <div className="inline-flex items-end gap-0.5 h-3.5" title={`${pingMs} ms`}>
      <span className={`w-1 h-1.5 ${colorClass}`} />
      <span className={`w-1 h-2.5 ${colorClass}`} />
      <span className={`w-1 h-3.5 ${isGood ? colorClass : 'bg-white/25'}`} />
    </div>
  );
}

function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(2).replace(/\.00$/, '')}k`;
  }
  return score.toString();
}

export function GameOverScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const selectClassAndDeploy = useGameStore((s) => s.selectClassAndDeploy);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const playerName = useGameStore((s) => s.playerName);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const localKills = useGameStore((s) => s.localKills);
  const localDeaths = useGameStore((s) => s.localDeaths);
  const localScore = useGameStore((s) => s.localScore);
  const alphaScore = useGameStore((s) => s.alphaScore);
  const bravoScore = useGameStore((s) => s.bravoScore);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const isLoggedIn = useGameStore((s) => s.isLoggedIn);
  const toggleLogin = useGameStore((s) => s.toggleLogin);

  const isFfa = selectedModeId === 'FFA';

  const handlePlayAgain = () => {
    selectClassAndDeploy(selectedClass);
  };

  const handleReturnToLobby = () => {
    setScreen('main_menu');
  };

  // Compile team rosters with full stats
  const { alphaRows, bravoRows, ffaRows } = useMemo(() => {
    const localEntry = {
      id: 'local',
      name: playerName,
      team: playerTeam,
      score: localScore,
      kills: localKills,
      deaths: localDeaths,
      weaponClass: selectedClass,
      ping: 16,
      isLocal: true,
    };

    const remList = Object.values(remotePlayers).map((r, i) => ({
      id: r.id,
      name: r.name,
      team: r.team,
      score: r.score,
      kills: r.kills,
      deaths: r.deaths,
      weaponClass: r.weaponClass,
      ping: r.ping || (18 + (i % 3) * 12),
      isLocal: false,
    }));

    const all = [localEntry, ...remList];

    const aList = all.filter((p) => p.team === 'alpha').sort((a, b) => b.score - a.score);
    const bList = all.filter((p) => p.team === 'bravo').sort((a, b) => b.score - a.score);
    const ffaList = [...all].sort((a, b) => b.score - a.score);

    return {
      alphaRows: aList,
      bravoRows: bList,
      ffaRows: ffaList,
    };
  }, [playerName, playerTeam, localScore, localKills, localDeaths, selectedClass, remotePlayers]);

  return (
    <div
      data-testid="game-over-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between py-6 px-8 bg-black/75 backdrop-blur-[6px] select-none text-white pointer-events-auto"
    >
      {/* Top Header: "GAME OVER" with Horizontal Glowing Red Bars & Split Score Banner (Image 1) */}
      <div className="flex flex-col items-center w-full max-w-4xl mt-1">
        {/* Horizontal Red Accent Framed Title */}
        <div className="relative w-full flex items-center justify-center py-2">
          {/* Top & Bottom Red Glow Bars */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#dc2626] to-transparent opacity-90 shadow-[0_0_12px_#dc2626]" />
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#dc2626] to-transparent opacity-90 shadow-[0_0_12px_#dc2626]" />

          <h1 className="text-[64px] font-black uppercase tracking-wider text-[#ef4444] drop-shadow-[0_4px_16px_rgba(220,38,38,0.7)] leading-tight">
            GAME OVER
          </h1>
        </div>

        {/* Score Banner: Blue vs Red for TDM, or Single Match Stats for FFA */}
        {isFfa ? (
          <div className="flex items-center justify-center mt-3 shadow-2xl">
            <div className="flex items-center h-11 rounded overflow-hidden border border-amber-500/50 bg-black/80 px-6 gap-4 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <span className="text-sm font-black text-amber-400 uppercase tracking-widest">
                ⚔️ FREE FOR ALL
              </span>
              <span className="text-white/30">|</span>
              <span className="text-sm font-extrabold text-white">
                DEINE KILLS: <span className="text-emerald-400 font-mono-num">{localKills}</span>
              </span>
              <span className="text-white/30">|</span>
              <span className="text-sm font-extrabold text-white">
                PUNKTE: <span className="text-amber-400 font-mono-num">{localScore}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center mt-3 shadow-2xl">
            <div className="flex items-center h-11 rounded overflow-hidden border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              {/* Blue Team Score */}
              <div className="w-24 h-full bg-[#1d4ed8] flex items-center justify-center text-[28px] font-black text-white px-4 border-r border-black/40">
                {alphaScore}
              </div>
              {/* Red Team Score */}
              <div className="w-24 h-full bg-[#b91c1c] flex items-center justify-center text-[28px] font-black text-white px-4">
                {bravoScore}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Center Area: Left Sidebar (2v2 Event) + Scoreboard Table + Coin Reward */}
      <div className="relative w-full max-w-[980px] flex items-start justify-center gap-6 my-auto">
        {/* Left Sidebar Widget: "2v2 Event" Tabs & Login Prompt (Image 1) */}
        <div className="w-48 bg-black/60 border border-white/10 p-3 space-y-2 text-left self-center">
          <div className="bg-[#262626] text-center py-1 text-[13px] font-extrabold uppercase tracking-wide text-white/90 rounded-sm">
            2v2 Event
          </div>
          <div className="flex items-center gap-1 text-[11px] font-extrabold">
            <button
              type="button"
              className="flex-1 py-1 bg-[#374151] hover:bg-[#4b5563] text-white text-center rounded-xs transition-colors cursor-pointer"
            >
              Daily
            </button>
            <button
              type="button"
              className="flex-1 py-1 bg-[#1f2937] hover:bg-[#374151] text-white/70 text-center rounded-xs transition-colors cursor-pointer"
            >
              Weekly
            </button>
          </div>
          <div className="pt-2 text-[12px] font-bold text-white/80">
            <div>2v2 Event:</div>
            <div className="text-[11px] text-white/50 mt-1 leading-snug">
              {isLoggedIn ? 'Participating in daily ranked event!' : 'Log in to view 2v2 Event'}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLogin}
            className="w-full mt-2 py-1.5 bg-[#4b5563] hover:bg-[#6b7280] text-white text-[12px] font-extrabold rounded-xs transition-colors cursor-pointer"
          >
            {isLoggedIn ? 'Logged In' : 'Log In'}
          </button>
        </div>

        {/* Center: The Scoreboard Table (FFA or TDM) */}
        <div className="relative w-full max-w-[620px]">
          {/* Badges floating above columns: 1st (Gold) & 2nd (Silver) */}
          <div className="absolute -top-6 left-[48%] -translate-x-1/2 flex items-center gap-16 pointer-events-none select-none">
            <span className="text-[15px] font-black text-[#facc15] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              1st
            </span>
            <span className="text-[14px] font-black text-[#cbd5e1] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              2nd
            </span>
          </div>

          {/* Table Header Row */}
          <div className="grid grid-cols-12 px-3 pb-1 text-[15px] font-black text-white/95 drop-shadow">
            <div className="col-span-5 pl-5">Name</div>
            <div className="col-span-2 text-center">Score</div>
            <div className="col-span-1 text-center">K</div>
            <div className="col-span-1 text-center">D</div>
            <div className="col-span-2 text-center">Weapon</div>
            <div className="col-span-1 text-right pr-2">Ping</div>
          </div>

          {isFfa ? (
            /* FFA Unified Leaderboard (All vs All) */
            <div className="space-y-[2px] max-h-[300px] overflow-y-auto pr-0.5">
              {ffaRows.map((row, idx) => {
                const isHighlighted = row.isLocal;
                const isTop3 = idx < 3;
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 items-center px-3 py-1.5 text-[15px] font-black text-white transition-all ${
                      isHighlighted
                        ? 'bg-amber-600/90 border-2 border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.6)] z-10 scale-[1.01]'
                        : isTop3
                          ? 'bg-white/12 border-b border-white/10'
                          : 'bg-white/5 border-b border-white/5'
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-2 truncate">
                      <span
                        className={`font-mono-num text-sm w-5 font-black ${
                          idx === 0
                            ? 'text-yellow-400'
                            : idx === 1
                              ? 'text-slate-200'
                              : idx === 2
                                ? 'text-amber-500'
                                : 'text-white/60'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      <span className="truncate">{row.name} {row.isLocal && '(Du)'}</span>
                    </div>
                    <div className="col-span-2 text-center font-mono-num font-bold">
                      {formatScore(row.score)}
                    </div>
                    <div className="col-span-1 text-center font-mono-num">{row.kills}</div>
                    <div className="col-span-1 text-center font-mono-num">{row.deaths}</div>
                    <div className="col-span-2 flex justify-center">
                      <WeaponHudSilhouette
                        weaponId={row.weaponClass}
                        className="w-16 h-5 text-white fill-current"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pr-2">
                      <PingBars pingMs={row.ping} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Team Blue Rows (Top 5 rows, Image 1) */}
              <div className="space-y-[2px] mb-2.5">
                {alphaRows.map((row, idx) => {
                  const isHighlighted = row.isLocal;
                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-12 items-center px-3 py-1.5 text-[15px] font-black text-white transition-all ${
                        isHighlighted
                          ? 'bg-[#1e40af]/90 border-2 border-[#93c5fd] shadow-[0_0_12px_rgba(147,197,253,0.5)] z-10 scale-[1.01]'
                          : 'bg-[#1e3a8a]/75 border-b border-black/25'
                      }`}
                    >
                      <div className="col-span-5 flex items-center gap-2 truncate">
                        <span className="font-mono-num text-white/80 text-sm w-4">{idx + 1}.</span>
                        <span className="truncate">{row.name}</span>
                      </div>
                      <div className="col-span-2 text-center font-mono-num font-bold">
                        {formatScore(row.score)}
                      </div>
                      <div className="col-span-1 text-center font-mono-num">{row.kills}</div>
                      <div className="col-span-1 text-center font-mono-num">{row.deaths}</div>
                      <div className="col-span-2 flex justify-center">
                        <WeaponHudSilhouette
                          weaponId={row.weaponClass}
                          className="w-16 h-5 text-white fill-current"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pr-2">
                        <PingBars pingMs={row.ping} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team Red Rows (Bottom 5 rows, Image 1) */}
              <div className="space-y-[2px]">
                {bravoRows.map((row, idx) => {
                  const isHighlighted = row.isLocal;
                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-12 items-center px-3 py-1.5 text-[15px] font-black text-white transition-all ${
                        isHighlighted
                          ? 'bg-[#991b1b]/95 border-2 border-[#fca5a5] shadow-[0_0_12px_rgba(252,165,165,0.5)] z-10 scale-[1.01]'
                          : 'bg-[#991b1b]/75 border-b border-black/25'
                      }`}
                    >
                      <div className="col-span-5 flex items-center gap-2 truncate">
                        <span className="font-mono-num text-white/80 text-sm w-4">{idx + 1}.</span>
                        <span className="truncate">{row.name}</span>
                      </div>
                      <div className="col-span-2 text-center font-mono-num font-bold">
                        {formatScore(row.score)}
                      </div>
                      <div className="col-span-1 text-center font-mono-num">{row.kills}</div>
                      <div className="col-span-1 text-center font-mono-num">{row.deaths}</div>
                      <div className="col-span-2 flex justify-center">
                        <WeaponHudSilhouette
                          weaponId={row.weaponClass}
                          className="w-16 h-5 text-white fill-current"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pr-2">
                        <PingBars pingMs={row.ping} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Gold Coin Reward Badge: "+11 🟡" (Image 1: right side of Red table rows) */}
          <div className="absolute -right-16 bottom-6 flex items-center gap-1 text-[16px] font-black text-white drop-shadow">
            <span>+11</span>
            <span className="w-4 h-4 rounded-full bg-[#facc15] border border-amber-300 shadow-[0_0_6px_#facc15] inline-block" />
          </div>
        </div>
      </div>

      {/* Bottom Controls: Prominent "PLAY AGAIN" Blue Button & "Return to Lobby" Grey Button (Image 1) */}
      <div className="flex flex-col items-center gap-2.5 mb-2">
        <button
          type="button"
          data-testid="game-over-play-again-btn"
          onClick={handlePlayAgain}
          className="w-72 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-[24px] font-black uppercase tracking-wider rounded shadow-[0_4px_18px_rgba(37,99,235,0.6)] transition-all transform hover:scale-[1.02] cursor-pointer"
        >
          PLAY AGAIN
        </button>

        <button
          type="button"
          data-testid="game-over-return-lobby-btn"
          onClick={handleReturnToLobby}
          className="w-72 py-2 bg-[#4b5563] hover:bg-[#6b7280] active:bg-[#374151] text-white/90 hover:text-white text-[16px] font-extrabold rounded shadow transition-all cursor-pointer"
        >
          Return to Lobby
        </button>
      </div>

      {/* Bottom-Left Chat Hint: "[Enter] to use chat" (Image 1) */}
      <div className="fixed bottom-3 left-4 text-[13px] font-bold text-white/50 pointer-events-none">
        [Enter] to use chat
      </div>
    </div>
  );
}

