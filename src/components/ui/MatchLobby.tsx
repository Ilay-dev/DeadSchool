import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MAPS, type GameModeId } from '../../game/rules';
import { TopBrandHeader, LeftEventChallengeSidebar } from './MainMenu';
import { multiplayerManager } from '../../network/LocalMultiplayer';

const MODES: GameModeId[] = ['TDM', 'FFA', 'BOTS'];

const MODE_LABELS: Record<GameModeId, string> = {
  TDM: 'Team Deathmatch (3v3)',
  FFA: 'Free For All (Alle gegen Alle)',
  BOTS: 'VS KI (Bot-Modus)',
};

export function MatchLobbyScreen() {
  const selectedMapId = useGameStore((s) => s.selectedMapId);
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const setMapId = useGameStore((s) => s.setMapId);
  const setModeId = useGameStore((s) => s.setModeId);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const playerName = useGameStore((s) => s.playerName);
  const isReady = useGameStore((s) => s.isReady);
  const isPublicRoom = useGameStore((s) => s.isPublicRoom);
  const switchTeam = useGameStore((s) => s.switchTeam);
  const toggleReady = useGameStore((s) => s.toggleReady);
  const togglePublicRoom = useGameStore((s) => s.togglePublicRoom);
  const setScreen = useGameStore((s) => s.setScreen);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);

  const [copiedBanner, setCopiedBanner] = useState(false);
  const [joinCodeDraft, setJoinCodeDraft] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const activeMap = MAPS.find((m) => m.id === selectedMapId) || MAPS[0];

  const alphaPlayers = [
    ...(playerTeam === 'alpha'
      ? [{ id: 'local', name: playerName, ready: isReady }]
      : []),
    ...Object.values(remotePlayers).filter((p) => p.team === 'alpha'),
  ];

  const bravoPlayers = [
    ...(playerTeam === 'bravo'
      ? [{ id: 'local', name: playerName, ready: isReady }]
      : []),
    ...Object.values(remotePlayers).filter((p) => p.team === 'bravo'),
  ];

  const handleCopyRoomCode = () => {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2000);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeDraft.trim().toUpperCase();
    if (!cleaned) return;
    setRoomCode(cleaned);
    multiplayerManager.initWebRtcPeer(cleaned, false);
    setStatusBanner(`Verbunden mit Raum-Code ${cleaned}!`);
    setJoinCodeDraft('');
  };

  const handleReadyClick = () => {
    toggleReady();
    multiplayerManager.sendLobbySync();
    setScreen('select_class');
  };

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between bg-black/45 pointer-events-auto select-none">
      <TopBrandHeader />

      <div className="flex-1 flex items-center justify-between px-6 py-2">
        <LeftEventChallengeSidebar />

        {/* Center Lobby Team Selection & Serverless Room Code Controls */}
        <div className="flex-1 max-w-2xl mx-auto flex flex-col items-center space-y-4">
          {/* Active Map Header Card + Prominent 5-Digit Serverless Room Code Box */}
          <div className="w-full flex items-center justify-between bg-black/55 border border-white/15 px-5 py-3">
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-14 border border-white/25 relative overflow-hidden flex items-end p-1.5 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${activeMap.skyColor} 0%, ${activeMap.wallColor} 60%, ${activeMap.groundColor} 100%)`,
                }}
              >
                <div className="w-full h-3 bg-black/40" />
              </div>
              <div className="text-left">
                <h1 className="text-[30px] font-extrabold text-white leading-none tracking-tight">
                  {activeMap.name}
                </h1>
                <div className="text-[14px] font-extrabold text-[#4da3ff] mt-1">
                  {MODE_LABELS[selectedModeId]}
                </div>
              </div>
            </div>

            {/* Room Code Display & Quick Join */}
            <div className="text-right">
              <div className="text-[11px] font-extrabold uppercase text-white/60">
                Dein Server Raum-Code (P2P):
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  data-testid="lobby-room-code"
                  className="px-3 py-1 bg-[#2b7fff]/25 border border-[#2b7fff] text-[22px] font-black font-mono-num text-white tracking-widest"
                >
                  {roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  className="px-3 py-2 bg-white/15 hover:bg-white/25 text-xs font-extrabold text-white uppercase cursor-pointer"
                >
                  {copiedBanner ? 'Kopiert!' : 'Code Kopieren'}
                </button>
              </div>
            </div>
          </div>

          {/* Join Another Friend's Room Code directly or Global WORLD Room */}
          <form
            onSubmit={handleJoinByCode}
            className="w-full flex items-center justify-between gap-2 bg-black/45 px-4 py-2 border border-white/10"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoomCode('WORLD');
                  multiplayerManager.initWebRtcPeer('WORLD', false);
                  setStatusBanner('Verbunden mit Globaler Welt-Lobby (WORLD)!');
                }}
                className="px-2.5 py-1 bg-[#10b981] hover:bg-[#059669] text-white font-extrabold text-xs uppercase cursor-pointer"
              >
                🌐 Global (WORLD)
              </button>
              <span className="text-xs font-extrabold text-white/75">
                Oder Raum-Code eingeben:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={10}
                value={joinCodeDraft}
                onChange={(e) => setJoinCodeDraft(e.target.value.toUpperCase())}
                placeholder="WORLD / CODE"
                className="w-36 px-2.5 py-1 bg-black/70 border border-white/25 text-white font-mono-num font-bold text-sm uppercase outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-[#2b7fff] hover:bg-[#3b8aff] text-white font-extrabold text-xs uppercase cursor-pointer"
              >
                Beitreten
              </button>
            </div>
          </form>

          {statusBanner && (
            <div className="text-xs font-extrabold text-[#4ade80] bg-black/60 px-3 py-1">
              {statusBanner}
            </div>
          )}

          {/* Two-Column Team Alpha vs Team Bravo Lists */}
          <div className="w-full grid grid-cols-2 gap-5 min-h-[195px]">
            {/* Team Alpha Column */}
            <div className="space-y-1.5">
              <div className="bg-[#2b7fff] py-2 text-center text-[20px] font-extrabold text-white shadow">
                Team Alpha (Max 3)
              </div>
              <div className="space-y-1">
                {alphaPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-[#2b7fff]/20 border border-[#2b7fff]/60 px-3.5 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[18px] font-extrabold text-white/60 font-mono-num">
                        {idx + 1}.
                      </span>
                      <div>
                        <div className="text-[15px] font-extrabold text-white leading-tight">
                          {p.name}
                        </div>
                        <div
                          className={`text-[10px] font-black uppercase ${
                            p.ready ? 'text-[#4ade80]' : 'text-[#ef4444]'
                          }`}
                        >
                          {p.ready ? 'READY' : 'NOT READY'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Bravo Column */}
            <div className="space-y-1.5">
              <div className="bg-[#e74c3c] py-2 text-center text-[20px] font-extrabold text-white shadow">
                Team Bravo (Max 3)
              </div>
              <div className="space-y-1">
                {bravoPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-[#e74c3c]/20 border border-[#e74c3c]/60 px-3.5 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[18px] font-extrabold text-white/60 font-mono-num">
                        {idx + 1}.
                      </span>
                      <div>
                        <div className="text-[15px] font-extrabold text-white leading-tight">
                          {p.name}
                        </div>
                        <div
                          className={`text-[10px] font-black uppercase ${
                            p.ready ? 'text-[#4ade80]' : 'text-[#ef4444]'
                          }`}
                        >
                          {p.ready ? 'READY' : 'NOT READY'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Switch Teams | Spectate | Copy Code Row */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                switchTeam();
                multiplayerManager.sendLobbySync();
              }}
              className="w-42 py-2.5 bg-[#3d3d3d]/85 hover:bg-[#525252] text-white/85 hover:text-white font-extrabold text-[17px] transition-colors cursor-pointer"
            >
              Switch Teams
            </button>
            <button
              type="button"
              onClick={() => setScreen('playing')}
              className="w-36 py-2.5 bg-[#3d3d3d]/85 hover:bg-[#525252] text-white/85 hover:text-white font-extrabold text-[17px] transition-colors cursor-pointer"
            >
              Spectate
            </button>
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="w-42 py-2.5 bg-[#3d3d3d]/85 hover:bg-[#525252] text-white/85 hover:text-white font-extrabold text-[17px] transition-colors cursor-pointer"
            >
              {copiedBanner ? 'Code Kopiert!' : 'Copy Code'}
            </button>
          </div>

          {/* READY & Public / Leave Buttons */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleReadyClick}
              className="w-76 h-18 bg-gradient-to-b from-[#3d8bff] to-[#2364c7] hover:from-[#4d97ff] hover:to-[#2b72de] border border-white/25 text-white font-extrabold text-[38px] tracking-wide flex items-center justify-center shadow-lg cursor-pointer"
            >
              READY
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePublicRoom}
                className="w-36 py-2 bg-[#3d3d3d]/85 hover:bg-[#525252] text-white/80 hover:text-white font-extrabold text-[18px] transition-colors cursor-pointer"
              >
                {isPublicRoom ? 'Public' : 'Private'}
              </button>
              <button
                type="button"
                onClick={() => setScreen('main_menu')}
                className="w-36 py-2 bg-[#c0392b] hover:bg-[#e74c3c] text-white font-extrabold text-[18px] transition-colors cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Map Grid & 3 Clean Game Modes (TDM 3v3, FFA, BOTS) */}
        <aside className="w-64 flex flex-col items-center space-y-4">
          <div className="w-full text-center">
            <h3 className="text-[22px] font-extrabold text-white mb-2">Map</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {MAPS.map((m) => {
                const selected = m.id === selectedMapId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-label={`Select map ${m.name}`}
                    onClick={() => {
                      setMapId(m.id);
                      multiplayerManager.sendLobbySync();
                    }}
                    className={`h-14 relative overflow-hidden transition-all cursor-pointer ${
                      selected
                        ? 'ring-3 ring-white rounded-sm scale-[1.03]'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      background: `linear-gradient(145deg, ${m.skyColor} 0%, ${m.wallColor} 55%, ${m.groundColor} 100%)`,
                    }}
                  >
                    <span className="absolute bottom-1 left-1.5 text-[11px] font-extrabold text-white drop-shadow">
                      {m.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full text-center">
            <h3 className="text-[22px] font-extrabold text-white mb-2">Spielmodus</h3>
            <div className="flex flex-col gap-2">
              {MODES.map((mode) => {
                const selected = mode === selectedModeId;
                return (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`lobby-mode-${mode}`}
                    onClick={() => {
                      setModeId(mode);
                      multiplayerManager.sendLobbySync();
                    }}
                    className={`py-2.5 px-3 text-left transition-all cursor-pointer flex items-center justify-between ${
                      selected
                        ? 'bg-[#2b7fff] text-white ring-2 ring-white rounded-xs'
                        : 'bg-black/60 text-white/70 hover:text-white'
                    }`}
                  >
                    <span className="text-[16px] font-extrabold">{mode}</span>
                    <span className="text-[11px] font-bold text-white/85">
                      {MODE_LABELS[mode]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              useGameStore.getState().setScreen('main_menu');
              useGameStore.getState().setTopNavTab('SETTINGS');
            }}
            className="w-full py-3 bg-[#3d3d3d]/80 hover:bg-[#4f4f4f] text-white/80 hover:text-white font-extrabold text-[17px] transition-colors cursor-pointer"
          >
            Grafik &amp; Settings
          </button>
        </aside>
      </div>

      {/* Bottom Party Chat Bar & Online Counter */}
      <div className="w-full px-6 pb-3 flex items-center justify-between text-[13px] font-extrabold text-white/60">
        <div className="bg-black/65 px-3 py-1.5 w-64 text-white/55">
          [Party] [Enter] to use chat
        </div>
        <div className="font-mono-num">
          Raum-Code: {roomCode} · P2P WebRTC Aktiv
        </div>
        <div className="flex items-center gap-3">
          <span>Terms</span>
          <span>|</span>
          <span>Privacy</span>
          <span>|</span>
          <span>Partners</span>
          <span>|</span>
          <span>Contact</span>
        </div>
      </div>
    </div>
  );
}
