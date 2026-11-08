import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { WEAPON_CLASSES, type WeaponId } from '../../game/rules';
import { DynamicCrosshairSvg } from './CrosshairEditor';
import { SettingsPanel } from './SettingsPanel';
import { multiplayerManager } from '../../network/LocalMultiplayer';

export function WeaponHudSilhouette({
  weaponId,
  className = 'w-36 h-12 text-white/85 fill-current',
}: {
  weaponId: WeaponId;
  className?: string;
}) {
  if (weaponId === 'lidl_scanner') {
    return (
      <svg viewBox="0 0 160 48" className={className}>
        {/* Barcode Scanner Head + Handle + Laser Beams */}
        <rect x="42" y="8" width="58" height="18" rx="3" fill="#0050aa" stroke="#fff000" strokeWidth="2" />
        <rect x="52" y="14" width="36" height="5" fill="#fff000" />
        <rect x="98" y="9" width="6" height="16" fill="#e60014" />
        <polygon points="56,26 74,26 66,46 48,46" fill="#0050aa" stroke="#ffffff" strokeWidth="1.2" />
        <rect x="72" y="26" width="6" height="8" fill="#fff000" />
        <line x1="106" y1="13" x2="148" y2="7" stroke="#ff2e2e" strokeWidth="2" strokeDasharray="4 2" />
        <line x1="106" y1="17" x2="152" y2="17" stroke="#ff2e2e" strokeWidth="2.5" />
        <line x1="106" y1="21" x2="148" y2="27" stroke="#ff2e2e" strokeWidth="2" strokeDasharray="4 2" />
      </svg>
    );
  }
  if (weaponId === 'sniper' || weaponId === 'semi_sniper') {
    return (
      <svg viewBox="0 0 160 44" className={className}>
        <rect x="6" y="19" width="68" height="3.5" />
        <rect x="54" y="10" width="46" height="5" rx="1" />
        <rect x="64" y="15" width="4" height="4" />
        <rect x="86" y="15" width="4" height="4" />
        <polygon points="46,18 124,18 154,22 154,35 125,30 112,25 88,25 84,35 72,35 74,25 46,25" />
      </svg>
    );
  }
  if (weaponId === 'smg') {
    return (
      <svg viewBox="0 0 160 44" className={className}>
        <rect x="20" y="17" width="24" height="5" />
        <polygon points="44,12 115,12 115,24 78,24 72,41 56,41 52,24 44,24" />
        <rect x="115" y="14" width="32" height="6" />
      </svg>
    );
  }
  if (weaponId === 'shotgun') {
    return (
      <svg viewBox="0 0 160 44" className={className}>
        <rect x="12" y="16" width="86" height="6" />
        <polygon points="98,17 152,24 148,36 112,26 98,23" />
      </svg>
    );
  }
  // Assault Rifle / M4 silhouette (exact match to Screenshots 1 & 2 bottom-right)
  return (
    <svg viewBox="0 0 160 48" className={className}>
      <rect x="8" y="18" width="38" height="4" />
      <polygon points="28,18 33,9 36,9 35,18" />
      <rect x="44" y="15" width="32" height="10" />
      <rect x="76" y="14" width="38" height="13" />
      <rect x="88" y="8" width="16" height="6" />
      <polygon points="80,27 94,27 89,45 75,43" />
      <polygon points="104,27 112,27 109,39 100,39" />
      <polygon points="114,16 152,16 152,33 142,33 132,23 114,23" />
    </svg>
  );
}

/**
 * Sliding Stick-Figure Icon SVG (exact match to `[SHIFT] [sliding person] >>>` in Screenshots 1 & 2)
 */
function SlidingStickFigureIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 44 36"
      className={`w-9 h-8 transition-transform duration-150 ${active ? 'text-[#4da3ff] scale-110' : 'text-white/65'
        }`}
      fill="currentColor"
    >
      {/* Head */}
      <circle cx="15" cy="7" r="4.2" />
      {/* Leaning Torso */}
      <path
        d="M15 12 L22 23 L35 28"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arms */}
      <path
        d="M16 15 L9 21 L14 25"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bent Back Leg */}
      <path
        d="M21 23 L14 31 L22 33"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function PingBarsIcon({ pingMs = 18 }: { pingMs?: number }) {
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

/**
 * Centered In-Game Leaderboard Overlay when holding [TAB] (exact match to Screenshot 1 `image_908b9e2a.png`)
 */
function TabLeaderboardModal() {
  const playerName = useGameStore((s) => s.playerName);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const kills = useGameStore((s) => s.localKills);
  const deaths = useGameStore((s) => s.localDeaths);
  const score = useGameStore((s) => s.localScore);
  const remotePlayers = useGameStore((s) => s.remotePlayers);

  const allEntries = [
    {
      id: 'local',
      name: playerName,
      team: playerTeam,
      score,
      kills,
      deaths,
      weaponClass: selectedClass,
      isLocal: true,
      isBot: false,
      ping: 14,
    },
    ...Object.values(remotePlayers).map((r, idx) => ({
      id: r.id,
      name: r.name,
      team: r.team,
      score: r.score,
      kills: r.kills,
      deaths: r.deaths,
      weaponClass: r.weaponClass,
      isLocal: false,
      isBot: r.isBot,
      ping: r.ping || 18 + idx * 11,
    })),
  ];

  const alphaRows = allEntries
    .filter((p) => p.team === 'alpha')
    .sort((a, b) => b.score - a.score);
  const bravoRows = allEntries
    .filter((p) => p.team === 'bravo')
    .sort((a, b) => b.score - a.score);

  const renderTeamRows = (
    rows: typeof allEntries,
    teamColor: 'alpha' | 'bravo'
  ) =>
    rows.map((row, idx) => {
      const bgClass =
        teamColor === 'alpha' ? 'bg-[#3b78c8]/85' : 'bg-[#b53834]/85';
      const borderClass = row.isLocal
        ? 'border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.35)]'
        : 'border-b border-black/25';

      return (
        <div
          key={row.id}
          className={`grid grid-cols-12 items-center px-3 py-1.5 text-[16px] font-extrabold text-white ${bgClass} ${borderClass}`}
        >
          <div className="col-span-5 flex items-center gap-2 truncate">
            <span className="font-mono-num text-white/90 w-5">{idx + 1}.</span>
            {row.isBot && (
              <span className="text-white/80 text-xs" title="AI Bot">
                🤖
              </span>
            )}
            <span className="truncate">{row.name}</span>
          </div>
          <div className="col-span-2 text-center font-mono-num">{row.score}</div>
          <div className="col-span-1 text-center font-mono-num">{row.kills}</div>
          <div className="col-span-1 text-center font-mono-num">{row.deaths}</div>
          <div className="col-span-2 flex justify-center">
            <WeaponHudSilhouette
              weaponId={row.weaponClass}
              className="w-20 h-6 text-white fill-current"
            />
          </div>
          <div className="col-span-1 flex justify-end pr-1">
            <PingBarsIcon pingMs={row.ping} />
          </div>
        </div>
      );
    });

  return (
    <div
      data-testid="tab-leaderboard-modal"
      className="fixed inset-0 z-25 flex items-center justify-center pointer-events-none select-none"
    >
      <div className="w-full max-w-[660px] bg-black/35 backdrop-blur-[2px] p-2">
        {/* Table Column Headers (exact match to Screenshot 1) */}
        <div className="grid grid-cols-12 px-3 pb-1.5 text-[17px] font-extrabold text-white drop-shadow">
          <div className="col-span-5 pl-6">Name</div>
          <div className="col-span-2 text-center">Score</div>
          <div className="col-span-1 text-center">K</div>
          <div className="col-span-1 text-center">D</div>
          <div className="col-span-2 text-center">Weapon</div>
          <div className="col-span-1 text-right">Ping</div>
        </div>

        {/* Team Alpha Rows */}
        <div className="space-y-0.5 mb-3">
          {alphaRows.length > 0 ? (
            renderTeamRows(alphaRows, 'alpha')
          ) : (
            <div className="bg-[#3b78c8]/50 px-4 py-2 text-xs font-bold text-white/70">
              No players in Team Alpha
            </div>
          )}
        </div>

        {/* Team Bravo Rows */}
        <div className="space-y-0.5">
          {bravoRows.length > 0 ? (
            renderTeamRows(bravoRows, 'bravo')
          ) : (
            <div className="bg-[#b53834]/50 px-4 py-2 text-xs font-bold text-white/70">
              No players in Team Bravo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Eliminated / Spectating & Respawn Overlay (exact match to Screenshot 3 `image_3641830a.png`)
 */
function EliminatedSpectatingOverlay() {
  const eliminatedBy = useGameStore((s) => s.eliminatedBy);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const respawnPlayer = useGameStore((s) => s.respawnPlayer);
  const setScreen = useGameStore((s) => s.setScreen);
  const openSettingsFromPause = useGameStore((s) => s.openSettingsFromPause);
  const respawnCooldownSec = useGameStore((s) => s.respawnCooldownSec);

  const killerName = eliminatedBy?.name || 'mousepad killer';
  const killerHp = eliminatedBy?.hp ?? 100;
  const killerMaxHp = eliminatedBy?.maxHp ?? 100;
  const weaponStats = WEAPON_CLASSES[selectedClass];

  const cooldownActive = respawnCooldownSec > 0;
  const cooldownDisplay = Math.ceil(respawnCooldownSec);

  return (
    <div
      data-testid="eliminated-overlay"
      className="fixed inset-0 z-20 pointer-events-auto select-none flex flex-col justify-between"
    >
      {/* Top-Center "Eliminated By: <name>" below Score Bar (Screenshot 3) */}
      <div className="mt-20 flex flex-col items-center">
        <div className="text-[22px] font-extrabold text-white/75 drop-shadow">
          Eliminated By:
        </div>
        <div className="text-[36px] font-extrabold text-[#ff4d4d] leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {killerName}
        </div>
        {/* Red Killer HP Bar (100 | 100) */}
        <div className="w-40 h-5 bg-black/60 mt-1 relative overflow-hidden flex items-center px-2">
          <div
            className="absolute inset-y-0 left-0 bg-[#ef4444]"
            style={{ width: `${Math.max(0, Math.min(100, (killerHp / killerMaxHp) * 100))}%` }}
          />
          <span className="relative z-10 text-[12px] font-extrabold font-mono-num text-white drop-shadow">
            {killerHp} | {killerMaxHp}
          </span>
        </div>
      </div>

      {/* Center Red Directional Damage Arc above Crosshair (Screenshot 3) */}
      <div className="fixed left-1/2 top-[41%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 120 60" className="w-28 h-14 text-[#dc2626] fill-current opacity-85">
          <path d="M12 48 Q60 8 108 48 L98 54 Q60 22 22 54 Z" />
          <polygon points="60,4 52,18 68,18" />
        </svg>
      </div>

      {/* Bottom Row: Spectating + RESPAWN Button + Bottom-Right Current Class Card (Screenshot 3) */}
      <div className="relative w-full px-6 pb-6 flex items-end justify-center">
        <div className="flex flex-col items-center">
          <div className="text-[20px] font-extrabold text-white/80 mb-2 drop-shadow">
            Spectating: <span className="text-white">{killerName}</span>
          </div>

          <button
            type="button"
            data-testid="respawn-button"
            disabled={cooldownActive}
            onClick={() => {
              if (!cooldownActive) respawnPlayer();
            }}
            className={`w-80 h-20 border border-white/30 text-white font-extrabold text-[36px] tracking-wide flex items-center justify-center shadow-2xl transition-all ${cooldownActive
                ? 'bg-gradient-to-b from-gray-700 to-gray-900 opacity-75 cursor-not-allowed text-white/50'
                : 'bg-gradient-to-b from-[#4da3ff] to-[#2b7fff] hover:from-[#60adff] hover:to-[#3b8aff] cursor-pointer'
              }`}
          >
            {cooldownActive ? `RESPAWN IN ${cooldownDisplay}s` : 'RESPAWN'}
          </button>

          <div className="text-[18px] font-extrabold text-white/65 mt-2.5 drop-shadow">
            {cooldownActive
              ? `[ Respawn in ${cooldownDisplay}s ]`
              : '[ Press Space to Respawn ]'}
          </div>
        </div>

        {/* Bottom-Right Current Class + Change Class + Settings Cluster (Screenshot 3) */}
        <div className="fixed bottom-5 right-6 flex flex-col items-center w-64 space-y-2">
          <div className="text-center">
            <div className="text-[16px] font-extrabold text-white/55 leading-none">
              Current Class
            </div>
            <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5">
              {weaponStats.name}
            </div>
          </div>

          <div className="my-1 opacity-85">
            <WeaponHudSilhouette
              weaponId={selectedClass}
              className="w-36 h-12 text-white fill-current"
            />
          </div>

          <div className="text-center text-[15px] font-extrabold text-white/65 leading-tight pb-1">
            <div>Range: {weaponStats.rangeLabel}</div>
            <div>Ammo: {weaponStats.ammo}</div>
          </div>

          <button
            type="button"
            onClick={() => setScreen('select_class')}
            className="w-full py-2.5 bg-[#4a4d50]/85 hover:bg-[#5c6064] text-white/85 hover:text-white font-extrabold text-[18px] transition-colors cursor-pointer"
          >
            Change Class
          </button>
          <button
            type="button"
            onClick={() => {
              setScreen('paused');
              openSettingsFromPause();
            }}
            className="w-full py-2.5 bg-[#4a4d50]/85 hover:bg-[#5c6064] text-white/85 hover:text-white font-extrabold text-[18px] transition-colors cursor-pointer"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Fullscreen Circular Sniper Scope Overlay (matching Image 1)
 */
function FullscreenSniperScopeOverlay() {
  return (
    <div
      data-testid="hud-fullscreen-sniper-scope"
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      {/* 1. Fullscreen SVG with Circular Mask that completely blacks out outside the scope circle */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <mask id="sniper-scope-aperture-mask">
            <rect width="100%" height="100%" fill="white" />
            <circle cx="50%" cy="50%" r="min(44vw, 44vh)" fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#000000"
          mask="url(#sniper-scope-aperture-mask)"
        />
      </svg>

      {/* 2. Inner Vignette Glass Ring & Reticle */}
      <div
        className="relative rounded-full pointer-events-none flex items-center justify-center"
        style={{
          width: 'min(88vw, 88vh)',
          height: 'min(88vw, 88vh)',
          boxShadow: 'inset 0 0 60px 25px rgba(0, 0, 0, 0.85)',
          border: '3px solid rgba(12, 14, 18, 0.95)',
        }}
      >
        <svg viewBox="0 0 400 400" className="w-full h-full text-black">
          {/* Main Full-Length Horizontal & Vertical Hairlines */}
          <line x1="0" y1="200" x2="400" y2="200" stroke="#000000" strokeWidth="1.2" />
          <line x1="200" y1="0" x2="200" y2="400" stroke="#000000" strokeWidth="1.2" />

          {/* 5 Lower Elevation Hash Marks exactly matching Image 1 */}
          {[20, 40, 60, 80, 100].map((offset) => (
            <line
              key={offset}
              x1="192"
              y1={200 + offset}
              x2="208"
              y2={200 + offset}
              stroke="#000000"
              strokeWidth="1.2"
            />
          ))}

          {/* Subtle center precision dot */}
          <circle cx="200" cy="200" r="1.5" fill="#000000" />
        </svg>
      </div>
    </div>
  );
}

export function InGameHudOverlay() {
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const ammo = useGameStore((s) => s.ammo);
  const maxAmmo = useGameStore((s) => s.maxAmmo);
  const isReloading = useGameStore((s) => s.isReloading);
  const isAds = useGameStore((s) => s.isAds);
  const isSliding = useGameStore((s) => s.isSliding);
  const slideDistanceRemaining = useGameStore((s) => s.slideDistanceRemaining);
  const nearbyScooterId = useGameStore((s) => s.nearbyScooterId);
  const ridingScooterId = useGameStore((s) => s.ridingScooterId);
  const scooters = useGameStore((s) => s.scooters);
  const vapeCount = useGameStore((s) => s.vapeCount);
  const kongStrongUntil = useGameStore((s) => s.kongStrongUntil);
  const stunnedUntil = useGameStore((s) => s.stunnedUntil);
  const isEliminated = useGameStore((s) => s.isEliminated);
  const tabLeaderboardOpen = useGameStore((s) => s.tabLeaderboardOpen);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const alphaScore = useGameStore((s) => s.alphaScore);
  const bravoScore = useGameStore((s) => s.bravoScore);
  const localKills = useGameStore((s) => s.localKills);
  const localScore = useGameStore((s) => s.localScore);
  const matchTimeRemaining = useGameStore((s) => s.matchTimeRemaining);
  const damageFlashAlpha = useGameStore((s) => s.damageFlashAlpha);
  const damageVignetteAlpha = useGameStore((s) => s.damageVignetteAlpha);
  const matchStartCountdownSec = useGameStore((s) => s.matchStartCountdownSec);
  const streetDartCount = useGameStore((s) => s.streetDartCount);
  const streetDartUntil = useGameStore((s) => s.streetDartUntil);
  const streetDartChargePower = useGameStore((s) => s.streetDartChargePower);
  const vapeChargePower = useGameStore((s) => s.vapeChargePower);
  const isNearArthem = useGameStore((s) => s.isNearArthem);
  const isNearHausmeister = useGameStore((s) => s.isNearHausmeister);
  const isDowned = useGameStore((s) => s.isDowned);
  const downedHp = useGameStore((s) => s.downedHp);
  const maxDownedHp = useGameStore((s) => s.maxDownedHp);
  const isBeingRevived = useGameStore((s) => s.isBeingRevived);
  const revivingTeammateName = useGameStore((s) => s.revivingTeammateName);
  const localRevivingTargetId = useGameStore((s) => s.localRevivingTargetId);
  const reviveProgress = useGameStore((s) => s.reviveProgress);
  const keybinds = useGameStore((s) => s.settings.keybinds);
  const showFpsPing = useGameStore((s) => s.settings.showFpsPing);
  const killFeed = useGameStore((s) => s.killFeed);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const chatInputOpen = useGameStore((s) => s.chatInputOpen);
  const setChatInputOpen = useGameStore((s) => s.setChatInputOpen);

  const [chatDraft, setChatDraft] = useState('');

  const weaponStats = WEAPON_CLASSES[selectedClass];
  const mins = Math.floor(matchTimeRemaining / 60);
  const secs = Math.floor(matchTimeRemaining % 60);
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const nowMs = Date.now();
  const stunRemainingSec = Math.max(0, (stunnedUntil - nowMs) / 1000);
  const kongRemainingSec = Math.max(0, (kongStrongUntil - nowMs) / 1000);
  const mountedScooter = ridingScooterId
    ? scooters.find((sc) => sc.id === ridingScooterId)
    : null;
  const scooterBatterySec = mountedScooter?.batteryRemainingSec ?? 20.0;

  const isSniperAds = isAds && !isEliminated && selectedClass === 'sniper';
  const isSemiSniperAds = isAds && !isEliminated && selectedClass === 'semi_sniper';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatDraft.trim()) {
      multiplayerManager.sendChatMessage(chatDraft);
    }
    setChatDraft('');
    setChatInputOpen(false);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Fullscreen Radial Red Damage Vignette & Low HP Pulsing */}
      {(damageVignetteAlpha > 0.01 || (hp < 30 && !isEliminated) || isDowned) && (
        <div
          data-testid="hud-damage-vignette"
          className="fixed inset-0 pointer-events-none transition-opacity duration-150 z-20"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 38%, rgba(220, 20, 20, 0.40) 75%, rgba(160, 0, 0, 0.90) 100%)',
            opacity: Math.min(1, Math.max(damageVignetteAlpha, isDowned ? 0.82 : hp < 30 ? 0.45 : 0)),
          }}
        />
      )}

      {/* 5-Second Match Start Countdown Overlay */}
      {matchStartCountdownSec > 0 && !isEliminated && (
        <div
          data-testid="hud-match-countdown-overlay"
          className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]"
        >
          <div className="bg-slate-950/90 border-2 border-emerald-500/80 px-10 py-7 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.35)] text-center flex flex-col items-center">
            <div className="text-xs uppercase tracking-[0.3em] font-mono text-emerald-400 font-bold mb-2">
              VORBEREITUNG · MATCH STARTET IN
            </div>
            <div className="text-7xl font-black font-mono-num text-white tracking-wider animate-bounce">
              {Math.ceil(matchStartCountdownSec)}
            </div>
            <div className="text-xs text-white/60 mt-3 font-semibold">
              Wähle deine Waffe und bring dich in Position!
            </div>
          </div>
        </div>
      )}

      {/* Street Dart Psychedelic Trip Fullscreen FX */}
      {streetDartUntil > Date.now() && !isEliminated && (
        <div
          data-testid="hud-street-dart-fx"
          className="fixed inset-0 pointer-events-none z-30 mix-blend-color animate-pulse"
          style={{
            background:
              'radial-gradient(circle, rgba(236,72,153,0.35) 0%, rgba(168,85,247,0.45) 45%, rgba(6,182,212,0.55) 100%)',
            filter: 'hue-rotate(180deg) saturate(220%)',
          }}
        >
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/85 border-2 border-pink-500 px-6 py-2 rounded-xl text-center shadow-[0_0_30px_rgba(236,72,153,0.5)]">
            <div className="text-pink-400 font-black tracking-widest text-lg animate-pulse">
              💉 STREET DART TRIP AKTIV ({Math.ceil((streetDartUntil - Date.now()) / 1000)}s)
            </div>
          </div>
        </div>
      )}

      {/* Charged Vape Smoke Grenade Throw Meter */}
      {vapeChargePower > 0 && !isEliminated && (
        <div className="fixed left-1/2 bottom-[28%] -translate-x-1/2 z-30 flex flex-col items-center bg-black/85 border border-cyan-400/80 px-6 py-3 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)]">
          <div className="text-xs uppercase font-mono tracking-widest text-cyan-300 font-bold mb-1.5 flex items-center gap-2">
            <span>💨</span> WURFWEITE AUFLADEN [Q]
          </div>
          <div className="w-56 h-3 bg-slate-800 rounded-full overflow-hidden border border-cyan-500/40 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full transition-all duration-75"
              style={{ width: `${Math.round(vapeChargePower * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-white/70 font-mono mt-1">
            Kraft: {Math.round(vapeChargePower * 100)}% · Loslassen zum Werfen
          </div>
        </div>
      )}

      {/* Charged Street Dart Throw Meter */}
      {streetDartChargePower > 0 && !isEliminated && (
        <div className="fixed left-1/2 bottom-[28%] -translate-x-1/2 z-30 flex flex-col items-center bg-black/85 border border-pink-400/80 px-6 py-3 rounded-xl shadow-[0_0_25px_rgba(236,72,153,0.4)]">
          <div className="text-xs uppercase font-mono tracking-widest text-pink-300 font-bold mb-1.5 flex items-center gap-2">
            <span>💉</span> STREET DART WURFWEITE AUFLADEN [E]
          </div>
          <div className="w-56 h-3 bg-slate-800 rounded-full overflow-hidden border border-pink-500/40 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-75"
              style={{ width: `${Math.round(streetDartChargePower * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-white/70 font-mono mt-1">
            Kraft: {Math.round(streetDartChargePower * 100)}% · Loslassen zum Werfen (3m Rauchwolke)
          </div>
        </div>
      )}

      {/* Hausmeister Proximity Prompt */}
      {isNearHausmeister && !isEliminated && !isDowned && (
        <div className="fixed left-1/2 top-[22%] -translate-x-1/2 z-30 bg-slate-950/95 border-2 border-sky-400 px-6 py-3 rounded-xl text-center shadow-[0_0_30px_rgba(56,189,248,0.4)]">
          <div className="text-sm font-black text-sky-300 uppercase tracking-wide">
            🧹 [E] MIT HAUSMEISTER SPRECHEN
          </div>
          <div className="text-xs text-white/80 mt-0.5">
            Ordnungsdienst (80% Schoko-Croissant Heilt dich / 20% Waffe konfisziert!)
          </div>
        </div>
      )}

      {/* Arthem Proximity Prompt */}
      {isNearArthem && !isEliminated && !isDowned && (
        <div className="fixed left-1/2 top-[26%] -translate-x-1/2 z-30 bg-slate-950/95 border-2 border-pink-500 px-6 py-3 rounded-xl text-center shadow-[0_0_30px_rgba(236,72,153,0.4)]">
          <div className="text-sm font-black text-pink-400 uppercase tracking-wide">
            👤 [E] MIT ARTHEM SPRECHEN
          </div>
          <div className="text-xs text-white/80 mt-0.5">
            Street Dart Dealer (80% Chance auf Street Dart, 20% Lebensgefahr!)
          </div>
        </div>
      )}

      {/* E-Scooter Proximity Prompt (Supports Tandem Ride!) */}
      {nearbyScooterId && !ridingScooterId && !isEliminated && !isDowned && (
        <div className="fixed left-1/2 bottom-[22%] -translate-x-1/2 z-20 bg-black/85 border border-emerald-400/80 px-5 py-2 rounded-lg text-center text-xs font-black text-emerald-300 shadow-lg">
          🛴 [E] E-SCOOTER FAHREN (FAHRER ODER TANDEM-SOZIUS)
        </div>
      )}

      {/* Downed (DBNO) Crawling Alert Banner & Bleedout Bar */}
      {isDowned && !isEliminated && (
        <div
          data-testid="hud-downed-banner"
          className="fixed left-1/2 top-[34%] -translate-x-1/2 bg-black/90 border-2 border-red-500 px-6 py-4 text-center shadow-2xl max-w-md w-full z-30"
        >
          <div className="flex items-center justify-center gap-2 text-red-500 font-black text-xl tracking-wider uppercase animate-pulse">
            <span>⚠️</span> AM BODEN! (DOWNED) <span>⚠️</span>
          </div>
          <div className="text-sm font-extrabold text-white/90 mt-1">
            Krieche zu deinen Teammates für Wiederbelebung!
          </div>

          {/* Downed Bleedout Health Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs font-mono font-bold text-white/80 mb-1">
              <span>DOWNED HP</span>
              <span className="text-red-400">{Math.round(downedHp)} / {maxDownedHp}</span>
            </div>
            <div className="w-full h-3.5 bg-red-950 border border-red-600/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-red-500 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, (downedHp / maxDownedHp) * 100))}%` }}
              />
            </div>
          </div>

          {isBeingRevived && (
            <div className="mt-3 bg-emerald-950/85 border border-emerald-500 p-2.5 text-center">
              <div className="text-xs font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                💚 {revivingTeammateName || 'Teammate'} belebt dich wieder...
              </div>
              <div className="w-full h-2.5 bg-black/60 border border-emerald-500/50 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round(reviveProgress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Local Player Reviving Teammate HUD Progress Bar */}
      {localRevivingTargetId && !isEliminated && (
        <div
          data-testid="hud-reviving-progress"
          className="fixed left-1/2 top-[46%] -translate-x-1/2 bg-black/90 border-2 border-emerald-400 px-6 py-3.5 text-center shadow-2xl max-w-md w-full z-30"
        >
          <div className="text-emerald-400 font-black text-lg tracking-wider uppercase flex items-center justify-center gap-2">
            <span>➕</span> TEAMMATE WIRD WIEDERBELEBT... <span>➕</span>
          </div>
          <div className="text-xs font-bold text-white/80 mt-1">
            [E] gedrückt halten (5.0s für Wiederbelebung auf 20 HP)
          </div>
          <div className="w-full h-3.5 bg-black/70 border border-emerald-500/60 mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-75"
              style={{ width: `${Math.round(reviveProgress * 100)}%` }}
            />
          </div>
          <div className="text-right text-[11px] font-mono text-emerald-300 mt-1">
            {(5.0 * (1 - reviveProgress)).toFixed(1)}s verbleibend
          </div>
        </div>
      )}

      {/* Peripheral Damage Flash Vignette */}
      {damageFlashAlpha > 0.01 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-75"
          style={{
            background:
              'radial-gradient(circle, transparent 55%, rgba(231, 76, 60, 0.65) 100%)',
            opacity: damageFlashAlpha,
          }}
        />
      )}

      {/* Semi-Auto Sniper Precision Marksman Reticle when holding Right-Click (ADS) */}
      {isSemiSniperAds && (
        <div
          data-testid="hud-ads-scope-overlay"
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, transparent 36%, rgba(5, 8, 14, 0.85) 68%, rgba(2, 4, 8, 0.96) 100%)',
          }}
        >
          <svg viewBox="0 0 240 240" className="w-[420px] h-[420px] text-white/80">
            <circle cx="120" cy="120" r="108" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <line x1="12" y1="120" x2="228" y2="120" stroke="currentColor" strokeWidth="1" />
            <line x1="120" y1="12" x2="120" y2="228" stroke="currentColor" strokeWidth="1" />
            {[-45, -30, -15, 15, 30, 45].map((offset) => (
              <g key={offset}>
                <line
                  x1={120 + offset}
                  y1="116"
                  x2={120 + offset}
                  y2="124"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <line
                  x1="116"
                  y1={120 + offset}
                  x2="124"
                  y2={120 + offset}
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </g>
            ))}
            <circle cx="120" cy="120" r="2.2" fill="#ef4444" />
          </svg>
        </div>
      )}

      {/* Center Dynamic SVG Crosshair (hidden during Sniper ADS so fullscreen scope is active) */}
      {!isSniperAds && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <DynamicCrosshairSvg isPreview={false} />
        </div>
      )}

      {/* Fullscreen Circular Sniper Scope Overlay (Image 1) */}
      {isSniperAds && <FullscreenSniperScopeOverlay />}

      {/* Lidl Scanner Stunned Banner if player is hit by a Lidl Scanner */}
      {stunRemainingSec > 0 && (
        <div className="fixed left-1/2 top-[32%] -translate-x-1/2 bg-[#0050aa]/95 border-2 border-[#fff000] px-6 py-2.5 text-center shadow-2xl">
          <div className="text-[18px] font-black text-[#fff000] uppercase tracking-wider">
            ⚡ GESCANNT VOM LIDL BARCODE SCANNER!
          </div>
          <div className="text-xs font-extrabold text-white mt-0.5 font-mono-num">
            Bewegungsunfähig für {stunRemainingSec.toFixed(1)}s
          </div>
        </div>
      )}

      {/* Kong Strong 10s Speed Boost Banner */}
      {kongRemainingSec > 0 && (
        <div
          data-testid="hud-kong-strong-boost"
          className="fixed left-1/2 top-[22%] -translate-x-1/2 bg-gradient-to-r from-[#003da5]/95 via-[#e60014]/95 to-[#003da5]/95 border-2 border-[#facc15] px-5 py-1.5 text-center shadow-xl"
        >
          <div className="text-[15px] font-black text-[#facc15] uppercase tracking-wider font-mono-num">
            ⚡ KONG STRONG SPEED-BOOST AKTIV ({kongRemainingSec.toFixed(1)}s)
          </div>
        </div>
      )}

      {/* Reloading Indicator near center */}
      {isReloading && !isEliminated && (
        <div className="fixed left-1/2 top-[56%] -translate-x-1/2 text-xs font-extrabold tracking-widest uppercase text-white/90 bg-black/60 px-3 py-1">
          RELOADING ({weaponStats.reloadTime}s)...
        </div>
      )}

      {/* Top-Left FPS / LAN Ping + Quick Controls */}
      {showFpsPing && (
        <div className="fixed top-3 left-4 text-[12px] font-mono-num font-bold text-white/70 bg-black/45 px-2.5 py-1">
          144 FPS · 2ms LAN · [TAB] Leaderboard
        </div>
      )}

      {/* Top-Center Score Bar */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 flex items-stretch h-14 shadow-lg bg-black/60 border border-white/15">
        {selectedModeId === 'FFA' ? (
          <>
            {/* FFA Left: Player's Personal Kills */}
            <div
              className="px-4 flex flex-col items-center justify-center border-r border-white/15"
              style={{
                background:
                  'linear-gradient(90deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.45) 100%)',
              }}
            >
              <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                DEINE KILLS
              </span>
              <span className="text-[26px] font-extrabold font-mono-num text-white leading-tight">
                {localKills}
              </span>
            </div>

            {/* Center FFA Mode & Timer Box */}
            <div className="w-36 bg-black/60 flex flex-col items-center justify-center px-3">
              <span className="text-[12px] font-black text-amber-400 tracking-wider uppercase leading-none">
                FREE FOR ALL
              </span>
              <span className="text-[28px] font-extrabold font-mono-num text-white leading-tight">
                {timeFormatted}
              </span>
            </div>

            {/* FFA Right: Player's Personal Score */}
            <div
              className="px-4 flex flex-col items-center justify-center border-l border-white/15"
              style={{
                background:
                  'linear-gradient(270deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.45) 100%)',
              }}
            >
              <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">
                PUNKTE
              </span>
              <span className="text-[26px] font-extrabold font-mono-num text-white leading-tight">
                {localScore}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Alpha Score Box */}
            <div
              className="w-24 flex items-center justify-center border-r-6 border-[#2b7fff]"
              style={{
                background:
                  'linear-gradient(90deg, rgba(43,127,255,0.08) 0%, rgba(43,127,255,0.55) 100%)',
              }}
            >
              <span
                data-testid="hud-alpha-score"
                className="text-[32px] font-extrabold font-mono-num text-white drop-shadow"
              >
                {alphaScore}
              </span>
            </div>

            {/* Center Mode & Timer Box */}
            <div className="w-32 bg-black/55 flex flex-col items-center justify-center px-3">
              <span className="text-[14px] font-extrabold text-white/65 tracking-wider uppercase leading-none">
                {selectedModeId}
              </span>
              <span className="text-[28px] font-extrabold font-mono-num text-white leading-tight">
                {timeFormatted}
              </span>
            </div>

            {/* Bravo Score Box */}
            <div
              className="w-24 flex items-center justify-center border-l-6 border-[#e74c3c]"
              style={{
                background:
                  'linear-gradient(270deg, rgba(231,76,60,0.08) 0%, rgba(231,76,60,0.55) 100%)',
              }}
            >
              <span
                data-testid="hud-bravo-score"
                className="text-[32px] font-extrabold font-mono-num text-white drop-shadow"
              >
                {bravoScore}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Top-Right Killfeed (exact match to Screenshots 1 & 3 with weapon silhouette + headshot crosshair) */}
      <div className="fixed top-3 right-4 flex flex-col items-end gap-1.5">
        {killFeed.map((kf) => (
          <div
            key={kf.id}
            className="bg-black/55 px-3 py-1 text-[14px] font-extrabold flex items-center gap-2"
          >
            <span
              className={
                kf.killerTeam === 'alpha' ? 'text-[#4da3ff]' : 'text-[#ff5c5c]'
              }
            >
              {kf.killer}
            </span>
            <WeaponHudSilhouette
              weaponId={
                kf.weapon.toLowerCase().includes('sniper')
                  ? 'sniper'
                  : kf.weapon.toLowerCase().includes('lidl')
                    ? 'lidl_scanner'
                    : kf.weapon.toLowerCase().includes('sub')
                      ? 'smg'
                      : 'assault'
              }
              className="w-14 h-4 text-white fill-current"
            />
            {kf.isHeadshot && (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-white stroke-current"
                fill="none"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            )}
            <span
              className={
                kf.victimTeam === 'alpha' ? 'text-[#4da3ff]' : 'text-[#ff5c5c]'
              }
            >
              {kf.victim}
            </span>
          </div>
        ))}
      </div>

      {/* Hold [TAB] Centered Leaderboard Modal (Screenshot 1) */}
      {tabLeaderboardOpen && <TabLeaderboardModal />}

      {/* Eliminated / Spectating & Respawn Overlay (Screenshot 3) */}
      {isEliminated ? (
        <EliminatedSpectatingOverlay />
      ) : (
        <>
          {/* Bottom-Left Chat Box, Keybind Guide, and + 100 HP Health Bar (Screenshots 1 & 2) */}
          <div className="fixed bottom-4 left-5 flex flex-col gap-1.5">
            {chatMessages.length > 0 && (
              <div className="w-72 space-y-0.5 text-xs font-bold text-white/80 drop-shadow">
                {chatMessages.slice(-3).map((m) => (
                  <div key={m.id} className="truncate">
                    <span
                      className={
                        m.team === 'alpha' ? 'text-[#4da3ff]' : 'text-[#ff5c5c]'
                      }
                    >
                      [{m.senderName}]:{' '}
                    </span>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>
            )}

            {chatInputOpen ? (
              <form onSubmit={handleChatSubmit} className="pointer-events-auto">
                <input
                  type="text"
                  autoFocus
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setChatInputOpen(false);
                      setChatDraft('');
                    }
                  }}
                  placeholder="Type message & press Enter (Esc to cancel)..."
                  className="w-72 px-3 py-1.5 bg-black/80 border border-white/30 text-white text-sm font-bold outline-none"
                />
              </form>
            ) : (
              <div className="w-72 px-3 py-1.5 bg-black/45 text-[14px] font-extrabold text-white/75">
                [Enter] to use chat
              </div>
            )}

            {/* Keybind Hints Line: [K] Shoot  [L] ADS  [Q] Vape Smoke  [E] Street Dart  [Z] Quick Chat */}
            <div className="flex items-center gap-3 text-[14px] font-extrabold text-white/65 drop-shadow">
              <span>[{keybinds.shoot || 'K'}] Shoot</span>
              <span>[{keybinds.ads || 'L'}] ADS</span>
              <span className="text-[#22d3ee]">[Q] Vape ({vapeCount})</span>
              {streetDartCount > 0 && (
                <span className="text-[#ec4899]">[E] Dart ({streetDartCount})</span>
              )}
              <span>[{keybinds.quickChat || 'Z'}] Chat</span>
            </div>

            {/* + 100 HP Display with White Progress Bar underneath (Screenshots 1 & 2) */}
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[#2ecc71] text-[38px] font-black leading-none drop-shadow">
                +
              </span>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span
                    data-testid="hud-hp-value"
                    className="text-[42px] font-extrabold font-mono-num text-white leading-none drop-shadow"
                  >
                    {Math.round(hp)}
                  </span>
                  <span className="text-[22px] font-extrabold text-white/45 leading-none">
                    HP
                  </span>
                </div>
                <div className="w-36 h-3 bg-white/25 mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Center E-Scooter Prompt + Vape Smoke Inventory + [SHIFT] Sliding Stick-Figure Icon + >>> */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            {(nearbyScooterId || ridingScooterId) && (
              <div
                data-testid="hud-scooter-prompt"
                className={`px-4 py-1.5 border-2 text-[13px] font-black uppercase tracking-wide shadow-lg text-center ${mountedScooter?.isDominic || scooters.find((s) => s.id === nearbyScooterId)?.isDominic
                    ? 'bg-amber-950/95 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                    : 'bg-[#0050aa]/90 border-[#fff000] text-[#fff000]'
                  }`}
              >
                {ridingScooterId ? (
                  <span>
                    {mountedScooter?.isDominic ? '⚡ DOMINICS E-SCOOTER (3x SPEED)' : '🛴 E-SCOOTER'} (
                    {scooterBatterySec.toFixed(1)}s / {mountedScooter?.isDominic ? '10s' : '20s'}) —{' '}
                    {selectedClass === 'lidl_scanner'
                      ? 'LIDL-SCANNER BEREIT!'
                      : 'SCHIESSEN GESPERRT (NUR LIDL-SCANNER)'}{' '}
                    — [E] Absteigen
                  </span>
                ) : (
                  <span>
                    {scooters.find((s) => s.id === nearbyScooterId)?.isDominic
                      ? '⚡ [E] Dominics E-Scooter fahren (3x SPEED · 10s Akku)'
                      : '🛴 [E] Drücken um E-Scooter zu fahren (20s Akku)'}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-4">
              {/* [Q] Vape Smoke Grenade Counter Pill */}
              <div
                data-testid="hud-vape-counter"
                className={`px-3 py-1 border text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${vapeCount > 0
                    ? 'bg-black/60 border-[#06b6d4] text-[#22d3ee]'
                    : 'bg-black/40 border-white/15 text-white/40'
                  }`}
              >
                <span>💨 [Q] Vape:</span>
                <span className="font-mono-num text-sm">{vapeCount}</span>
              </div>

              <div className="flex items-center gap-2.5 text-white/65">
                <span className="text-[14px] font-extrabold uppercase tracking-wider">
                  [SHIFT]
                </span>
                <SlidingStickFigureIcon active={isSliding} />
                <span
                  className={`text-[16px] font-extrabold tracking-tighter ${isSliding ? 'text-[#4da3ff]' : 'text-white/65'
                    }`}
                >
                  &gt;&gt;&gt;
                </span>
                {isSliding && (
                  <span className="text-xs font-mono-num font-bold text-[#4da3ff]">
                    {slideDistanceRemaining.toFixed(1)}m
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom-Right Weapon Silhouette, Weapon Name, 30 / 30 Ammo Counter & Golden Cartridges (Screenshots 1 & 2) */}
          <div className="fixed bottom-4 right-6 flex flex-col items-end gap-1">
            <WeaponHudSilhouette weaponId={selectedClass} />
            <div
              data-testid="hud-weapon-name"
              className="text-[20px] font-extrabold text-white/80 tracking-tight mb-2"
            >
              {weaponStats.name}
            </div>

            <div className="text-[16px] font-extrabold text-white/45 leading-none mr-12">
              Ammo
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-baseline gap-1 font-mono-num">
                <span
                  data-testid="hud-ammo-current"
                  className="text-[44px] font-extrabold text-white leading-none drop-shadow"
                >
                  {ammo}
                </span>
                <span className="text-[20px] font-extrabold text-white/50 leading-none">
                  / {maxAmmo}
                </span>
              </div>

              {/* 3 Diagonal Golden Bullet Cartridges (Screenshots 1 & 2 bottom-right) */}
              <div className="flex items-center gap-1 pb-1">
                {[0, 1, 2].map((b) => (
                  <svg
                    key={b}
                    viewBox="0 0 12 36"
                    className={`w-3 h-8 rotate-15 transition-opacity ${ammo > b
                        ? 'opacity-95 text-[#eab308]'
                        : 'opacity-25 text-white/40'
                      }`}
                    fill="currentColor"
                  >
                    <path d="M6 0C3 5 2 11 2 16h8c0-5-1-11-4-16z" />
                    <rect x="2" y="17" width="8" height="19" rx="1" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function PauseModalOverlay() {
  const setScreen = useGameStore((s) => s.setScreen);
  const openSettingsFromPause = useGameStore((s) => s.openSettingsFromPause);
  const settingsOpenFromPause = useGameStore((s) => s.settingsOpenFromPause);

  if (settingsOpenFromPause) {
    return (
      <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center pointer-events-auto select-none">
        <SettingsPanel showBackButton={true} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/55 flex items-center justify-center pointer-events-auto select-none">
      <div className="w-80 bg-black/65 border border-white/10 px-7 py-8 flex flex-col items-center space-y-3 shadow-2xl">
        <h2 className="text-[42px] font-extrabold text-white/90 tracking-wide uppercase mb-2 leading-none">
          PAUSED
        </h2>

        <button
          type="button"
          onClick={() => setScreen('playing')}
          className="w-full py-3 bg-[#24598a] hover:bg-[#2d6da8] text-white/90 hover:text-white font-extrabold text-[20px] transition-colors cursor-pointer"
        >
          Resume Game
        </button>

        <button
          type="button"
          onClick={openSettingsFromPause}
          className="w-full py-3 bg-[#3d4144]/90 hover:bg-[#4e5357] text-white/85 hover:text-white font-extrabold text-[20px] transition-colors cursor-pointer"
        >
          Settings
        </button>

        <button
          type="button"
          onClick={() => setScreen('select_class')}
          className="w-full py-3 bg-[#3d4144]/90 hover:bg-[#4e5357] text-white/85 hover:text-white font-extrabold text-[20px] transition-colors cursor-pointer"
        >
          Change Class
        </button>

        <button
          type="button"
          onClick={() => setScreen('main_menu')}
          className="w-full py-3 bg-[#8f2424] hover:bg-[#b02c2c] text-white/90 hover:text-white font-extrabold text-[20px] transition-colors cursor-pointer"
        >
          Leave Match
        </button>
      </div>
    </div>
  );
}
