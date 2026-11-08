/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { multiplayerManager } from './network/LocalMultiplayer';
import { GameCanvasRoot } from './components/game/GameCanvasRoot';
import { MainMenuScreen } from './components/ui/MainMenu';
import { MatchLobbyScreen } from './components/ui/MatchLobby';
import { SelectClassModal } from './components/ui/SelectClassModal';
import { InGameHudOverlay, PauseModalOverlay } from './components/ui/InGameHud';
import { GameOverScreen } from './components/ui/GameOverScreen';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const selectClassAndDeploy = useGameStore((s) => s.selectClassAndDeploy);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    multiplayerManager.init();

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomCode(roomParam.toUpperCase());
      multiplayerManager.initWebRtcPeer(roomParam, false);
      setScreen('match_lobby');
    }
    if (params.get('autostart') === '1') {
      selectClassAndDeploy('assault');
    }
  }, [selectClassAndDeploy, setRoomCode, setScreen]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e1013] select-none">
      {/* Persistent 3D R3F WebGL Viewport */}
      <GameCanvasRoot />

      {/* Screen State Overlays */}
      {screen === 'main_menu' && <MainMenuScreen />}
      {screen === 'match_lobby' && <MatchLobbyScreen />}
      {screen === 'select_class' && <SelectClassModal />}
      {(screen === 'playing' || screen === 'paused') && <InGameHudOverlay />}
      {screen === 'paused' && <PauseModalOverlay />}
      {screen === 'gameover' && <GameOverScreen />}
    </div>
  );
}
