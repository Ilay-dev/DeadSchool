import { useState } from 'react';
import { useGameStore, type TopNavTab } from '../../store/useGameStore';
import { WEAPON_LIST, type GameModeId } from '../../game/rules';
import { SettingsPanel } from './SettingsPanel';
import { multiplayerManager } from '../../network/LocalMultiplayer';

const NAV_TABS: TopNavTab[] = [
  'PLAY GAME',
  'SETTINGS',
  'SHOP',
  'LOCKER',
  'LEADERBOARD',
];

export function TopBrandHeader() {
  const topNavTab = useGameStore((s) => s.topNavTab);
  const setTopNavTab = useGameStore((s) => s.setTopNavTab);
  const isLoggedIn = useGameStore((s) => s.isLoggedIn);
  const playerName = useGameStore((s) => s.playerName);
  const toggleLogin = useGameStore((s) => s.toggleLogin);
  const graphicsPreset = useGameStore((s) => s.settings.graphicsPreset);
  const updateSettings = useGameStore((s) => s.updateSettings);

  return (
    <header className="relative w-full bg-gradient-to-b from-black/85 via-black/70 to-black/45 border-b border-white/10 pt-3 pb-0 px-7 select-none pointer-events-auto z-20">
      <div className="flex items-start justify-between">
        {/* Top-Left Patch Notes */}
        <div className="text-left leading-tight">
          <div className="text-[16px] font-extrabold text-white tracking-tight">
            Latest Update:
          </div>
          <div className="text-[13px] font-bold text-[#fff000]">
            + Lidl Barcode Scanner (4m / 10s Stun)
          </div>
          <div className="text-[13px] font-bold text-white/65">
            + 5 Campus E-Scooter &amp; [Shift] Slide
          </div>
        </div>

        {/* Center Bespoke Inline SVG Logo: DEAD [Rifle] SCHOOL */}
        <div className="flex items-center justify-center -mt-1">
          <div className="flex items-baseline font-display font-extrabold tracking-tight text-white select-none">
            <span className="text-[62px] leading-none tracking-tight text-white drop-shadow">DEAD</span>
            <svg
              className="w-12 h-10 mx-1 text-[#ef4444] self-center -rotate-30"
              viewBox="0 0 64 32"
              fill="currentColor"
            >
              <path d="M4 16h12l4-4h22v3h14v3H46v4l-5 6h-5l3-6H22l-3 5h-6l2-5H4v-6z" />
              <rect x="26" y="8" width="10" height="3" rx="1" />
            </svg>
            <span className="text-[62px] leading-none tracking-tight text-[#3b82f6] drop-shadow">SCHOOL</span>
          </div>
        </div>

        {/* Top-Right Quick Graphics Preset Toggle */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="quick-graphics-preset-toggle"
            onClick={() =>
              updateSettings(
                'graphicsPreset',
                graphicsPreset === 'ultra' ? 'low' : 'ultra'
              )
            }
            className={`px-3 py-2 border text-[13px] font-extrabold uppercase transition-colors cursor-pointer ${
              graphicsPreset === 'ultra'
                ? 'bg-[#2b7fff]/30 border-[#60a5fa] text-white'
                : 'bg-black/60 border-white/15 text-white/75'
            }`}
          >
            Grafik: {graphicsPreset === 'ultra' ? 'ULTRA (High-PC)' : 'STANDARD (Low-PC)'}
          </button>
        </div>
      </div>

      {/* Top Navigation Row */}
      <nav
        aria-label="Main Menu Navigation"
        className="flex items-center justify-center gap-6 mt-2"
      >
        {NAV_TABS.map((tab) => {
          const active = topNavTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setTopNavTab(tab)}
              className={`px-5 py-2.5 text-[16px] font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-t from-white/20 to-transparent text-white border-b-3 border-white'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export function LeftEventChallengeSidebar() {
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const setModeId = useGameStore((s) => s.setModeId);

  const modes: { id: GameModeId; title: string; subtitle: string }[] = [
    {
      id: 'TDM',
      title: 'Team 3v3 (TDM)',
      subtitle: 'Team Alpha vs Team Bravo (Ohne Bots)',
    },
    {
      id: 'FFA',
      title: 'Free For All (FFA)',
      subtitle: 'Alle gegen Alle im Multiplayer',
    },
    {
      id: 'BOTS',
      title: 'VS KI (Bot-Modus)',
      subtitle: 'Training & Match gegen clevere KI-Gegner',
    },
  ];

  return (
    <aside className="w-64 space-y-2 pointer-events-auto select-none">
      <div className="bg-black/65 p-4 border border-white/10 space-y-3">
        <div className="text-[16px] font-extrabold text-white uppercase border-b border-white/20 pb-2">
          Spielmodus wählen:
        </div>

        <div className="space-y-2">
          {modes.map((m) => {
            const active = selectedModeId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`menu-mode-${m.id}`}
                onClick={() => setModeId(m.id)}
                className={`w-full text-left p-2.5 border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#2b7fff]/30 border-[#2b7fff] text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                }`}
              >
                <div className="text-[15px] font-extrabold">{m.title}</div>
                <div className="text-[11px] font-bold text-white/60 mt-0.5">
                  {m.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-white/15 text-[11px] font-bold text-white/65 space-y-1">
          <div>🛴 <span className="text-white">[E]</span> an Fahrradständern: E-Scooter (max 5)</div>
          <div>⚡ <span className="text-white">[SHIFT]</span>: 6m Slide (Treppen runter länger!)</div>
          <div>📊 <span className="text-white">[TAB]</span> halten: Live-Leaderboard</div>
        </div>
      </div>
    </aside>
  );
}

export function MainMenuScreen() {
  const topNavTab = useGameStore((s) => s.topNavTab);
  const setScreen = useGameStore((s) => s.setScreen);
  const setModeId = useGameStore((s) => s.setModeId);
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const partySlots = useGameStore((s) => s.partySlots);
  const addPartyMember = useGameStore((s) => s.addPartyMember);
  const onlinePlayersCount = useGameStore((s) => s.onlinePlayersCount);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const selectClassAndDeploy = useGameStore((s) => s.selectClassAndDeploy);
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);

  const equippedWeaponSkin = useGameStore((s) => s.equippedWeaponSkin);
  const setEquippedWeaponSkin = useGameStore((s) => s.setEquippedWeaponSkin);
  const equippedSoldierSkin = useGameStore((s) => s.equippedSoldierSkin);
  const setEquippedSoldierSkin = useGameStore((s) => s.setEquippedSoldierSkin);
  const [shopCategory, setShopCategory] = useState<'weapons' | 'soldiers'>('weapons');

  const [joinOverlayOpen, setJoinOverlayOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [activeRoomsList, setActiveRoomsList] = useState(
    multiplayerManager.activeRooms
  );

  const openMultiplayerModal = async () => {
    setJoinOverlayOpen(true);
    const rooms = await multiplayerManager.fetchLanInfo();
    setActiveRoomsList([...rooms]);
  };

  const handleQuickPlay = () => {
    if (selectedModeId !== 'BOTS') {
      const targetRoom = roomCode || 'WORLD';
      setRoomCode(targetRoom);
      multiplayerManager.initWebRtcPeer(targetRoom, false);
      multiplayerManager.sendLobbySync();
    }
    setScreen('select_class');
  };

  const handlePlayBotsMode = () => {
    setModeId('BOTS');
    setScreen('select_class');
  };

  const handleJoinGlobalWorldMultiplayer = () => {
    if (selectedModeId === 'BOTS') {
      setModeId('TDM');
    }
    setRoomCode('WORLD');
    multiplayerManager.initWebRtcPeer('WORLD', false);
    multiplayerManager.sendLobbySync();
    setJoinOverlayOpen(false);
    setScreen('match_lobby');
  };

  const handleHostRoomCode = () => {
    if (selectedModeId === 'BOTS') {
      setModeId('TDM');
    }
    const newCode = multiplayerManager.generateRoomCode();
    setRoomCode(newCode);
    multiplayerManager.initWebRtcPeer(newCode, true);
    multiplayerManager.sendLobbySync();
    setJoinOverlayOpen(false);
    setScreen('match_lobby');
  };

  const handleJoinRoomByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedModeId === 'BOTS') {
      setModeId('TDM');
    }
    const cleaned = (joinCodeInput.trim() || roomCode || 'WORLD').toUpperCase();
    setRoomCode(cleaned);
    multiplayerManager.initWebRtcPeer(cleaned, false);
    setJoinOverlayOpen(false);
    setScreen('match_lobby');
  };

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none select-none">
      <TopBrandHeader />

      {topNavTab === 'SETTINGS' && (
        <main className="flex-1 flex items-center justify-center overflow-hidden">
          <SettingsPanel showBackButton={false} />
        </main>
      )}

      {topNavTab === 'LOCKER' && (
        <main className="flex-1 flex items-center justify-center pointer-events-auto px-8">
          <div className="w-full max-w-5xl bg-black/75 border border-white/15 p-6 space-y-4">
            <h2 className="text-2xl font-extrabold tracking-wide text-white uppercase">
              TACTICAL LOCKER &amp; LOADOUT (6 WAFFEN INKL. LIDL SCANNER)
            </h2>
            <div className="grid grid-cols-6 gap-3">
              {WEAPON_LIST.map((w) => {
                const isSelected = selectedClass === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => selectClassAndDeploy(w.id)}
                    className={`p-4 text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2b7fff]/25 border-[#2b7fff] text-white'
                        : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-base font-extrabold">{w.name}</div>
                    <div className="text-xs text-white/60 mt-1">Range: {w.rangeLabel}</div>
                    <div className="text-xs text-white/60 font-mono-num">Ammo: {w.ammo}</div>
                    <div className="text-xs text-white/60 font-mono-num">
                      Reload: {w.reloadTime}s
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {topNavTab === 'SHOP' && (
        <main className="flex-1 flex items-center justify-center pointer-events-auto px-6 py-4 overflow-y-auto max-h-[85vh]">
          <div className="w-full max-w-4xl bg-black/85 border border-white/20 p-6 space-y-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black tracking-wider text-white uppercase">
                    DEAD SCHOOL SKIN-STORE
                  </h2>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black uppercase rounded">
                    ALLE SKINS 100% KOSTENLOS (0€)
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Wähle deinen Style! Alle Waffen- &amp; Charakter-Skins sind sofort frei verfügbar.
                </p>
              </div>

              {/* Category Switcher Tabs */}
              <div className="flex items-center bg-white/10 p-1 border border-white/15">
                <button
                  type="button"
                  onClick={() => setShopCategory('weapons')}
                  className={`px-4 py-1.5 text-xs font-black uppercase transition-colors cursor-pointer ${
                    shopCategory === 'weapons'
                      ? 'bg-[#2b7fff] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  🔫 Waffen-Skins
                </button>
                <button
                  type="button"
                  onClick={() => setShopCategory('soldiers')}
                  className={`px-4 py-1.5 text-xs font-black uppercase transition-colors cursor-pointer ${
                    shopCategory === 'soldiers'
                      ? 'bg-[#2b7fff] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  🪖 Charakter-Skins
                </button>
              </div>
            </div>

            {shopCategory === 'weapons' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
                {[
                  {
                    id: 'default',
                    name: 'Standard Fabrikneu',
                    desc: 'Klassisches mattes Schwarz & Polymer-Militärfinish.',
                    color: '#334155',
                    badge: 'Standard',
                  },
                  {
                    id: 'dragon_flame',
                    name: 'Dragon Flame',
                    desc: 'Feuriges Magma-Rot, vulkanisches Orange & glühende Hitze.',
                    color: '#ef4444',
                    badge: 'Legendär',
                  },
                  {
                    id: 'cyber_neon',
                    name: 'Cyber Neon 2077',
                    desc: 'Futuristisches Cyberpunk Cyan, Magenta & leuchtender LED-Glow.',
                    color: '#06b6d4',
                    badge: 'Exklusiv',
                  },
                  {
                    id: 'gold_midnight',
                    name: 'Midnight Gold Deluxe',
                    desc: 'Edles Tiefschwarz mit 24K polierten Gold-Elementen.',
                    color: '#f59e0b',
                    badge: 'Luxus',
                  },
                  {
                    id: 'arctic_glacier',
                    name: 'Arctic Glacier',
                    desc: 'Frostiges Gletscherweiß mit arktischem Eisblau.',
                    color: '#38bdf8',
                    badge: 'Arktisch',
                  },
                  {
                    id: 'obsidian_stealth',
                    name: 'Obsidian Stealth',
                    desc: 'Reflexionsfreies Tiefschwarz für lautlose Spezialeinsätze.',
                    color: '#27272a',
                    badge: 'Spec-Ops',
                  },
                  {
                    id: 'lidl_edition',
                    name: 'Lidl Special Edition',
                    desc: 'Kultiges blau-gelb-rotes Supermarkt Champion Design.',
                    color: '#0050aa',
                    badge: 'Kult',
                  },
                ].map((skin) => {
                  const isEquipped = equippedWeaponSkin === skin.id;
                  return (
                    <div
                      key={skin.id}
                      className={`relative bg-white/5 border p-4 flex flex-col justify-between transition-all ${
                        isEquipped
                          ? 'border-[#2b7fff] bg-[#2b7fff]/10 ring-1 ring-[#2b7fff]'
                          : 'border-white/10 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="h-2 w-10 rounded-full"
                            style={{ backgroundColor: skin.color }}
                          />
                          <span className="text-[10px] font-mono font-bold text-white/50 uppercase">
                            {skin.badge}
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-white tracking-wide">
                          {skin.name}
                        </div>
                        <div className="text-[11px] text-white/60 mt-1 line-clamp-2">
                          {skin.desc}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-400">
                          0€ KOSTENLOS
                        </span>
                        <button
                          type="button"
                          onClick={() => setEquippedWeaponSkin(skin.id)}
                          className={`px-3 py-1.5 text-xs font-black uppercase transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-600 text-white cursor-default'
                              : 'bg-[#2b7fff] hover:bg-[#3b8aff] text-white'
                          }`}
                        >
                          {isEquipped ? '✓ Ausgerüstet' : 'Ausrüsten'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {shopCategory === 'soldiers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
                {[
                  {
                    id: 'default',
                    name: 'Standard Rekrut',
                    desc: 'Klassische taktische Einsatzuniform der Alpha & Bravo Divisionen.',
                    color: '#334155',
                    badge: 'Standard',
                  },
                  {
                    id: 'ghost_infiltrator',
                    name: 'Ghost Infiltrator',
                    desc: 'Tarnschwarzer Nachteinsatzanzug mit leuchtendem Visier.',
                    color: '#09090b',
                    badge: 'Spec-Ops',
                  },
                  {
                    id: 'desert_commando',
                    name: 'Desert Commando',
                    desc: 'Sandfarbene Wüstentarnung mit verstärkter ballistischer Weste.',
                    color: '#c2956e',
                    badge: 'Militär',
                  },
                  {
                    id: 'cyber_raider',
                    name: 'Cyber Raider',
                    desc: 'High-Tech Titanrüstung mit Neon-Energieelementen.',
                    color: '#0284c7',
                    badge: 'Cyberpunk',
                  },
                  {
                    id: 'campus_enforcer',
                    name: 'Campus Security',
                    desc: 'Dunkelblauer Wachschutz-Suit der Timber School.',
                    color: '#1e3a8a',
                    badge: 'Security',
                  },
                  {
                    id: 'lidl_manager',
                    name: 'Lidl Filialleiter',
                    desc: 'Legendäre Lidl-Manager-Uniform mit gelber Sicherheitsweste.',
                    color: '#fff000',
                    badge: 'Legende',
                  },
                ].map((skin) => {
                  const isEquipped = equippedSoldierSkin === skin.id;
                  return (
                    <div
                      key={skin.id}
                      className={`relative bg-white/5 border p-4 flex flex-col justify-between transition-all ${
                        isEquipped
                          ? 'border-[#2b7fff] bg-[#2b7fff]/10 ring-1 ring-[#2b7fff]'
                          : 'border-white/10 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="h-2 w-10 rounded-full"
                            style={{ backgroundColor: skin.color }}
                          />
                          <span className="text-[10px] font-mono font-bold text-white/50 uppercase">
                            {skin.badge}
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-white tracking-wide">
                          {skin.name}
                        </div>
                        <div className="text-[11px] text-white/60 mt-1 line-clamp-2">
                          {skin.desc}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-400">
                          0€ KOSTENLOS
                        </span>
                        <button
                          type="button"
                          onClick={() => setEquippedSoldierSkin(skin.id)}
                          className={`px-3 py-1.5 text-xs font-black uppercase transition-all cursor-pointer ${
                            isEquipped
                              ? 'bg-emerald-600 text-white cursor-default'
                              : 'bg-[#2b7fff] hover:bg-[#3b8aff] text-white'
                          }`}
                        >
                          {isEquipped ? '✓ Ausgerüstet' : 'Ausrüsten'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {topNavTab === 'LEADERBOARD' && (
        <main className="flex-1 flex items-center justify-center pointer-events-auto px-8">
          <div className="w-full max-w-3xl bg-black/75 border border-white/15 p-6 space-y-3">
            <h2 className="text-2xl font-extrabold tracking-wide text-white uppercase">
              GLOBAL &amp; LAN LEADERBOARD
            </h2>
            <div className="divide-y divide-white/10 font-mono-num text-sm">
              {[
                { rank: 1, name: 'lochtiroler69', kills: 142, kd: '3.42', score: '28,450' },
                { rank: 2, name: 'mousepad killer', kills: 118, kd: '2.85', score: '23,100' },
                { rank: 3, name: 'run4baby', kills: 96, kd: '2.10', score: '19,800' },
                { rank: 4, name: 'Player_4', kills: 84, kd: '1.75', score: '16,200' },
              ].map((row) => (
                <div key={row.rank} className="flex items-center justify-between py-2.5 px-3">
                  <span className="font-extrabold text-white">
                    #{row.rank} {row.name}
                  </span>
                  <span className="text-white/75">
                    {row.kills} Kills · K/D {row.kd} · {row.score} PTS
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {topNavTab === 'PLAY GAME' && (
        <main className="flex-1 relative flex items-center justify-between px-6">
          <LeftEventChallengeSidebar />

          {/* Center 3D Character Viewport + 3 Translucent Party '+' Slots */}
          <div className="flex-1 flex items-center justify-center gap-12 pointer-events-none">
            <button
              type="button"
              aria-label="Add Party Member Slot 1"
              onClick={() => addPartyMember(0)}
              className="pointer-events-auto w-26 h-60 bg-white/8 hover:bg-white/14 border border-white/15 flex flex-col items-center justify-center transition-colors cursor-pointer"
            >
              {partySlots[0] ? (
                <span className="text-xs font-extrabold text-[#2b7fff] px-2 text-center">
                  {partySlots[0]}
                </span>
              ) : (
                <span className="text-4xl font-light text-white/45">+</span>
              )}
            </button>

            <div className="w-44 h-64 pointer-events-none" />

            <div className="flex items-center gap-8">
              <button
                type="button"
                aria-label="Add Party Member Slot 2"
                onClick={() => addPartyMember(1)}
                className="pointer-events-auto w-26 h-60 bg-white/8 hover:bg-white/14 border border-white/15 flex flex-col items-center justify-center transition-colors cursor-pointer"
              >
                {partySlots[1] ? (
                  <span className="text-xs font-extrabold text-[#2b7fff] px-2 text-center">
                    {partySlots[1]}
                  </span>
                ) : (
                  <span className="text-4xl font-light text-white/45">+</span>
                )}
              </button>

              <button
                type="button"
                aria-label="Add Party Member Slot 3"
                onClick={() => addPartyMember(2)}
                className="pointer-events-auto w-26 h-60 bg-white/8 hover:bg-white/14 border border-white/15 flex flex-col items-center justify-center transition-colors cursor-pointer"
              >
                {partySlots[2] ? (
                  <span className="text-xs font-extrabold text-[#2b7fff] px-2 text-center">
                    {partySlots[2]}
                  </span>
                ) : (
                  <span className="text-4xl font-light text-white/45">+</span>
                )}
              </button>
            </div>
          </div>

          <div className="w-64 pointer-events-none" />
        </main>
      )}

      {/* Bottom Action Cluster & Footer */}
      <footer className="relative w-full px-6 pb-3 pt-2 flex items-end justify-between pointer-events-auto">
        <div className="space-y-1.5">
          <div className="text-[14px] font-extrabold text-white tracking-tight">
            Aktiver Multiplayer Raum:
          </div>
          <button
            type="button"
            onClick={openMultiplayerModal}
            className="w-52 py-2.5 bg-[#5865F2]/90 hover:bg-[#5865F2] border border-white/20 text-white font-extrabold text-[14px] tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🌐 RAUM: {roomCode}</span>
          </button>
        </div>

        {topNavTab === 'PLAY GAME' && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                data-start="true"
                onClick={handleQuickPlay}
                className="w-64 h-20 bg-gradient-to-b from-[#3d8bff] to-[#2364c7] hover:from-[#4d97ff] hover:to-[#2b72de] border border-white/25 text-white/95 font-extrabold text-[40px] tracking-wide flex items-center justify-center shadow-lg cursor-pointer"
              >
                PLAY
              </button>

              {/* Prominent Worldwide Multiplayer Button */}
              <button
                type="button"
                data-testid="multiplayer-worldwide-btn"
                onClick={handleJoinGlobalWorldMultiplayer}
                className="relative w-44 h-20 bg-gradient-to-b from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#047857] border border-white/25 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="absolute -top-2.5 right-1 bg-[#fff000] text-black text-[10px] font-black px-1.5 py-0.5 rotate-1 shadow">
                  WELTWEIT LIVE
                </span>
                <span className="text-[20px] font-extrabold leading-none mt-1">
                  MULTIPLAYER
                </span>
                <span className="text-[10px] font-bold text-white/95 mt-1">
                  Global Lobby (WORLD)
                </span>
              </button>

              {/* Orange VS KI Bot-Modus Button */}
              <button
                type="button"
                onClick={handlePlayBotsMode}
                className="relative w-36 h-20 bg-gradient-to-b from-[#e67e22] to-[#b85d12] hover:from-[#f39c12] hover:to-[#d35400] border border-white/25 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="absolute -top-2.5 right-1 bg-[#f1c40f] text-black text-[10px] font-black px-1.5 py-0.5 rotate-2 shadow">
                  KI TRAINING
                </span>
                <span className="text-[24px] font-extrabold leading-none mt-1">
                  VS BOTS
                </span>
                <span className="text-[10px] font-bold text-white/90 mt-1">
                  Smart Raycast AI
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleJoinGlobalWorldMultiplayer}
                className="px-4 py-2 bg-[#2b7fff]/85 hover:bg-[#3b8aff] border border-white/15 text-white font-extrabold text-[15px] transition-colors cursor-pointer"
              >
                🌐 Globale Lobby (WORLD)
              </button>
              <button
                type="button"
                onClick={handleHostRoomCode}
                className="px-4 py-2 bg-[#3d3d3d]/85 hover:bg-[#4f4f4f] border border-white/10 text-white/80 hover:text-white font-extrabold text-[15px] transition-colors cursor-pointer"
              >
                Host Room
              </button>
              <button
                type="button"
                onClick={openMultiplayerModal}
                className="px-4 py-2 bg-[#3d3d3d]/85 hover:bg-[#4f4f4f] border border-white/10 text-white/80 hover:text-white font-extrabold text-[15px] transition-colors cursor-pointer"
              >
                Server-Browser &amp; Code
              </button>
            </div>

            <div className="text-[13px] font-extrabold text-white/65 font-mono-num">
              {onlinePlayersCount} Players Online · Modus: {selectedModeId} · Raum {roomCode}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-[13px] font-extrabold text-white/60">
          <button
            type="button"
            onClick={openMultiplayerModal}
            className="hover:text-white cursor-pointer"
          >
            Globaler Multiplayer
          </button>
          <span>|</span>
          <span>Terms</span>
          <span>|</span>
          <span>Privacy</span>
          <span>|</span>
          <span>Contact</span>
        </div>
      </footer>

      {/* Worldwide Multiplayer Server Browser & Room Code Modal */}
      {joinOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center pointer-events-auto">
          <div className="w-full max-w-lg bg-[#181b20] border border-white/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-white uppercase">
                🌐 Weltweiter Online-Multiplayer &amp; Server-Browser
              </h3>
              <button
                type="button"
                onClick={() => setJoinOverlayOpen(false)}
                className="text-white/60 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* One-Click Global Matchmaking Button */}
            <button
              type="button"
              onClick={handleJoinGlobalWorldMultiplayer}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#047857] border border-white/25 text-white font-extrabold text-sm uppercase tracking-wide flex items-center justify-between cursor-pointer shadow-lg"
            >
              <span>🌐 Globale Welt-Lobby (WORLD) beitreten</span>
              <span className="bg-black/30 px-2.5 py-1 text-xs font-mono-num">
                Jeder weltweit kann sofort joinen →
              </span>
            </button>

            {/* Live Active Rooms on the Server */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-white/70">
                <span>Aktive Online-Räume (Weltweit):</span>
                <button
                  type="button"
                  onClick={async () => {
                    const rooms = await multiplayerManager.fetchLanInfo();
                    setActiveRoomsList([...rooms]);
                  }}
                  className="text-[#4da3ff] hover:underline cursor-pointer"
                >
                  ↻ Aktualisieren
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-white/10 bg-black/50 border border-white/15">
                {activeRoomsList.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs font-bold text-white/60 flex items-center justify-between">
                    <span>WORLD (Globale Standard-Lobby)</span>
                    <button
                      type="button"
                      onClick={handleJoinGlobalWorldMultiplayer}
                      className="px-2.5 py-1 bg-[#2b7fff] text-white font-extrabold text-xs cursor-pointer"
                    >
                      Beitreten
                    </button>
                  </div>
                ) : (
                  activeRoomsList.map((r) => (
                    <div
                      key={r.roomCode}
                      className="px-3 py-2 text-xs font-bold text-white flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono-num font-extrabold text-[#4da3ff]">
                          {r.roomCode}
                        </span>{' '}
                        <span className="text-white/70">
                          · {r.modeId} · {r.playerCount} Spieler online
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedModeId === 'BOTS') setModeId('TDM');
                          setRoomCode(r.roomCode);
                          multiplayerManager.initWebRtcPeer(r.roomCode, false);
                          setJoinOverlayOpen(false);
                          setScreen('match_lobby');
                        }}
                        className="px-3 py-1 bg-[#2b7fff] hover:bg-[#3b8aff] text-white font-extrabold text-xs cursor-pointer"
                      >
                        Beitreten
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Custom Room Code Form */}
            <form onSubmit={handleJoinRoomByCode} className="space-y-3 pt-2 border-t border-white/15">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase text-white/75">
                  Oder per Raum-Code verbinden (Weltweit via WebSocket &amp; WebRTC):
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder={roomCode}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/30 text-white font-mono-num font-extrabold text-lg tracking-widest uppercase outline-none"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleHostRoomCode}
                  className="px-4 py-2.5 bg-[#f39c12] hover:bg-[#e67e22] text-black font-extrabold text-sm cursor-pointer"
                >
                  Neuen Raum-Code erstellen
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJoinOverlayOpen(false)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm cursor-pointer"
                  >
                    Schließen
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2b7fff] hover:bg-[#3b8aff] text-white font-extrabold text-sm cursor-pointer"
                  >
                    Code Beitreten
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
