import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, N8AO, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { PLAYER_DIMENSIONS } from '../../game/rules';
import { TacticalArenaScene, MainMenuHeroShowcase } from './TacticalArena';
import type { BulletTracer, BulletHoleDecalData } from './Player';

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function GameCanvasRoot() {
  const screen = useGameStore((s) => s.screen);
  const topNavTab = useGameStore((s) => s.topNavTab);
  const antiAliasing = useGameStore((s) => s.settings.antiAliasing);
  const resolution = useGameStore((s) => s.settings.resolution);
  const graphicsPreset = useGameStore((s) => s.settings.graphicsPreset);

  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const [tracers, setTracers] = useState<BulletTracer[]>([]);
  const [bulletHoles, setBulletHoles] = useState<BulletHoleDecalData[]>([]);

  const handleSpawnTracer = useCallback(
    (
      start: [number, number, number],
      end: [number, number, number],
      color = '#fde047'
    ) => {
      const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setTracers((prev) => [
        ...prev.slice(-10),
        {
          id,
          start,
          end,
          createdAt: performance.now(),
          durationMs: 110,
          color,
        },
      ]);
    },
    []
  );

  const handleSpawnBulletHole = useCallback(
    (position: [number, number, number], normal: [number, number, number]) => {
      const id = `bh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setBulletHoles((prev) => [
        ...prev.slice(-45),
        { id, position, normal, createdAt: Date.now() },
      ]);
    },
    []
  );

  useEffect(() => {
    if (tracers.length === 0) return;
    const timer = window.setTimeout(() => {
      setTracers((prev) => prev.slice(1));
    }, 115);
    return () => window.clearTimeout(timer);
  }, [tracers]);

  const showMainMenuHeroCharacter =
    screen === 'main_menu' && topNavTab === 'PLAY GAME';
  const useUltraPostProcessing = !isSoftwareGl && graphicsPreset === 'ultra';

  return (
    <div
      id="deadshot-canvas-lock-trigger"
      data-testid="game-webgl-viewport"
      className="fixed inset-0 w-full h-full z-0 overflow-hidden bg-[#12161f]"
    >
      <Canvas
        shadows={useUltraPostProcessing ? 'soft' : false}
        dpr={isSoftwareGl ? 0.5 : Math.min(window.devicePixelRatio * resolution, 2)}
        gl={{
          antialias: isSoftwareGl ? false : antiAliasing,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        camera={{ fov: 90, near: 0.02, far: 250, position: [14, 2.8, 14] }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, PLAYER_DIMENSIONS.gravity, 0]}>
            <TacticalArenaScene
              tracers={tracers}
              bulletHoles={bulletHoles}
              onSpawnTracer={handleSpawnTracer}
              onSpawnBulletHole={handleSpawnBulletHole}
              isSoftwareGl={isSoftwareGl}
            />
          </Physics>
        </Suspense>

        {showMainMenuHeroCharacter && <MainMenuHeroShowcase />}

        {/* High-End Post-Processing Pipeline (N8AO, Bloom, Vignette) enabled in 'ultra' Graphics Preset */}
        {useUltraPostProcessing && (
          <EffectComposer multisampling={antiAliasing ? 4 : 0}>
            <N8AO aoRadius={1.2} intensity={2.6} distanceFalloff={0.6} />
            <Bloom
              luminanceThreshold={0.97}
              luminanceSmoothing={0.12}
              intensity={0.22}
              radius={0.5}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.22} darkness={0.42} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
