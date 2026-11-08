import { useState, useEffect } from 'react';
import {
  useGameStore,
  type SettingsCategory,
  type KeybindSettings,
  type GraphicsPreset,
} from '../../store/useGameStore';
import { CrosshairEditor } from './CrosshairEditor';

const CATEGORIES: SettingsCategory[] = [
  'GENERAL',
  'CONTROLS',
  'KEYBINDS',
  'AUDIO',
  'VIDEO',
  'CROSSHAIR',
  'CONTROLLER',
];

const KEYBIND_ROWS: { key: keyof KeybindSettings; label: string }[] = [
  { key: 'forward', label: 'Forward' },
  { key: 'backward', label: 'Backward' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'jump', label: 'Jump' },
  { key: 'crouch', label: 'Slide (Shift)' },
  { key: 'reload', label: 'Reload' },
  { key: 'shoot', label: 'Shoot' },
  { key: 'ads', label: 'ADS' },
  { key: 'knife', label: 'Knife' },
  { key: 'spray', label: 'Spray' },
  { key: 'quickChat', label: 'Quick Chat' },
];

export function SettingsPanel({ showBackButton = false }: { showBackButton?: boolean }) {
  const settingsCategory = useGameStore((s) => s.settingsCategory);
  const setSettingsCategory = useGameStore((s) => s.setSettingsCategory);
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const updateKeybind = useGameStore((s) => s.updateKeybind);
  const closeSettingsBack = useGameStore((s) => s.closeSettingsBack);

  const [listeningKey, setListeningKey] = useState<keyof KeybindSettings | null>(null);

  useEffect(() => {
    if (!listeningKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const keyLabel = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
      updateKeybind(listeningKey, keyLabel);
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [listeningKey, updateKeybind]);

  const handleToggleFullscreen = () => {
    const next = !settings.fullscreen;
    updateSettings('fullscreen', next);
    if (typeof document !== 'undefined') {
      if (next && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (!next && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const applyGraphicsPreset = (preset: GraphicsPreset) => {
    updateSettings('graphicsPreset', preset);
    if (preset === 'low') {
      updateSettings('antiAliasing', false);
      updateSettings('resolution', 0.85);
    } else {
      updateSettings('antiAliasing', true);
      updateSettings('resolution', 1.0);
    }
  };

  return (
    <div className="relative w-full max-w-[1060px] mx-auto pt-4 pb-8 px-6 pointer-events-auto">
      {showBackButton && (
        <div className="mb-4">
          <button
            type="button"
            onClick={closeSettingsBack}
            className="px-8 py-2.5 bg-[#2a2d32]/90 hover:bg-[#383c42] text-white/80 hover:text-white font-extrabold text-[17px] transition-colors cursor-pointer"
          >
            &lt; Back
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-3 flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const active = settingsCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSettingsCategory(cat)}
                className={`text-left px-5 py-3.5 text-[18px] font-extrabold tracking-wide transition-all cursor-pointer flex items-center ${
                  active
                    ? 'bg-gradient-to-r from-white/20 to-transparent text-white border-l-4 border-white'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/5'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="col-span-9 max-h-[70vh] overflow-y-auto pr-3 space-y-6">
          {settingsCategory === 'CROSSHAIR' ? (
            <CrosshairEditor />
          ) : (
            <>
              {/* GENERAL SECTION */}
              {(settingsCategory === 'GENERAL' ||
                settingsCategory === 'CONTROLS' ||
                settingsCategory === 'KEYBINDS') && (
                <div className="space-y-1">
                  <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
                    GENERAL
                  </div>

                  {/* Graphics Preset Selector directly accessible in General & Video */}
                  <div className="flex items-center justify-between bg-black/55 px-5 py-3 border-l-3 border-[#2b7fff]">
                    <div>
                      <div className="text-[18px] font-extrabold text-white">
                        Graphics Preset (Grafikqualität):
                      </div>
                      <div className="text-xs font-bold text-white/55">
                        Preset 1: Standard (für schwächere PCs) · Preset 2: Ultra (PBR Sky, 4K Schatten, SSAO &amp; Bloom)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyGraphicsPreset('low')}
                        className={`px-3.5 py-2 text-xs font-extrabold uppercase cursor-pointer ${
                          settings.graphicsPreset === 'low'
                            ? 'bg-[#2b7fff] text-white ring-1 ring-white'
                            : 'bg-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        Preset 1: Low PC
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGraphicsPreset('ultra')}
                        className={`px-3.5 py-2 text-xs font-extrabold uppercase cursor-pointer ${
                          settings.graphicsPreset === 'ultra'
                            ? 'bg-[#2b7fff] text-white ring-1 ring-white'
                            : 'bg-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        Preset 2: Ultra PC
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Region:</span>
                    <select
                      aria-label="Region"
                      value={settings.region}
                      onChange={(e) => updateSettings('region', e.target.value)}
                      className="bg-transparent text-white font-extrabold text-[16px] cursor-pointer outline-none"
                    >
                      <option value="Europe" className="bg-[#181a1e]">
                        Europe
                      </option>
                      <option value="North America" className="bg-[#181a1e]">
                        North America
                      </option>
                      <option value="Asia" className="bg-[#181a1e]">
                        Asia
                      </option>
                      <option value="LAN Direct" className="bg-[#181a1e]">
                        LAN Direct
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Language:</span>
                    <select
                      aria-label="Language"
                      value={settings.language}
                      onChange={(e) => updateSettings('language', e.target.value)}
                      className="bg-transparent text-white font-extrabold text-[16px] cursor-pointer outline-none"
                    >
                      <option value="Default" className="bg-[#181a1e]">
                        Default
                      </option>
                      <option value="English" className="bg-[#181a1e]">
                        English
                      </option>
                      <option value="Deutsch" className="bg-[#181a1e]">
                        Deutsch
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Show FPS / Ping:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.showFpsPing}
                      aria-label="Show FPS / Ping"
                      onClick={() => updateSettings('showFpsPing', !settings.showFpsPing)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.showFpsPing
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Left-Handed:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.leftHanded}
                      aria-label="Left-Handed"
                      onClick={() => updateSettings('leftHanded', !settings.leftHanded)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.leftHanded
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>
                </div>
              )}

              {/* CONTROLS SECTION */}
              {(settingsCategory === 'GENERAL' ||
                settingsCategory === 'CONTROLS' ||
                settingsCategory === 'CONTROLLER') && (
                <div className="space-y-1">
                  <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
                    CONTROLS
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Raw Mouse Input:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.rawMouseInput}
                      aria-label="Raw Mouse Input"
                      onClick={() => updateSettings('rawMouseInput', !settings.rawMouseInput)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.rawMouseInput
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Inverse Mouse Y:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.invertY}
                      aria-label="Inverse Mouse Y"
                      onClick={() => updateSettings('invertY', !settings.invertY)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.invertY
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Sensitivity:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Sensitivity"
                        min={0.1}
                        max={5.0}
                        step={0.05}
                        value={settings.sensitivity}
                        onChange={(e) => updateSettings('sensitivity', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2 text-[15px] font-extrabold font-mono-num text-white">
                        {settings.sensitivity.toFixed(3).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">
                      Zoom Sens Multiplier:
                    </span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Zoom Sens Multiplier"
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        value={settings.zoomSensMultiplier}
                        onChange={(e) =>
                          updateSettings('zoomSensMultiplier', Number(e.target.value))
                        }
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2 text-[15px] font-extrabold font-mono-num text-white">
                        {settings.zoomSensMultiplier.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Toggle ADS:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.toggleAds}
                      aria-label="Toggle ADS"
                      onClick={() => updateSettings('toggleAds', !settings.toggleAds)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.toggleAds
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>
                </div>
              )}

              {/* KEYBINDS SECTION */}
              {(settingsCategory === 'GENERAL' || settingsCategory === 'KEYBINDS') && (
                <div className="space-y-1">
                  <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
                    KEYBINDS
                  </div>

                  {KEYBIND_ROWS.map((row, idx) => {
                    const currentVal = settings.keybinds[row.key];
                    const isListening = listeningKey === row.key;
                    return (
                      <div
                        key={row.key}
                        className={`flex items-center justify-between px-5 py-2.5 ${
                          idx % 2 === 0 ? 'bg-black/45' : 'bg-black/25'
                        }`}
                      >
                        <span className="text-[18px] font-bold text-white/85">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setListeningKey(row.key)}
                            className={`w-36 h-10 flex items-center justify-center text-[15px] font-extrabold tracking-wider cursor-pointer transition-colors ${
                              isListening
                                ? 'bg-[#2b7fff] text-white'
                                : 'bg-[#1c1f24] hover:bg-[#272b32] text-white'
                            }`}
                          >
                            {isListening ? 'PRESS KEY...' : currentVal || 'NONE'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Clear ${row.label} keybind`}
                            onClick={() => updateKeybind(row.key, '')}
                            className="w-10 h-10 bg-[#2a1517] hover:bg-[#461d20] text-[#e74c3c] font-black text-lg flex items-center justify-center cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AUDIO SECTION */}
              {(settingsCategory === 'AUDIO' || settingsCategory === 'KEYBINDS') && (
                <div className="space-y-1">
                  <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
                    AUDIO
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Master Volume:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Master Volume"
                        min={0}
                        max={100}
                        value={settings.masterVolume}
                        onChange={(e) => updateSettings('masterVolume', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
                        {settings.masterVolume}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Sound Effects:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Sound Effects"
                        min={0}
                        max={100}
                        value={settings.soundEffects}
                        onChange={(e) => updateSettings('soundEffects', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
                        {settings.soundEffects}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Ambient Noise:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Ambient Noise"
                        min={0}
                        max={100}
                        value={settings.ambientNoise}
                        onChange={(e) => updateSettings('ambientNoise', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
                        {settings.ambientNoise}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIDEO SECTION */}
              {(settingsCategory === 'VIDEO' ||
                settingsCategory === 'AUDIO' ||
                settingsCategory === 'KEYBINDS') && (
                <div className="space-y-1">
                  <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
                    VIDEO
                  </div>

                  <div className="flex items-center justify-between bg-black/55 px-5 py-3 border-l-3 border-[#2b7fff]">
                    <span className="text-[18px] font-bold text-white/85">
                      Graphics Preset (Low vs Ultra):
                    </span>
                    <select
                      aria-label="Graphics Preset"
                      value={settings.graphicsPreset}
                      onChange={(e) =>
                        applyGraphicsPreset(e.target.value as GraphicsPreset)
                      }
                      className="bg-transparent text-white font-extrabold text-[16px] cursor-pointer outline-none"
                    >
                      <option value="low" className="bg-[#181a1e]">
                        Preset 1: Standard (Für schwächere PCs)
                      </option>
                      <option value="ultra" className="bg-[#181a1e]">
                        Preset 2: Ultra (Für starke PCs - SSAO, Bloom &amp; Sky)
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Anti-Aliasing:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.antiAliasing}
                      aria-label="Anti-Aliasing"
                      onClick={() => updateSettings('antiAliasing', !settings.antiAliasing)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.antiAliasing
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Fullscreen:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.fullscreen}
                      aria-label="Fullscreen"
                      onClick={handleToggleFullscreen}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.fullscreen
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Field of View:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Field of View"
                        min={60}
                        max={120}
                        value={settings.fov}
                        onChange={(e) => updateSettings('fov', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
                        {settings.fov}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Resolution:</span>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        aria-label="Resolution"
                        min={0.5}
                        max={1.5}
                        step={0.05}
                        value={settings.resolution}
                        onChange={(e) => updateSettings('resolution', Number(e.target.value))}
                        className="deadshot-slider w-44"
                      />
                      <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
                        {settings.resolution.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">FP Bullet Tracers:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.fpBulletTracers}
                      aria-label="FP Bullet Tracers"
                      onClick={() => updateSettings('fpBulletTracers', !settings.fpBulletTracers)}
                      className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
                        settings.fpBulletTracers
                          ? 'bg-white/45 justify-end'
                          : 'bg-white/25 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white block shadow-sm" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/25 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Enemy Outline:</span>
                    <select
                      aria-label="Enemy Outline"
                      value={settings.enemyOutline}
                      onChange={(e) =>
                        updateSettings(
                          'enemyOutline',
                          e.target.value as 'Red' | 'Yellow' | 'Purple' | 'None'
                        )
                      }
                      className="bg-transparent text-white font-extrabold text-[16px] cursor-pointer outline-none"
                    >
                      <option value="Red" className="bg-[#181a1e]">
                        Red
                      </option>
                      <option value="Yellow" className="bg-[#181a1e]">
                        Yellow
                      </option>
                      <option value="Purple" className="bg-[#181a1e]">
                        Purple
                      </option>
                      <option value="None" className="bg-[#181a1e]">
                        None
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-black/45 px-5 py-3">
                    <span className="text-[18px] font-bold text-white/85">Sight Color:</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{
                          backgroundColor:
                            settings.sightColor === 'Green'
                              ? '#22c55e'
                              : settings.sightColor === 'Cyan'
                                ? '#06b6d4'
                                : '#ef4444',
                        }}
                      />
                      <select
                        aria-label="Sight Color"
                        value={settings.sightColor}
                        onChange={(e) =>
                          updateSettings(
                            'sightColor',
                            e.target.value as 'Red' | 'Green' | 'Cyan'
                          )
                        }
                        className="bg-transparent text-white font-extrabold text-[16px] cursor-pointer outline-none"
                      >
                        <option value="Red" className="bg-[#181a1e]">
                          Red
                        </option>
                        <option value="Green" className="bg-[#181a1e]">
                          Green
                        </option>
                        <option value="Cyan" className="bg-[#181a1e]">
                          Cyan
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
