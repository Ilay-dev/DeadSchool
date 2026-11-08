import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  WEAPON_CLASSES,
  DEFAULT_CAMPUS_SPAWNS,
  CAMPUS_SCOOTER_SPAWNS,
  CAMPUS_PICKUP_SPAWN_POINTS,
  MAX_ACTIVE_SCOOTERS,
  SCOOTER_DURATION_SEC,
  SCOOTER_RESPAWN_INTERVAL_SEC,
  MAX_MAP_VAPES,
  MAX_MAP_KONG_STRONG,
  MAX_MAP_CROISSANTS,
  VAPE_SMOKE_RADIUS,
  VAPE_SMOKE_DURATION_MS,
  PLAYER_DIMENSIONS,
  canFireWeaponOnScooter,
  stepThrownVapeProjectile,
  selectSafestSpawnPoint,
  type WeaponId,
  type GameModeId,
  type SpawnPoint,
  type PickupItemType,
} from '../game/rules';

export type ScreenState =
  | 'main_menu'
  | 'match_lobby'
  | 'select_class'
  | 'playing'
  | 'paused'
  | 'gameover';

export type TopNavTab =
  | 'PLAY GAME'
  | 'SETTINGS'
  | 'SHOP'
  | 'LOCKER'
  | 'LEADERBOARD';

export type SettingsCategory =
  | 'GENERAL'
  | 'CONTROLS'
  | 'KEYBINDS'
  | 'AUDIO'
  | 'VIDEO'
  | 'CROSSHAIR'
  | 'CONTROLLER';

export type GraphicsPreset = 'low' | 'ultra';

export interface CrosshairSettings {
  staticCrosshair: boolean;
  centerDot: boolean;
  color: string;
  alpha: number; // 0-255, default 178
  thickness: number; // default 3
  length: number; // default 15
  spacing: number; // default 0.25
  outlineThickness: number; // default 1
  outlineAlpha: number; // 0-255, default 178
}

export interface KeybindSettings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string; // Shift -> Slide
  interact: string; // E -> Mount E-Scooter
  reload: string;
  shoot: string;
  ads: string;
  knife: string;
  spray: string;
  quickChat: string;
  switchClass: string;
}

export interface GameSettings {
  // General
  region: string;
  language: string;
  showFpsPing: boolean;
  leftHanded: boolean;
  // Controls
  rawMouseInput: boolean;
  invertY: boolean;
  sensitivity: number; // default 1.500
  zoomSensMultiplier: number; // default 0.70
  toggleAds: boolean;
  // Keybinds
  keybinds: KeybindSettings;
  // Audio
  masterVolume: number; // default 60
  soundEffects: number; // default 100
  ambientNoise: number; // default 100
  // Video & Graphics Presets
  graphicsPreset: GraphicsPreset; // 'low' (Standard/Low PC) vs 'ultra' (High-End PC)
  antiAliasing: boolean;
  fullscreen: boolean;
  fov: number; // default 90
  resolution: number; // default 1.00
  fpBulletTracers: boolean;
  enemyOutline: 'Red' | 'Yellow' | 'Purple' | 'None';
  sightColor: 'Red' | 'Green' | 'Cyan';
  // Crosshair
  crosshair: CrosshairSettings;
}

export interface TransformSnapshot {
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number];
  timestamp: number;
}

export interface RemoteActor {
  id: string;
  name: string;
  team: 'alpha' | 'bravo';
  weaponClass: WeaponId;
  ready: boolean;
  hp: number;
  maxHp: number;
  score: number;
  kills: number;
  deaths: number;
  ping: number;
  position: [number, number, number];
  targetPosition: [number, number, number];
  velocity: [number, number, number];
  rotation: [number, number];
  crouching: boolean;
  sliding?: boolean;
  ads: boolean;
  ridingScooter?: boolean;
  stunnedUntil?: number; // Timestamp until which actor is knocked out by Lidl Scanner
  isBot?: boolean;
  botArchetype?: 'rusher' | 'strafer' | 'anchor';
  waypointIndex?: number;
  lastHitTime?: number;
  snapshotBuffer?: TransformSnapshot[];
}

export interface MapScooterState {
  id: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  mountedByPlayerId: string | null;
  batteryRemainingSec: number; // 20s ride duration before expiring
}

export interface GroundPickupItem {
  id: string;
  type: PickupItemType; // 'vape_smoke' | 'kong_strong' | 'choco_croissant'
  position: [number, number, number];
  rotationY: number;
}

export interface ThrownVapeState {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  groundY: number;
}

export interface SmokeCloudState {
  id: string;
  position: [number, number, number];
  createdAt: number;
  expiresAt: number;
  radius: number;
}

export interface KillFeedItem {
  id: string;
  killer: string;
  killerTeam: 'alpha' | 'bravo';
  victim: string;
  victimTeam: 'alpha' | 'bravo';
  weapon: string;
  weaponId: WeaponId;
  isHeadshot: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  team: 'alpha' | 'bravo';
  text: string;
  timestamp: number;
}

export interface EliminatedByInfo {
  name: string;
  team: 'alpha' | 'bravo';
  hp: number;
  maxHp: number;
  weaponClass: WeaponId;
}

export interface FloatingDamageIndicator {
  id: string;
  targetId: string;
  damage: number;
  totalDamage: number;
  hitCount: number;
  isHeadshot: boolean;
  position: [number, number, number];
  createdAt: number;
  durationMs: number;
}

export interface GameStoreState {
  // Navigation & Screen
  screen: ScreenState;
  previousScreen: ScreenState;
  topNavTab: TopNavTab;
  settingsCategory: SettingsCategory;
  settingsOpenFromPause: boolean;
  tabLeaderboardOpen: boolean;

  // Customization & Skins
  equippedWeaponSkin: string;
  equippedSoldierSkin: string;
  damageIndicators: FloatingDamageIndicator[];

  // Player Profile & Party
  playerId: string;
  playerName: string;
  isLoggedIn: boolean;
  partySlots: (string | null)[];
  onlinePlayersCount: number;
  localScore: number;
  localKills: number;
  localDeaths: number;

  // Match Lobby & LAN / P2P Room Code Networking
  roomCode: string;
  lanIp: string;
  networkTransport: 'lan-ws' | 'webrtc-p2p' | 'offline-lan';
  isHost: boolean;
  isPublicRoom: boolean;
  selectedMapId: string;
  selectedModeId: GameModeId;
  playerTeam: 'alpha' | 'bravo';
  isReady: boolean;
  isSpectating: boolean;
  peerId: string;
  connectedPeersCount: number;

  // Map Parsed Spawns & Respawn Signal
  spawnPoints: SpawnPoint[];
  activeSpawnPoint: SpawnPoint;
  respawnNonce: number;

  // E-Scooters (rarer on map, max 2 active at once, 20s ride duration)
  scooters: MapScooterState[];
  ridingScooterId: string | null;
  nearbyScooterId: string | null;
  scooterSpawnTimerSec: number;

  // Map Ground Pickups & Thrown Vape Smoke Clouds
  vapeCount: number;
  kongStrongUntil: number;
  mapPickups: GroundPickupItem[];
  thrownVapes: ThrownVapeState[];
  smokeClouds: SmokeCloudState[];
  pickupSpawnTimerSec: number;

  // Active Combat, Slide & Stun State
  selectedClass: WeaponId;
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  slideDistanceRemaining: number;
  stunnedUntil: number;
  isEliminated: boolean;
  eliminatedBy: EliminatedByInfo | null;
  isShooting: boolean;
  movementSpeedRatio: number;
  recoilBloom: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
  damageFlashAlpha: number;

  // Match Scores
  alphaScore: number;
  bravoScore: number;
  matchTimeRemaining: number; // seconds

  // Remote Players & Tactical Bots
  remotePlayers: Record<string, RemoteActor>;
  killFeed: KillFeedItem[];
  chatMessages: ChatMessage[];
  chatInputOpen: boolean;

  // Persisted Settings
  settings: GameSettings;

  // Actions
  setScreen: (screen: ScreenState) => void;
  setTopNavTab: (tab: TopNavTab) => void;
  setSettingsCategory: (cat: SettingsCategory) => void;
  openSettingsFromPause: () => void;
  closeSettingsBack: () => void;
  setTabLeaderboardOpen: (open: boolean) => void;
  toggleLogin: () => void;
  addPartyMember: (slotIndex: number) => void;

  // Spawn Actions
  registerSpawnPoints: (spawns: SpawnPoint[]) => void;
  getSafestSpawnForTeam: (team: 'alpha' | 'bravo') => SpawnPoint;

  // E-Scooter & Pickup Actions
  setNearbyScooterId: (scooterId: string | null) => void;
  toggleMountScooter: (playerPos: [number, number, number], playerRotY: number) => boolean;
  updateMountedScooterTransform: (pos: [number, number, number], rotY: number) => void;
  collectNearbyPickups: (playerFootPos: [number, number, number]) => PickupItemType[];
  throwVapeSmokeGrenade: (
    origin: [number, number, number],
    direction: [number, number, number],
    groundY?: number
  ) => boolean;

  // Lobby & Mode Actions
  setMapId: (mapId: string) => void;
  setModeId: (modeId: GameModeId) => void;
  switchTeam: () => void;
  toggleReady: () => void;
  togglePublicRoom: () => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setLanInfo: (lanIp: string, transport?: 'lan-ws' | 'webrtc-p2p' | 'offline-lan') => void;
  setPeerInfo: (peerId: string, count: number) => void;

  // Class, Slide, Stun & Combat Actions
  selectClassAndDeploy: (weaponId: WeaponId) => void;
  setEquippedWeaponSkin: (skinId: string) => void;
  setEquippedSoldierSkin: (skinId: string) => void;
  addDamageIndicator: (
    targetId: string,
    damage: number,
    isHeadshot: boolean,
    position: [number, number, number]
  ) => void;
  removeDamageIndicator: (id: string) => void;
  fireRound: () => boolean;
  startReload: () => void;
  finishReload: () => void;
  setAds: (ads: boolean) => void;
  setCrouching: (crouching: boolean) => void;
  setSliding: (sliding: boolean, distanceRemaining?: number) => void;
  setMovementSpeedRatio: (ratio: number) => void;
  triggerHitmarker: (headshot: boolean) => void;
  applyPlayerDamage: (amount: number, attacker?: EliminatedByInfo) => void;
  applyPlayerStun: (durationMs: number) => void;
  respawnPlayer: () => void;
  tickMatchTimer: (dt: number) => void;

  // Remote & Bot State Actions
  syncRemotePlayers: (players: Record<string, RemoteActor>) => void;
  updateRemoteTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number],
    crouching: boolean,
    ads: boolean,
    weaponClass: WeaponId,
    velocity?: [number, number, number],
    ridingScooter?: boolean,
    playerName?: string,
    team?: 'alpha' | 'bravo',
    sliding?: boolean,
    meta?: {
      hp?: number;
      maxHp?: number;
      kills?: number;
      deaths?: number;
      score?: number;
      ready?: boolean;
    }
  ) => void;
  removeRemotePlayer: (id: string) => void;
  damageRemoteActor: (
    targetId: string,
    damage: number,
    isHeadshot: boolean,
    attackerName?: string,
    attackerTeam?: 'alpha' | 'bravo',
    weaponName?: string,
    weaponId?: WeaponId
  ) => { killed: boolean };
  stunRemoteActor: (targetId: string, durationMs: number, attackerName?: string) => void;
  addChatMessage: (senderName: string, team: 'alpha' | 'bravo', text: string) => void;
  setChatInputOpen: (open: boolean) => void;

  // Settings Actions
  updateSettings: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  setGraphicsPreset: (preset: GraphicsPreset) => void;
  updateCrosshair: <K extends keyof CrosshairSettings>(
    key: K,
    value: CrosshairSettings[K]
  ) => void;
  updateKeybind: (action: keyof KeybindSettings, keyName: string) => void;
  resetCrosshairDefaults: () => void;
}

const DEFAULT_CROSSHAIR: CrosshairSettings = {
  staticCrosshair: true,
  centerDot: false,
  color: '#EEEEEE',
  alpha: 178,
  thickness: 3,
  length: 15,
  spacing: 0.25,
  outlineThickness: 1,
  outlineAlpha: 178,
};

const DEFAULT_KEYBINDS: KeybindSettings = {
  forward: 'W',
  backward: 'S',
  left: 'A',
  right: 'D',
  jump: 'SPACE',
  crouch: 'SHIFT', // Shift slides!
  interact: 'E', // E mounts/dismounts E-Scooter!
  reload: 'R',
  shoot: 'K',
  ads: 'L',
  knife: '3',
  spray: 'T',
  quickChat: 'Z',
  switchClass: 'B',
};

const DEFAULT_SETTINGS: GameSettings = {
  region: 'Europe',
  language: 'Default',
  showFpsPing: true,
  leftHanded: false,
  rawMouseInput: true,
  invertY: false,
  sensitivity: 1.5,
  zoomSensMultiplier: 0.7,
  toggleAds: false,
  keybinds: DEFAULT_KEYBINDS,
  masterVolume: 60,
  soundEffects: 100,
  ambientNoise: 100,
  graphicsPreset: 'ultra',
  antiAliasing: true,
  fullscreen: false,
  fov: 90,
  resolution: 1.0,
  fpBulletTracers: true,
  enemyOutline: 'Red',
  sightColor: 'Red',
  crosshair: DEFAULT_CROSSHAIR,
};

function createInitialScooters(): MapScooterState[] {
  // E-Scooters are rarer: only MAX_ACTIVE_SCOOTERS (2) spawn initially, each lasting 20s
  return CAMPUS_SCOOTER_SPAWNS.slice(0, MAX_ACTIVE_SCOOTERS).map((s) => ({
    id: s.id,
    label: s.label,
    position: [...s.position] as [number, number, number],
    rotationY: s.rotationY,
    mountedByPlayerId: null,
    batteryRemainingSec: SCOOTER_DURATION_SEC,
  }));
}

function createInitialGroundPickups(): GroundPickupItem[] {
  const initialTypes: PickupItemType[] = [
    'vape_smoke',
    'kong_strong',
    'choco_croissant',
    'vape_smoke',
    'kong_strong',
    'choco_croissant',
    'vape_smoke',
    'kong_strong',
    'choco_croissant',
  ];
  return initialTypes.map((type, idx) => {
    const pt = CAMPUS_PICKUP_SPAWN_POINTS[idx % CAMPUS_PICKUP_SPAWN_POINTS.length];
    return {
      id: `pickup_init_${type}_${idx}`,
      type,
      position: [...pt] as [number, number, number],
      rotationY: (idx * 1.1) % (Math.PI * 2),
    };
  });
}

/**
 * Creates AI Bots at distinct Spawn_02 .. Spawn_06 points ONLY for 'BOTS' mode.
 */
function createBotsForBotMode(spawns: SpawnPoint[]): Record<string, RemoteActor> {
  const pool = spawns.length >= 6 ? spawns : DEFAULT_CAMPUS_SPAWNS;
  return {
    bot_alpha_1: {
      id: 'bot_alpha_1',
      name: 'run4baby',
      team: 'alpha',
      weaponClass: 'sniper',
      ready: true,
      hp: 100,
      maxHp: 100,
      score: 150,
      kills: 1,
      deaths: 1,
      ping: 14,
      position: [...pool[1].position] as [number, number, number],
      targetPosition: [...pool[1].position] as [number, number, number],
      velocity: [0, 0, 0],
      rotation: [0, pool[1].rotationY],
      crouching: false,
      ads: false,
      isBot: true,
      botArchetype: 'strafer',
      waypointIndex: 2,
    },
    bot_alpha_2: {
      id: 'bot_alpha_2',
      name: 'Player_3',
      team: 'alpha',
      weaponClass: 'shotgun',
      ready: true,
      hp: 100,
      maxHp: 100,
      score: 0,
      kills: 0,
      deaths: 2,
      ping: 18,
      position: [...pool[2].position] as [number, number, number],
      targetPosition: [...pool[2].position] as [number, number, number],
      velocity: [0, 0, 0],
      rotation: [0, pool[2].rotationY],
      crouching: false,
      ads: false,
      isBot: true,
      botArchetype: 'rusher',
      waypointIndex: 4,
    },
    bot_bravo_1: {
      id: 'bot_bravo_1',
      name: 'lochtiroler69',
      team: 'bravo',
      weaponClass: 'sniper',
      ready: true,
      hp: 100,
      maxHp: 100,
      score: 300,
      kills: 2,
      deaths: 0,
      ping: 12,
      position: [...pool[3].position] as [number, number, number],
      targetPosition: [...pool[3].position] as [number, number, number],
      velocity: [0, 0, 0],
      rotation: [0, pool[3].rotationY],
      crouching: false,
      ads: true,
      isBot: true,
      botArchetype: 'rusher',
      waypointIndex: 0,
    },
    bot_bravo_2: {
      id: 'bot_bravo_2',
      name: 'Player_2',
      team: 'bravo',
      weaponClass: 'assault',
      ready: true,
      hp: 100,
      maxHp: 100,
      score: 150,
      kills: 1,
      deaths: 0,
      ping: 21,
      position: [...pool[4].position] as [number, number, number],
      targetPosition: [...pool[4].position] as [number, number, number],
      velocity: [0, 0, 0],
      rotation: [0, pool[4].rotationY],
      crouching: false,
      ads: true,
      isBot: true,
      botArchetype: 'strafer',
      waypointIndex: 1,
    },
    bot_bravo_3: {
      id: 'bot_bravo_3',
      name: 'mousepad killer',
      team: 'bravo',
      weaponClass: 'semi_sniper',
      ready: true,
      hp: 100,
      maxHp: 100,
      score: 0,
      kills: 0,
      deaths: 0,
      ping: 34,
      position: [...pool[5].position] as [number, number, number],
      targetPosition: [...pool[5].position] as [number, number, number],
      velocity: [0, 0, 0],
      rotation: [0, pool[5].rotationY],
      crouching: false,
      ads: false,
      isBot: true,
      botArchetype: 'anchor',
      waypointIndex: 3,
    },
  };
}

function syncBodyDataset(screen: ScreenState) {
  if (typeof document !== 'undefined') {
    if (screen === 'playing') {
      document.body.dataset.state = 'playing';
    } else if (screen === 'paused') {
      document.body.dataset.state = 'paused';
    } else if (screen === 'gameover') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      screen: 'main_menu',
      previousScreen: 'main_menu',
      topNavTab: 'PLAY GAME',
      settingsCategory: 'GENERAL',
      settingsOpenFromPause: false,
      tabLeaderboardOpen: false,

      equippedWeaponSkin: 'default',
      equippedSoldierSkin: 'default',
      damageIndicators: [],

      playerId: `p_${Math.random().toString(36).slice(2, 8)}`,
      playerName: `Player_${Math.floor(100 + Math.random() * 899)}`,
      isLoggedIn: false,
      partySlots: [null, null, null],
      onlinePlayersCount: 443,
      localScore: 0,
      localKills: 0,
      localDeaths: 0,

      roomCode: 'WORLD',
      lanIp: '192.168.1.100',
      networkTransport: 'webrtc-p2p',
      isHost: true,
      isPublicRoom: true,
      selectedMapId: 'timber_campus',
      selectedModeId: 'TDM',
      playerTeam: 'alpha',
      isReady: false,
      isSpectating: false,
      peerId: '',
      connectedPeersCount: 1,

      spawnPoints: DEFAULT_CAMPUS_SPAWNS,
      activeSpawnPoint: DEFAULT_CAMPUS_SPAWNS[0],
      respawnNonce: 0,

      scooters: createInitialScooters(),
      ridingScooterId: null,
      nearbyScooterId: null,
      scooterSpawnTimerSec: 0,

      vapeCount: 1,
      kongStrongUntil: 0,
      mapPickups: createInitialGroundPickups(),
      thrownVapes: [],
      smokeClouds: [],
      pickupSpawnTimerSec: 0,

      selectedClass: 'assault',
      hp: 100,
      maxHp: 100,
      ammo: 30,
      maxAmmo: 30,
      isReloading: false,
      reloadProgress: 0,
      isAds: false,
      isCrouching: false,
      isSliding: false,
      slideDistanceRemaining: PLAYER_DIMENSIONS.slideMaxFlatDistance,
      stunnedUntil: 0,
      isEliminated: false,
      eliminatedBy: null,
      isShooting: false,
      movementSpeedRatio: 0,
      recoilBloom: 0,
      hitmarkerActive: false,
      hitmarkerHeadshot: false,
      damageFlashAlpha: 0,

      alphaScore: 0,
      bravoScore: 0,
      matchTimeRemaining: 266, // 4:26 matching Screenshot 1

      remotePlayers: {},
      killFeed: [
        {
          id: 'kf_init_1',
          killer: 'lochtiroler69',
          killerTeam: 'bravo',
          victim: 'run4baby',
          victimTeam: 'alpha',
          weapon: 'Sniper Rifle',
          weaponId: 'sniper',
          isHeadshot: true,
          timestamp: Date.now(),
        },
        {
          id: 'kf_init_2',
          killer: 'Player_2',
          killerTeam: 'bravo',
          victim: 'Player_3',
          victimTeam: 'alpha',
          weapon: 'Assault Rifle',
          weaponId: 'assault',
          isHeadshot: true,
          timestamp: Date.now(),
        },
      ],
      chatMessages: [
        {
          id: 'sys_1',
          senderName: 'SYSTEM',
          team: 'alpha',
          text: 'Timber Campus · [Q] Vape · [Shift] Sliden · [E] E-Scooter (20s)',
          timestamp: Date.now(),
        },
      ],
      chatInputOpen: false,

      settings: DEFAULT_SETTINGS,

      setScreen: (screen) => {
        syncBodyDataset(screen);
        set((state) => ({
          previousScreen: state.screen,
          screen,
          settingsOpenFromPause: false,
          tabLeaderboardOpen: false,
        }));
      },

      setTopNavTab: (tab) =>
        set(() => ({
          topNavTab: tab,
        })),

      setSettingsCategory: (cat) =>
        set(() => ({
          settingsCategory: cat,
        })),

      openSettingsFromPause: () =>
        set(() => ({
          settingsOpenFromPause: true,
          topNavTab: 'SETTINGS',
        })),

      closeSettingsBack: () =>
        set((state) => {
          if (state.settingsOpenFromPause) {
            return {
              settingsOpenFromPause: false,
              topNavTab: 'PLAY GAME',
              screen: 'paused',
            };
          }
          return {
            topNavTab: 'PLAY GAME',
          };
        }),

      setTabLeaderboardOpen: (open) => set({ tabLeaderboardOpen: open }),

      toggleLogin: () =>
        set((state) => ({
          isLoggedIn: !state.isLoggedIn,
          playerName: !state.isLoggedIn ? 'DeadSchool_Pro' : 'Player_4',
        })),

      addPartyMember: (slotIndex) =>
        set((state) => {
          const next = [...state.partySlots];
          const names = ['SniperWolf_LAN', 'Tactical_Fox', 'Echo_Zero'];
          next[slotIndex] = next[slotIndex] ? null : names[slotIndex % names.length];
          return { partySlots: next };
        }),

      registerSpawnPoints: (spawns) => {
        if (!spawns || spawns.length === 0) return;
        set((state) => ({
          spawnPoints: spawns,
          activeSpawnPoint: spawns[0] || state.activeSpawnPoint,
        }));
      },

      getSafestSpawnForTeam: (team) => {
        const state = get();
        const allActors = Object.values(state.remotePlayers);
        const enemies = allActors
          .filter((p) => state.selectedModeId === 'FFA' || p.team !== team)
          .map((p) => p.position);
        const occupied = allActors.map((p) => p.position);
        return selectSafestSpawnPoint(state.spawnPoints, enemies, occupied);
      },

      setNearbyScooterId: (scooterId) =>
        set((state) => {
          if (state.nearbyScooterId === scooterId) return state;
          return { nearbyScooterId: scooterId };
        }),

      toggleMountScooter: (playerPos, playerRotY) => {
        const state = get();
        if (state.ridingScooterId) {
          // Dismount current E-Scooter at player's current position
          const updated = state.scooters.map((sc) =>
            sc.id === state.ridingScooterId
              ? {
                  ...sc,
                  position: [playerPos[0], playerPos[1], playerPos[2]] as [
                    number,
                    number,
                    number,
                  ],
                  rotationY: playerRotY,
                  mountedByPlayerId: null,
                }
              : sc
          );
          set({
            scooters: updated,
            ridingScooterId: null,
          });
          return false;
        }

        // Find closest available E-Scooter within 2.8m that still has battery (> 0s)
        let closest: MapScooterState | null = null;
        let closestDist = 2.8;
        for (const sc of state.scooters) {
          if (sc.mountedByPlayerId || sc.batteryRemainingSec <= 0) continue;
          const dist = Math.hypot(
            sc.position[0] - playerPos[0],
            sc.position[2] - playerPos[2]
          );
          if (dist <= closestDist) {
            closestDist = dist;
            closest = sc;
          }
        }

        if (!closest) return false;

        const targetId = closest.id;
        set((s) => ({
          ridingScooterId: targetId,
          isCrouching: false,
          isSliding: false,
          isAds: false,
          scooters: s.scooters.map((sc) =>
            sc.id === targetId ? { ...sc, mountedByPlayerId: s.playerId } : sc
          ),
        }));
        return true;
      },

      updateMountedScooterTransform: (pos, rotY) => {
        const state = get();
        if (!state.ridingScooterId) return;
        set((s) => ({
          scooters: s.scooters.map((sc) =>
            sc.id === s.ridingScooterId
              ? { ...sc, position: pos, rotationY: rotY }
              : sc
          ),
        }));
      },

      collectNearbyPickups: (playerFootPos) => {
        const state = get();
        if (state.screen !== 'playing' || state.isEliminated || state.mapPickups.length === 0) {
          return [];
        }

        const collectedTypes: PickupItemType[] = [];
        const remainingPickups: GroundPickupItem[] = [];

        let nextVapeCount = state.vapeCount;
        let nextKongStrongUntil = state.kongStrongUntil;
        let nextHp = state.hp;

        for (const item of state.mapPickups) {
          const dx = item.position[0] - playerFootPos[0];
          const dy = item.position[1] - playerFootPos[1];
          const dz = item.position[2] - playerFootPos[2];
          const horizDist = Math.hypot(dx, dz);

          if (horizDist <= 1.85 && Math.abs(dy) <= 2.2) {
            collectedTypes.push(item.type);
            if (item.type === 'vape_smoke') {
              nextVapeCount += 1;
            } else if (item.type === 'kong_strong') {
              nextKongStrongUntil = Date.now() + PLAYER_DIMENSIONS.kongStrongDurationMs;
            } else if (item.type === 'choco_croissant') {
              nextHp = state.maxHp;
            }
          } else {
            remainingPickups.push(item);
          }
        }

        if (collectedTypes.length > 0) {
          set({
            mapPickups: remainingPickups,
            vapeCount: nextVapeCount,
            kongStrongUntil: nextKongStrongUntil,
            hp: nextHp,
          });
        }

        return collectedTypes;
      },

      throwVapeSmokeGrenade: (origin, direction, groundY = 0.15) => {
        const state = get();
        if (
          state.screen !== 'playing' ||
          state.isEliminated ||
          Date.now() < state.stunnedUntil ||
          state.vapeCount <= 0
        ) {
          return false;
        }

        const dirLen = Math.hypot(direction[0], direction[1], direction[2]) || 1;
        const nx = direction[0] / dirLen;
        const ny = direction[1] / dirLen;
        const nz = direction[2] / dirLen;

        const thrown: ThrownVapeState = {
          id: `vape_proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          position: [origin[0] + nx * 0.45, origin[1], origin[2] + nz * 0.45],
          velocity: [nx * 14.5, ny * 14.5 + 4.2, nz * 14.5],
          groundY: Math.max(0.12, groundY),
        };

        set((s) => ({
          vapeCount: Math.max(0, s.vapeCount - 1),
          thrownVapes: [...s.thrownVapes, thrown],
        }));

        return true;
      },

      setMapId: (mapId) => set({ selectedMapId: mapId }),

      setModeId: (modeId) =>
        set((state) => {
          // Only include AI Bots when modeId === 'BOTS'!
          // In 'TDM' (3v3) and 'FFA', remove all AI bots so only real human players compete.
          const humanPeersOnly: Record<string, RemoteActor> = {};
          Object.values(state.remotePlayers).forEach((p) => {
            if (!p.isBot) {
              humanPeersOnly[p.id] = p;
            }
          });

          const nextRemotePlayers =
            modeId === 'BOTS'
              ? { ...createBotsForBotMode(state.spawnPoints), ...humanPeersOnly }
              : humanPeersOnly;

          return {
            selectedModeId: modeId,
            remotePlayers: nextRemotePlayers,
          };
        }),

      switchTeam: () =>
        set((state) => ({
          playerTeam: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
        })),

      toggleReady: () =>
        set((state) => ({
          isReady: !state.isReady,
        })),

      togglePublicRoom: () =>
        set((state) => ({
          isPublicRoom: !state.isPublicRoom,
        })),

      setRoomCode: (code) =>
        set({
          roomCode:
            code
              .replace(/[^A-Z0-9_-]/gi, '')
              .toUpperCase()
              .slice(0, 10) || 'WORLD',
        }),
      setIsHost: (isHost) => set({ isHost }),

      setLanInfo: (lanIp, transport) =>
        set((state) => ({
          lanIp,
          networkTransport: transport || state.networkTransport,
        })),

      setPeerInfo: (peerId, count) =>
        set({
          peerId,
          connectedPeersCount: count,
        }),

      setEquippedWeaponSkin: (skinId) => set({ equippedWeaponSkin: skinId }),
      setEquippedSoldierSkin: (skinId) => set({ equippedSoldierSkin: skinId }),

      addDamageIndicator: (targetId, damage, isHeadshot, position) => {
        const now = Date.now();
        set((state) => {
          const existingIdx = state.damageIndicators.findIndex(
            (ind) => ind.targetId === targetId && now - ind.createdAt < 750
          );
          if (existingIdx >= 0) {
            const current = state.damageIndicators[existingIdx];
            const updated: FloatingDamageIndicator = {
              ...current,
              damage,
              totalDamage: current.totalDamage + damage,
              hitCount: current.hitCount + 1,
              isHeadshot: isHeadshot || current.isHeadshot,
              position: [position[0], position[1] + 0.12, position[2]],
              createdAt: now,
              durationMs: 1100,
            };
            const nextList = [...state.damageIndicators];
            nextList[existingIdx] = updated;
            return { damageIndicators: nextList };
          }
          const newIndicator: FloatingDamageIndicator = {
            id: `dmg_${now}_${Math.random().toString(36).slice(2, 6)}`,
            targetId,
            damage,
            totalDamage: damage,
            hitCount: 1,
            isHeadshot,
            position,
            createdAt: now,
            durationMs: 1100,
          };
          return {
            damageIndicators: [...state.damageIndicators.slice(-15), newIndicator],
          };
        });
      },

      removeDamageIndicator: (id) =>
        set((state) => ({
          damageIndicators: state.damageIndicators.filter((d) => d.id !== id),
        })),

      selectClassAndDeploy: (weaponId) => {
        const state = get();
        const stats = WEAPON_CLASSES[weaponId];
        syncBodyDataset('playing');

        const wasAliveInMatch =
          !state.isEliminated &&
          (state.screen === 'playing' ||
            state.screen === 'paused' ||
            state.screen === 'select_class');

        if (wasAliveInMatch) {
          // Keep current position - DO NOT RESPAWN!
          set((s) => ({
            selectedClass: weaponId,
            hp: Math.min(s.hp, stats.health),
            maxHp: stats.health,
            ammo: stats.ammo,
            maxAmmo: stats.maxAmmo,
            isReloading: false,
            reloadProgress: 0,
            isAds: false,
            isSliding: false,
            screen: 'playing',
            settingsOpenFromPause: false,
          }));
          return;
        }

        const safestSpawn = state.getSafestSpawnForTeam(state.playerTeam);
        const isFromGameOver = state.screen === 'gameover';
        set((s) => ({
          selectedClass: weaponId,
          hp: stats.health,
          maxHp: stats.health,
          ammo: stats.ammo,
          maxAmmo: stats.maxAmmo,
          isReloading: false,
          reloadProgress: 0,
          isAds: false,
          isSliding: false,
          isEliminated: false,
          eliminatedBy: null,
          activeSpawnPoint: safestSpawn,
          respawnNonce: s.respawnNonce + 1,
          screen: 'playing',
          settingsOpenFromPause: false,
          alphaScore: isFromGameOver ? 0 : s.alphaScore,
          bravoScore: isFromGameOver ? 0 : s.bravoScore,
          matchTimeRemaining: isFromGameOver ? 300 : s.matchTimeRemaining,
          localKills: isFromGameOver ? 0 : s.localKills,
          localDeaths: isFromGameOver ? 0 : s.localDeaths,
          localScore: isFromGameOver ? 0 : s.localScore,
        }));
      },

      fireRound: () => {
        const state = get();
        if (state.isEliminated || Date.now() < state.stunnedUntil) return false;
        // E-Scooter firing rule: Cannot shoot from E-Scooters EXCEPT with the Lidl Barcode Scanner!
        if (!canFireWeaponOnScooter(state.selectedClass, Boolean(state.ridingScooterId))) {
          return false;
        }
        if (state.isReloading || state.ammo <= 0) {
          if (state.ammo <= 0 && !state.isReloading) {
            get().startReload();
          }
          return false;
        }
        const nextAmmo = state.ammo - 1;
        set({
          ammo: nextAmmo,
          recoilBloom: Math.min(1.5, state.recoilBloom + 0.25),
        });
        if (nextAmmo <= 0) {
          setTimeout(() => {
            get().startReload();
          }, 180);
        }
        return true;
      },

      startReload: () => {
        const state = get();
        if (state.isReloading || state.ammo >= state.maxAmmo) return;
        set({ isReloading: true, isAds: false, reloadProgress: 0 });
      },

      finishReload: () => {
        const state = get();
        const stats = WEAPON_CLASSES[state.selectedClass];
        set({
          ammo: stats.maxAmmo,
          maxAmmo: stats.maxAmmo,
          isReloading: false,
          reloadProgress: 0,
        });
      },

      setAds: (ads) =>
        set((state) => ({
          isAds: state.isReloading || state.isEliminated ? false : ads,
        })),

      setCrouching: (crouching) => set({ isCrouching: crouching }),

      setSliding: (sliding, distanceRemaining) =>
        set((state) => ({
          isSliding: sliding,
          isCrouching: sliding,
          slideDistanceRemaining:
            distanceRemaining !== undefined
              ? distanceRemaining
              : sliding
                ? PLAYER_DIMENSIONS.slideMaxFlatDistance
                : state.slideDistanceRemaining,
        })),

      setMovementSpeedRatio: (ratio) =>
        set((state) => ({
          movementSpeedRatio: ratio,
          recoilBloom: Math.max(0, state.recoilBloom - 0.04),
          damageFlashAlpha: Math.max(0, state.damageFlashAlpha - 0.04),
        })),

      triggerHitmarker: (headshot) => {
        set({ hitmarkerActive: true, hitmarkerHeadshot: headshot });
        setTimeout(() => {
          set({ hitmarkerActive: false });
        }, 140);
      },

      applyPlayerDamage: (amount, attacker) => {
        const state = get();
        if (state.screen !== 'playing' || state.isEliminated) return;
        const nextHp = Math.max(0, state.hp - amount);
        if (nextHp <= 0) {
          const killerInfo: EliminatedByInfo = attacker || {
            name: 'mousepad killer',
            team: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
            hp: 100,
            maxHp: 100,
            weaponClass: 'assault',
          };
          set((s) => ({
            hp: 0,
            isEliminated: true,
            eliminatedBy: killerInfo,
            isAds: false,
            isSliding: false,
            isCrouching: false,
            ridingScooterId: null,
            localDeaths: s.localDeaths + 1,
            bravoScore: s.playerTeam === 'alpha' ? s.bravoScore + 1 : s.bravoScore,
            alphaScore: s.playerTeam === 'bravo' ? s.alphaScore + 1 : s.alphaScore,
            damageFlashAlpha: 0.75,
          }));
        } else {
          set({
            hp: nextHp,
            damageFlashAlpha: Math.min(0.65, state.damageFlashAlpha + 0.35),
          });
        }
      },

      applyPlayerStun: (durationMs) => {
        set({
          stunnedUntil: Date.now() + durationMs,
          isSliding: false,
          isAds: false,
        });
      },

      respawnPlayer: () => {
        const state = get();
        const stats = WEAPON_CLASSES[state.selectedClass];
        const safestSpawn = state.getSafestSpawnForTeam(state.playerTeam);
        set((s) => ({
          hp: stats.health,
          ammo: stats.maxAmmo,
          isReloading: false,
          isEliminated: false,
          eliminatedBy: null,
          isSliding: false,
          isCrouching: false,
          stunnedUntil: 0,
          damageFlashAlpha: 0,
          activeSpawnPoint: safestSpawn,
          respawnNonce: s.respawnNonce + 1,
        }));
      },

      tickMatchTimer: (dt) =>
        set((state) => {
          if (state.screen !== 'playing') return state;
          const nowMs = Date.now();
          const isTimerEnded = state.matchTimeRemaining - dt <= 0;
          const isScoreLimitReached = state.alphaScore >= 20 || state.bravoScore >= 20;
          const shouldGameOver = isTimerEnded || isScoreLimitReached;

          if (shouldGameOver) {
            syncBodyDataset('gameover');
            if (typeof document !== 'undefined' && document.pointerLockElement) {
              document.exitPointerLock?.();
            }
          }

          const nextMatchTime = isTimerEnded ? 300 : state.matchTimeRemaining - dt;
          const nextScreen: ScreenState = shouldGameOver ? 'gameover' : state.screen;

          // Passive slow health regeneration (1 HP per second up to maxHp while alive)
          let nextHp = state.hp;
          if (!state.isEliminated && state.hp > 0 && state.hp < state.maxHp) {
            nextHp = Math.min(state.maxHp, state.hp + dt * 1.0);
          }

          // 1. E-Scooter 20s Battery Countdown & Rarer Respawn (max MAX_ACTIVE_SCOOTERS = 2)
          let nextRidingId = state.ridingScooterId;
          let nextScooters = state.scooters;

          if (state.ridingScooterId) {
            nextScooters = state.scooters
              .map((sc) => {
                if (sc.id !== state.ridingScooterId) return sc;
                const nextBatt = sc.batteryRemainingSec - dt;
                return {
                  ...sc,
                  batteryRemainingSec: Math.max(0, nextBatt),
                };
              })
              .filter((sc) => {
                if (sc.id === state.ridingScooterId && sc.batteryRemainingSec <= 0) {
                  nextRidingId = null;
                  return false; // Expired after 20s!
                }
                return true;
              });
          }

          let nextScooterTimer = state.scooterSpawnTimerSec + dt;
          if (
            nextScooterTimer >= SCOOTER_RESPAWN_INTERVAL_SEC &&
            nextScooters.length < MAX_ACTIVE_SCOOTERS
          ) {
            nextScooterTimer = 0;
            const unusedSpawns = CAMPUS_SCOOTER_SPAWNS.filter(
              (sp) => !nextScooters.some((sc) => sc.id === sp.id)
            );
            if (unusedSpawns.length > 0) {
              const chosen =
                unusedSpawns[Math.floor(Math.random() * unusedSpawns.length)];
              nextScooters = [
                ...nextScooters,
                {
                  id: chosen.id,
                  label: chosen.label,
                  position: [...chosen.position] as [number, number, number],
                  rotationY: chosen.rotationY,
                  mountedByPlayerId: null,
                  batteryRemainingSec: SCOOTER_DURATION_SEC,
                },
              ];
            }
          }

          // 2. Step Thrown Vape Smoke Grenades & Spawn Smoke Clouds on Impact
          let nextThrownVapes = state.thrownVapes;
          let nextSmokeClouds = state.smokeClouds.filter((c) => nowMs < c.expiresAt);

          if (state.thrownVapes.length > 0) {
            const updatedProjectiles: ThrownVapeState[] = [];
            for (const proj of state.thrownVapes) {
              const stepped = stepThrownVapeProjectile(
                proj.position,
                proj.velocity,
                dt,
                proj.groundY
              );
              if (stepped.landed) {
                nextSmokeClouds = [
                  ...nextSmokeClouds,
                  {
                    id: `smoke_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
                    position: stepped.position,
                    createdAt: nowMs,
                    expiresAt: nowMs + VAPE_SMOKE_DURATION_MS,
                    radius: VAPE_SMOKE_RADIUS,
                  },
                ];
              } else {
                updatedProjectiles.push({
                  ...proj,
                  position: stepped.position,
                  velocity: stepped.velocity,
                });
              }
            }
            nextThrownVapes = updatedProjectiles;
          }

          // 3. Periodically Spawn Ground Pickups (Vapes max 5, Kong Strong max 5, Schoko-Croissants max 5)
          let nextPickupTimer = state.pickupSpawnTimerSec + dt;
          let nextPickups = state.mapPickups;
          if (nextPickupTimer >= 6.5) {
            nextPickupTimer = 0;
            const vapeOnMap = nextPickups.filter((p) => p.type === 'vape_smoke').length;
            const kongOnMap = nextPickups.filter((p) => p.type === 'kong_strong').length;
            const croissantOnMap = nextPickups.filter(
              (p) => p.type === 'choco_croissant'
            ).length;

            const candidateTypes: PickupItemType[] = [];
            if (vapeOnMap < MAX_MAP_VAPES) candidateTypes.push('vape_smoke');
            if (kongOnMap < MAX_MAP_KONG_STRONG) candidateTypes.push('kong_strong');
            if (croissantOnMap < MAX_MAP_CROISSANTS) candidateTypes.push('choco_croissant');

            if (candidateTypes.length > 0) {
              const freePoints = CAMPUS_PICKUP_SPAWN_POINTS.filter(
                (pt) =>
                  !nextPickups.some(
                    (existing) =>
                      Math.hypot(
                        existing.position[0] - pt[0],
                        existing.position[2] - pt[2]
                      ) < 1.5
                  )
              );
              if (freePoints.length > 0) {
                const chosenType =
                  candidateTypes[Math.floor(Math.random() * candidateTypes.length)];
                const chosenPt =
                  freePoints[Math.floor(Math.random() * freePoints.length)];
                nextPickups = [
                  ...nextPickups,
                  {
                    id: `pickup_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
                    type: chosenType,
                    position: [...chosenPt] as [number, number, number],
                    rotationY: Math.random() * Math.PI * 2,
                  },
                ];
              }
            }
          }

          const nextDamageIndicators = state.damageIndicators.filter(
            (d) => nowMs - d.createdAt < d.durationMs
          );

          return {
            hp: nextHp,
            screen: nextScreen,
            matchTimeRemaining: nextMatchTime,
            ridingScooterId: nextRidingId,
            scooters: nextScooters,
            scooterSpawnTimerSec: nextScooterTimer,
            thrownVapes: nextThrownVapes,
            smokeClouds: nextSmokeClouds,
            mapPickups: nextPickups,
            pickupSpawnTimerSec: nextPickupTimer,
            damageIndicators: nextDamageIndicators,
          };
        }),

      syncRemotePlayers: (players) =>
        set((state) => {
          const merged: Record<string, RemoteActor> = {};
          // Preserve bots only if in BOTS mode
          if (state.selectedModeId === 'BOTS') {
            Object.values(state.remotePlayers).forEach((p) => {
              if (p.isBot) merged[p.id] = p;
            });
          }
          Object.values(players).forEach((p, idx) => {
            if (p.id === state.playerId) return;
            const spawnFallback =
              state.spawnPoints[(idx + 1) % state.spawnPoints.length]?.position || [
                0, 0.1, 0,
              ];
            merged[p.id] = {
              ...p,
              weaponClass: (p.weaponClass as WeaponId) || 'assault',
              score: p.score ?? (p.kills || 0) * 150,
              ping: p.ping ?? 16,
              position: p.position || spawnFallback,
              targetPosition: p.position || spawnFallback,
              velocity: p.velocity || [0, 0, 0],
            };
          });
          return { remotePlayers: merged };
        }),

      updateRemoteTransform: (
        id,
        position,
        rotation,
        crouching,
        ads,
        weaponClass,
        velocity = [0, 0, 0],
        ridingScooter = false,
        playerName,
        team,
        sliding = false,
        meta
      ) =>
        set((state) => {
          if (id === state.playerId) return state;
          const existing = state.remotePlayers[id];
          const now = performance.now();
          const snap: TransformSnapshot = { position, velocity, rotation, timestamp: now };

          if (!existing) {
            return {
              remotePlayers: {
                ...state.remotePlayers,
                [id]: {
                  id,
                  name: playerName || `Player_${id.slice(0, 4)}`,
                  team: team || (state.playerTeam === 'alpha' ? 'bravo' : 'alpha'),
                  weaponClass,
                  ready: meta?.ready ?? true,
                  hp: meta?.hp ?? 100,
                  maxHp: meta?.maxHp ?? 100,
                  score: meta?.score ?? 0,
                  kills: meta?.kills ?? 0,
                  deaths: meta?.deaths ?? 0,
                  ping: 14,
                  position,
                  targetPosition: position,
                  velocity,
                  rotation,
                  crouching,
                  sliding,
                  ads,
                  ridingScooter,
                  snapshotBuffer: [snap],
                },
              },
            };
          }

          const nextBuffer = [...(existing.snapshotBuffer || []).slice(-8), snap];
          return {
            remotePlayers: {
              ...state.remotePlayers,
              [id]: {
                ...existing,
                name: playerName || existing.name,
                team: team || existing.team,
                targetPosition: position,
                velocity,
                rotation,
                crouching,
                sliding,
                ads,
                weaponClass,
                ridingScooter,
                ready: meta?.ready ?? existing.ready,
                hp: typeof meta?.hp === 'number' ? meta.hp : existing.hp,
                maxHp: typeof meta?.maxHp === 'number' ? meta.maxHp : existing.maxHp,
                kills: typeof meta?.kills === 'number' ? meta.kills : existing.kills,
                deaths: typeof meta?.deaths === 'number' ? meta.deaths : existing.deaths,
                score: typeof meta?.score === 'number' ? meta.score : existing.score,
                snapshotBuffer: nextBuffer,
              },
            },
          };
        }),

      removeRemotePlayer: (id) =>
        set((state) => {
          if (!state.remotePlayers[id]) return state;
          const next = { ...state.remotePlayers };
          delete next[id];
          return { remotePlayers: next };
        }),

      damageRemoteActor: (
        targetId,
        damage,
        isHeadshot,
        attackerName = 'Player_4',
        attackerTeam = 'alpha',
        weaponName = 'Assault Rifle',
        weaponId = 'assault'
      ) => {
        const state = get();
        const target = state.remotePlayers[targetId];
        if (!target) return { killed: false };

        const nextHp = Math.max(0, target.hp - damage);
        const killed = nextHp <= 0;

        // Pick a distinct unoccupied spawn point on respawn
        const otherPositions = Object.values(state.remotePlayers)
          .filter((p) => p.id !== targetId)
          .map((p) => p.position);
        const bestSpawn = selectSafestSpawnPoint(
          state.spawnPoints,
          otherPositions,
          otherPositions
        );

        const updatedTarget: RemoteActor = {
          ...target,
          hp: killed ? target.maxHp : nextHp,
          deaths: killed ? target.deaths + 1 : target.deaths,
          position: killed ? [...bestSpawn.position] : target.position,
          targetPosition: killed ? [...bestSpawn.position] : target.targetPosition,
          stunnedUntil: killed ? 0 : target.stunnedUntil,
          lastHitTime: Date.now(),
        };

        const feedItem: KillFeedItem | null = killed
          ? {
              id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              killer: attackerName,
              killerTeam: attackerTeam,
              victim: target.name,
              victimTeam: target.team,
              weapon: weaponName,
              weaponId,
              isHeadshot,
              timestamp: Date.now(),
            }
          : null;

        const isLocalAttacker = attackerName === state.playerName;

        set((s) => ({
          remotePlayers: {
            ...s.remotePlayers,
            [targetId]: updatedTarget,
          },
          localKills: killed && isLocalAttacker ? s.localKills + 1 : s.localKills,
          localScore: killed && isLocalAttacker ? s.localScore + 150 : s.localScore,
          alphaScore: killed && attackerTeam === 'alpha' ? s.alphaScore + 1 : s.alphaScore,
          bravoScore: killed && attackerTeam === 'bravo' ? s.bravoScore + 1 : s.bravoScore,
          killFeed: feedItem ? [feedItem, ...s.killFeed.slice(0, 4)] : s.killFeed,
        }));

        return { killed };
      },

      stunRemoteActor: (targetId, durationMs, attackerName = 'Player_4') => {
        const state = get();
        const target = state.remotePlayers[targetId];
        if (!target) return;
        const stunnedUntil = Date.now() + durationMs;
        set((s) => ({
          remotePlayers: {
            ...s.remotePlayers,
            [targetId]: {
              ...target,
              stunnedUntil,
              lastHitTime: Date.now(),
            },
          },
          chatMessages: [
            ...s.chatMessages.slice(-25),
            {
              id: `stun_${Date.now()}`,
              senderName: 'LIDL SCANNER',
              team: s.playerTeam,
              text: `${attackerName} hat ${target.name} für 10s eingescannt & ausgeknockt!`,
              timestamp: Date.now(),
            },
          ],
        }));
      },

      addChatMessage: (senderName, team, text) =>
        set((state) => ({
          chatMessages: [
            ...state.chatMessages.slice(-25),
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              senderName,
              team,
              text,
              timestamp: Date.now(),
            },
          ],
        })),

      setChatInputOpen: (open) => set({ chatInputOpen: open }),

      updateSettings: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),

      setGraphicsPreset: (preset) =>
        set((state) => ({
          settings: {
            ...state.settings,
            graphicsPreset: preset,
            antiAliasing: preset === 'ultra',
            resolution: preset === 'ultra' ? 1.0 : 0.85,
          },
        })),

      updateCrosshair: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            crosshair: {
              ...state.settings.crosshair,
              [key]: value,
            },
          },
        })),

      updateKeybind: (action, keyName) =>
        set((state) => ({
          settings: {
            ...state.settings,
            keybinds: {
              ...state.settings.keybinds,
              [action]: keyName.toUpperCase(),
            },
          },
        })),

      resetCrosshairDefaults: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            crosshair: DEFAULT_CROSSHAIR,
          },
        })),
    }),
    {
      name: 'deadshot_io_storage_v4',
      partialize: (state) => ({
        settings: state.settings,
        selectedClass: state.selectedClass,
      }),
    }
  )
);
