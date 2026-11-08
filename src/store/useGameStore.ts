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
  DOWNED_MAX_HP,
  REVIVE_DURATION_SEC,
  REVIVED_HP,
  RESPAWN_COOLDOWN_SEC,
  DOMINIC_SCOOTER_ID,
  DOMINIC_SCOOTER_DURATION_SEC,
  DOMINIC_SCOOTER_SPEED_MULTIPLIER,
  MAX_MAP_STREET_DARTS,
  STREET_DART_DURATION_MS,
  STREET_DART_SMOKE_RADIUS,
  STREET_DART_SMOKE_DURATION_MS,
  ARTHEM_NPC_POSITION,
  ARTHEM_LETHAL_CHANCE,
  HAUSMEISTER_INTERACTION_COOLDOWN_SEC,
  canFireWeaponOnScooter,
  stepThrownVapeProjectile,
  selectSafestSpawnPoint,
  type WeaponId,
  type GameModeId,
  type SpawnPoint,
  type PickupItemType,
} from '../game/rules';
import { soundEngine } from '../game/soundEngine';

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
  isDowned?: boolean;
  downedHp?: number;
  ads: boolean;
  ridingScooter?: boolean;
  stunnedUntil?: number; // Timestamp until which actor is knocked out by Lidl Scanner
  soldierSkin?: string;
  weaponSkin?: string;
  isBot?: boolean;
  botArchetype?: 'rusher' | 'strafer' | 'anchor';
  waypointIndex?: number;
  lastHitTime?: number;
  lastUpdatePerfMs?: number;
  snapshotBuffer?: TransformSnapshot[];
}

export interface MapScooterState {
  id: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  mountedByPlayerId: string | null;
  passengerPlayerId?: string | null;
  passengerPlayerName?: string | null;
  batteryRemainingSec: number; // 20s ride duration (10s for Dominic's scooter)
  isDominic?: boolean;
}

export interface GroundPickupItem {
  id: string;
  type: PickupItemType; // 'vape_smoke' | 'kong_strong' | 'choco_croissant' | 'street_dart'
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
  setPlayerName: (name: string) => void;
  isLoggedIn: boolean;
  partySlots: (string | null)[];
  onlinePlayersCount: number;
  localScore: number;
  localKills: number;
  localDeaths: number;
  hasSpawnedInMatch: boolean;
  matchStartCountdownSec: number;
  matchDurationSec: number;
  setMatchDurationSec: (sec: number) => void;

  // Street Dart & Arthem NPC State
  streetDartCount: number;
  streetDartUntil: number;
  streetDartChargePower: number;
  streetDartTrajectoryPoints: [number, number, number][];
  setStreetDartCharge: (power: number, points: [number, number, number][]) => void;
  thrownStreetDarts: ThrownVapeState[];
  streetDartSmokeClouds: SmokeCloudState[];
  pickupStreetDartToInventory: (id: string) => boolean;
  throwStreetDart: (
    origin: [number, number, number],
    direction: [number, number, number],
    groundY?: number,
    force?: number
  ) => boolean;

  hasTalkedToArthemThisRound: boolean;
  isNearArthem: boolean;
  setIsNearArthem: (near: boolean) => void;
  interactWithArthem: () => { success: boolean; lethal: boolean };

  // Hausmeister NPC State
  isNearHausmeister: boolean;
  setIsNearHausmeister: (near: boolean) => void;
  hausmeisterLastInteractedAt: number;
  interactWithHausmeister: () => {
    success: boolean;
    outcome: 'croissant' | 'confiscated' | 'cooldown';
    message: string;
  };

  // Justus NPC State (Campus Smoking Corner)
  isNearJustus: boolean;
  setIsNearJustus: (near: boolean) => void;
  interactWithJustus: () => { success: boolean; punched: boolean; message: string };

  // Lidl Kassierer NPC & Prison State
  isNearLidlKassierer: boolean;
  setIsNearLidlKassierer: (near: boolean) => void;
  jailUntil: number;
  interactWithLidlKassierer: () => { success: boolean; arrested: boolean; message: string };

  // Secret Developer Cheats for Ilay-dev ([H] key)
  devCheatsActive: boolean;
  toggleDevCheats: () => void;

  // Vape Charge & Trajectory Arc State
  vapeChargePower: number;
  vapeTrajectoryPoints: [number, number, number][];
  setVapeCharge: (power: number, points: [number, number, number][]) => void;

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
  lobbyCountdownSec: number | null;
  setLobbyCountdown: (sec: number | null) => void;
  setMatchTimeRemaining: (sec: number) => void;

  // Map Parsed Spawns & Respawn Signal
  spawnPoints: SpawnPoint[];
  activeSpawnPoint: SpawnPoint;
  respawnNonce: number;

  // E-Scooters (rarer on map, max 2 active at once, 20s ride duration)
  scooters: MapScooterState[];
  ridingScooterId: string | null;
  ridingScooterRole: 'driver' | 'passenger' | null;
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
  damageVignetteAlpha: number;
  droneIntroTimer: number;

  // Fortnite-Style Downed (DBNO) & Revive State
  isDowned: boolean;
  downedHp: number;
  maxDownedHp: number;
  reviveProgress: number;
  isBeingRevived: boolean;
  revivingTeammateName: string | null;
  localRevivingTargetId: string | null;
  respawnCooldownSec: number;

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
    groundY?: number,
    force?: number
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

  // DBNO & Revive Actions
  startReviveTeammate: (targetId: string) => void;
  stepReviveProgress: (dt: number) => { completed: boolean; progress: number };
  completeReviveTeammate: () => void;
  completeReviveByTeammate: () => void;
  cancelReviveTeammate: () => void;
  setBeingRevived: (beingRevived: boolean, reviverId: string | null) => void;
  setRemotePlayerRevived: (targetId: string) => void;
  triggerDamageVignette: (amount?: number) => void;

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
      isDowned?: boolean;
      downedHp?: number;
      soldierSkin?: string;
      weaponSkin?: string;
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
  // Dominics E-Scooter (10s battery, 3x speed) + up to MAX_ACTIVE_SCOOTERS (2) regular scooters
  const dominicSpawn = CAMPUS_SCOOTER_SPAWNS.find((s) => s.isDominic) || CAMPUS_SCOOTER_SPAWNS[0];
  const regularSpawns = CAMPUS_SCOOTER_SPAWNS.filter((s) => !s.isDominic).slice(0, MAX_ACTIVE_SCOOTERS);

  return [
    {
      id: dominicSpawn.id,
      label: dominicSpawn.label,
      position: [...dominicSpawn.position] as [number, number, number],
      rotationY: dominicSpawn.rotationY,
      mountedByPlayerId: null,
      batteryRemainingSec: DOMINIC_SCOOTER_DURATION_SEC,
      isDominic: true,
    },
    ...regularSpawns.map((s) => ({
      id: s.id,
      label: s.label,
      position: [...s.position] as [number, number, number],
      rotationY: s.rotationY,
      mountedByPlayerId: null,
      batteryRemainingSec: SCOOTER_DURATION_SEC,
      isDominic: false,
    })),
  ];
}

function createInitialGroundPickups(): GroundPickupItem[] {
  const initialTypes: PickupItemType[] = [
    'vape_smoke',
    'kong_strong',
    'choco_croissant',
    'street_dart',
    'vape_smoke',
    'kong_strong',
    'choco_croissant',
    'street_dart',
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
      playerName:
        typeof window !== 'undefined' && localStorage.getItem('deadschool_player_name')
          ? localStorage.getItem('deadschool_player_name') || 'Player_1'
          : `Player_${Math.floor(100 + Math.random() * 899)}`,
      isLoggedIn: false,
      partySlots: [null, null, null],
      onlinePlayersCount: 443,
      localScore: 0,
      localKills: 0,
      localDeaths: 0,
      hasSpawnedInMatch: false,
      matchStartCountdownSec: 0,
      matchDurationSec: 300,
      setMatchDurationSec: (sec) => set({ matchDurationSec: sec, matchTimeRemaining: sec }),
      streetDartCount: 0,
      streetDartUntil: 0,
      streetDartChargePower: 0,
      streetDartTrajectoryPoints: [],
      setStreetDartCharge: (power, points) =>
        set({ streetDartChargePower: power, streetDartTrajectoryPoints: points }),
      thrownStreetDarts: [],
      streetDartSmokeClouds: [],
      hasTalkedToArthemThisRound: false,
      isNearArthem: false,
      setIsNearArthem: (near) => set({ isNearArthem: near }),

      isNearHausmeister: false,
      setIsNearHausmeister: (near) => set({ isNearHausmeister: near }),
      hausmeisterLastInteractedAt: 0,

      vapeChargePower: 0,
      vapeTrajectoryPoints: [],
      lobbyCountdownSec: null,

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
      ridingScooterRole: null,
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
      damageVignetteAlpha: 0,
      droneIntroTimer: 0,

      // Fortnite-Style Downed (DBNO) & Revive State
      isDowned: false,
      downedHp: 100,
      maxDownedHp: 100,
      reviveProgress: 0,
      isBeingRevived: false,
      revivingTeammateName: null,
      localRevivingTargetId: null,
      respawnCooldownSec: 0,

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

      setPlayerName: (name) => {
        const clean = name.trim().slice(0, 16) || 'Player_1';
        try {
          localStorage.setItem('deadschool_player_name', clean);
        } catch {}
        set({ playerName: clean });
      },

      setLobbyCountdown: (sec) => set({ lobbyCountdownSec: sec }),

      setMatchTimeRemaining: (sec) => set({ matchTimeRemaining: sec }),

      setVapeCharge: (power, points) =>
        set({ vapeChargePower: power, vapeTrajectoryPoints: points }),

      interactWithArthem: () => {
        const state = get();
        if (state.hasTalkedToArthemThisRound || state.isEliminated || state.isDowned) {
          return { success: false, lethal: false };
        }
        const isLethal = Math.random() < ARTHEM_LETHAL_CHANCE;
        if (isLethal) {
          state.applyPlayerDamage(999, {
            name: 'Arthem (Tödliche Dosis)',
            team: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
            hp: 100,
            maxHp: 100,
            weaponClass: 'assault',
          });
          set({
            hasTalkedToArthemThisRound: true,
          });
          return { success: false, lethal: true };
        }

        const now = Date.now();
        set({
          hasTalkedToArthemThisRound: true,
          streetDartUntil: now + STREET_DART_DURATION_MS,
        });
        return { success: true, lethal: false };
      },

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
          // Dismount current E-Scooter
          const role = state.ridingScooterRole || 'driver';
          const targetId = state.ridingScooterId;
          const updated = state.scooters.map((sc) => {
            if (sc.id !== targetId) return sc;
            if (role === 'passenger') {
              return {
                ...sc,
                passengerPlayerId: null,
                passengerPlayerName: null,
              };
            }
            return {
              ...sc,
              position: [playerPos[0], playerPos[1], playerPos[2]] as [
                number,
                number,
                number,
              ],
              rotationY: playerRotY,
              mountedByPlayerId: null,
            };
          });
          set({
            scooters: updated,
            ridingScooterId: null,
            ridingScooterRole: null,
          });
          return false;
        }

        // Find closest available E-Scooter within 2.8m that still has battery (> 0s)
        let closest: MapScooterState | null = null;
        let closestDist = 2.8;
        let asPassenger = false;

        for (const sc of state.scooters) {
          if (sc.batteryRemainingSec <= 0) continue;
          const dist = Math.hypot(
            sc.position[0] - playerPos[0],
            sc.position[2] - playerPos[2]
          );
          if (dist <= closestDist) {
            if (!sc.mountedByPlayerId) {
              closestDist = dist;
              closest = sc;
              asPassenger = false;
            } else if (!sc.passengerPlayerId && sc.mountedByPlayerId !== state.playerId) {
              closestDist = dist;
              closest = sc;
              asPassenger = true;
            }
          }
        }

        if (!closest) return false;

        const targetId = closest.id;
        set((s) => ({
          ridingScooterId: targetId,
          ridingScooterRole: asPassenger ? 'passenger' : 'driver',
          isCrouching: false,
          isSliding: false,
          isAds: false,
          scooters: s.scooters.map((sc) =>
            sc.id === targetId
              ? asPassenger
                ? {
                    ...sc,
                    passengerPlayerId: s.playerId,
                    passengerPlayerName: s.playerName,
                  }
                : { ...sc, mountedByPlayerId: s.playerId }
              : sc
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
        let nextStreetDartUntil = state.streetDartUntil;
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
            } else if (item.type === 'street_dart') {
              nextStreetDartUntil = Date.now() + STREET_DART_DURATION_MS;
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
            streetDartUntil: nextStreetDartUntil,
            hp: nextHp,
          });
        }

        return collectedTypes;
      },

      throwVapeSmokeGrenade: (origin, direction, groundY = 0.15, force = 14.5) => {
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

        const thrownSpeed = Math.max(8, Math.min(32, force));
        const upSpeed = Math.max(3.0, thrownSpeed * 0.28);

        const thrown: ThrownVapeState = {
          id: `vape_proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          position: [origin[0] + nx * 0.45, origin[1], origin[2] + nz * 0.45],
          velocity: [nx * thrownSpeed, ny * thrownSpeed + upSpeed, nz * thrownSpeed],
          groundY: Math.max(0.12, groundY),
        };

        set((s) => ({
          vapeCount: Math.max(0, s.vapeCount - 1),
          thrownVapes: [...s.thrownVapes, thrown],
        }));

        return true;
      },

      pickupStreetDartToInventory: (id) => {
        const state = get();
        const item = state.mapPickups.find(
          (p) => p.id === id && p.type === 'street_dart'
        );
        if (!item) return false;
        set((s) => ({
          mapPickups: s.mapPickups.filter((p) => p.id !== id),
          streetDartCount: Math.min(5, s.streetDartCount + 1),
        }));
        soundEngine.playPickupSound('street_dart');
        return true;
      },

      throwStreetDart: (origin, direction, groundY = 0.15, force = 14.5) => {
        const state = get();
        if (
          state.screen !== 'playing' ||
          state.isEliminated ||
          Date.now() < state.stunnedUntil ||
          state.streetDartCount <= 0
        ) {
          return false;
        }

        const dirLen = Math.hypot(direction[0], direction[1], direction[2]) || 1;
        const nx = direction[0] / dirLen;
        const ny = direction[1] / dirLen;
        const nz = direction[2] / dirLen;

        const thrownSpeed = Math.max(8, Math.min(32, force));
        const upSpeed = Math.max(3.0, thrownSpeed * 0.28);

        const thrown: ThrownVapeState = {
          id: `street_dart_proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          position: [origin[0] + nx * 0.45, origin[1], origin[2] + nz * 0.45],
          velocity: [nx * thrownSpeed, ny * thrownSpeed + upSpeed, nz * thrownSpeed],
          groundY: Math.max(0.12, groundY),
        };

        set((s) => ({
          streetDartCount: Math.max(0, s.streetDartCount - 1),
          thrownStreetDarts: [...s.thrownStreetDarts, thrown],
        }));

        return true;
      },

      interactWithHausmeister: () => {
        const state = get();
        const now = Date.now();
        const elapsedSec = (now - state.hausmeisterLastInteractedAt) / 1000;
        if (elapsedSec < HAUSMEISTER_INTERACTION_COOLDOWN_SEC) {
          const waitSec = Math.ceil(HAUSMEISTER_INTERACTION_COOLDOWN_SEC - elapsedSec);
          return {
            success: false,
            outcome: 'cooldown' as const,
            message: `Hausmeister wischt gerade den Boden! Warte noch ${waitSec}s.`,
          };
        }

        const isConfiscate = Math.random() < 0.20; // 20% confiscate weapon
        if (isConfiscate) {
          set({
            hausmeisterLastInteractedAt: now,
            selectedClass: 'fist',
            ammo: 1,
            maxAmmo: 1,
            isReloading: false,
          });
          return {
            success: true,
            outcome: 'confiscated' as const,
            message: '⚠️ Der Hausmeister hat deine Waffe konfisziert! "Keine Waffen auf dem Schulhof!" Du kämpfst jetzt mit Fäusten!',
          };
        }

        // 80% give Schoko-Croissant (+35 HP)
        const nextHp = Math.min(100, state.hp + 35);
        set({
          hausmeisterLastInteractedAt: now,
          hp: nextHp,
        });
        soundEngine.playPickupSound('choco_croissant');
        return {
          success: true,
          outcome: 'croissant' as const,
          message: '🥐 Der Hausmeister schenkt dir ein frisches Schoko-Croissant! (+35 HP)',
        };
      },

      isNearJustus: false,
      setIsNearJustus: (near) => set({ isNearJustus: near }),
      interactWithJustus: () => {
        const state = get();
        if (state.screen !== 'playing' || state.isEliminated || state.isDowned) {
          return { success: false, punched: false, message: '' };
        }
        const isAggressive = Math.random() < 0.20; // 20% chance Justus punches you!
        if (isAggressive) {
          state.applyPlayerDamage(20, {
            name: 'Justus (Faustschlag)',
            team: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
            hp: 100,
            maxHp: 100,
            weaponClass: 'fist',
          });
          return {
            success: false,
            punched: true,
            message: 'Justus wurde aggressiv und hat dir eine verpasst! (-20 HP)',
          };
        }
        // 80% gives Vape (+1 Vape up to max 5)
        const nextVapes = Math.min(5, state.vapeCount + 1);
        set({ vapeCount: nextVapes });
        soundEngine.playPickupSound('vape_smoke');
        return {
          success: true,
          punched: false,
          message: 'Justus hat dir eine Vape gegeben! (Q gedrückt halten zum Werfen)',
        };
      },

      isNearLidlKassierer: false,
      setIsNearLidlKassierer: (near) => set({ isNearLidlKassierer: near }),
      jailUntil: 0,
      interactWithLidlKassierer: () => {
        const state = get();
        if (state.screen !== 'playing' || state.isEliminated || state.isDowned) {
          return { success: false, arrested: false, message: '' };
        }
        if (state.jailUntil > Date.now()) {
          const remSec = Math.ceil((state.jailUntil - Date.now()) / 1000);
          return {
            success: false,
            arrested: true,
            message: `Du sitzt noch für ${remSec}s im Gefängnis wegen Ladendiebstahl!`,
          };
        }
        const isCaught = Math.random() < 0.20; // 20% caught shoplifting -> 20s prison!
        if (isCaught) {
          const jailExpiry = Date.now() + 20000;
          set({
            jailUntil: jailExpiry,
            ridingScooterId: null,
          });
          return {
            success: false,
            arrested: true,
            message: '🚨 LADENDIEBSTAHL! Du wurdest erwischt und für 20 Sekunden inhaftiert!',
          };
        }
        // 80% gives Kong Strong (+10s speed boost)
        set({
          kongStrongUntil: Math.max(state.kongStrongUntil, Date.now() + 10000),
        });
        soundEngine.playPickupSound('kong_strong');
        return {
          success: true,
          arrested: false,
          message: '🥤 Kong Strong an der Kasse ergattert! (+10s Speed-Boost)',
        };
      },

      devCheatsActive: false,
      toggleDevCheats: () =>
        set((s) => {
          if (s.playerName.trim().toLowerCase() !== 'ilay-dev') {
            return { devCheatsActive: false };
          }
          return { devCheatsActive: !s.devCheatsActive };
        }),

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
          state.hasSpawnedInMatch &&
          !state.isEliminated &&
          !state.isDowned &&
          (state.screen === 'playing' ||
            state.screen === 'paused' ||
            state.screen === 'select_class');

        if (wasAliveInMatch) {
          // Keep current position - DO NOT RESPAWN / DO NOT TELEPORT!
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
          isDowned: false,
          downedHp: DOWNED_MAX_HP,
          maxDownedHp: DOWNED_MAX_HP,
          respawnCooldownSec: 0,
          matchStartCountdownSec: 0,
          hasSpawnedInMatch: true,
          droneIntroTimer: 0,
          hasTalkedToArthemThisRound: false,
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
        if (state.isEliminated || state.isDowned || Date.now() < state.stunnedUntil) return false;
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
          isAds: state.isReloading || state.isEliminated || state.isDowned ? false : ads,
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

        // Clean up scooter mount so E-Scooter is NEVER permanently locked!
        let nextScooters = state.scooters;
        if (state.ridingScooterId) {
          nextScooters = state.scooters.map((sc) =>
            sc.id === state.ridingScooterId ? { ...sc, mountedByPlayerId: null } : sc
          );
        }

        // If player is already downed (DBNO), damage applies directly to downedHp
        if (state.isDowned) {
          const nextDownedHp = Math.max(0, state.downedHp - amount);
          if (nextDownedHp <= 0) {
            const killerInfo: EliminatedByInfo = attacker || {
              name: 'Gegner',
              team: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
              hp: 100,
              maxHp: 100,
              weaponClass: 'assault',
            };
            set((s) => ({
              isEliminated: true,
              isDowned: false,
              downedHp: 0,
              vapeCount: 0,
              streetDartCount: 0,
              eliminatedBy: killerInfo,
              respawnCooldownSec: RESPAWN_COOLDOWN_SEC,
              localDeaths: s.localDeaths + 1,
              bravoScore: s.playerTeam === 'alpha' ? s.bravoScore + 1 : s.bravoScore,
              alphaScore: s.playerTeam === 'bravo' ? s.alphaScore + 1 : s.alphaScore,
              damageFlashAlpha: 0.8,
              damageVignetteAlpha: 0.9,
              ridingScooterId: null,
              scooters: nextScooters,
              isBeingRevived: false,
              revivingTeammateName: null,
              localRevivingTargetId: null,
            }));
          } else {
            set({
              downedHp: nextDownedHp,
              damageVignetteAlpha: Math.min(1.0, state.damageVignetteAlpha + 0.4),
              damageFlashAlpha: 0.5,
            });
          }
          return;
        }

        const nextHp = Math.max(0, state.hp - amount);
        if (nextHp <= 0) {
          const killerInfo: EliminatedByInfo = attacker || {
            name: 'Gegner',
            team: state.playerTeam === 'alpha' ? 'bravo' : 'alpha',
            hp: 100,
            maxHp: 100,
            weaponClass: 'assault',
          };

          // Fortnite-style DBNO: in team modes (TDM/BOTS), player is knocked down (crawling, 100 Downed HP)
          const isTeamMode = state.selectedModeId !== 'FFA';
          if (isTeamMode) {
            set((s) => ({
              hp: 0,
              isDowned: true,
              downedHp: DOWNED_MAX_HP,
              maxDownedHp: DOWNED_MAX_HP,
              isAds: false,
              isSliding: false,
              isCrouching: true,
              ridingScooterId: null,
              scooters: nextScooters,
              damageVignetteAlpha: 0.9,
              damageFlashAlpha: 0.8,
              eliminatedBy: killerInfo,
            }));
          } else {
            // FFA: direct elimination with 5-second respawn cooldown
            set((s) => ({
              hp: 0,
              isEliminated: true,
              isDowned: false,
              vapeCount: 0,
              streetDartCount: 0,
              respawnCooldownSec: RESPAWN_COOLDOWN_SEC,
              eliminatedBy: killerInfo,
              isAds: false,
              isSliding: false,
              isCrouching: false,
              ridingScooterId: null,
              scooters: nextScooters,
              localDeaths: s.localDeaths + 1,
              bravoScore: s.playerTeam === 'alpha' ? s.bravoScore + 1 : s.bravoScore,
              alphaScore: s.playerTeam === 'bravo' ? s.alphaScore + 1 : s.alphaScore,
              damageFlashAlpha: 0.75,
              damageVignetteAlpha: 0.9,
            }));
          }
        } else {
          set({
            hp: nextHp,
            damageFlashAlpha: Math.min(0.65, state.damageFlashAlpha + 0.35),
            damageVignetteAlpha: Math.min(0.85, state.damageVignetteAlpha + 0.4),
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
          isDowned: false,
          downedHp: DOWNED_MAX_HP,
          eliminatedBy: null,
          isSliding: false,
          isCrouching: false,
          stunnedUntil: 0,
          damageFlashAlpha: 0,
          damageVignetteAlpha: 0,
          respawnCooldownSec: 0,
          matchStartCountdownSec: 0,
          hasTalkedToArthemThisRound: false,
          vapeCount: 0,
          streetDartCount: 0,
          droneIntroTimer: 0,
          activeSpawnPoint: safestSpawn,
          respawnNonce: s.respawnNonce + 1,
        }));
      },

      startReviveTeammate: (targetId) => {
        set({ localRevivingTargetId: targetId, reviveProgress: 0 });
      },

      stepReviveProgress: (dt) => {
        const state = get();
        if (!state.localRevivingTargetId) return { completed: false, progress: 0 };
        const nextProgress = Math.min(1.0, state.reviveProgress + dt / REVIVE_DURATION_SEC);
        if (nextProgress >= 1.0) {
          get().completeReviveTeammate();
          return { completed: true, progress: 1.0 };
        }
        set({ reviveProgress: nextProgress });
        return { completed: false, progress: nextProgress };
      },

      completeReviveTeammate: () => {
        const state = get();
        const targetId = state.localRevivingTargetId;
        if (!targetId) return;
        const target = state.remotePlayers[targetId];
        if (target) {
          set((s) => ({
            localRevivingTargetId: null,
            reviveProgress: 0,
            remotePlayers: {
              ...s.remotePlayers,
              [targetId]: {
                ...target,
                hp: REVIVED_HP,
                isDowned: false,
                downedHp: DOWNED_MAX_HP,
              },
            },
          }));
        } else {
          set({ localRevivingTargetId: null, reviveProgress: 0 });
        }
      },

      completeReviveByTeammate: () => {
        set({
          hp: REVIVED_HP,
          isDowned: false,
          downedHp: DOWNED_MAX_HP,
          isBeingRevived: false,
          revivingTeammateName: null,
          damageVignetteAlpha: 0.3,
        });
      },

      cancelReviveTeammate: () => {
        set({ localRevivingTargetId: null, reviveProgress: 0 });
      },

      setBeingRevived: (beingRevived, reviverId) => {
        const state = get();
        const reviver = reviverId ? state.remotePlayers[reviverId] : null;
        set({
          isBeingRevived: beingRevived,
          revivingTeammateName: reviver ? reviver.name : 'Teammate',
        });
      },

      setRemotePlayerRevived: (targetId) => {
        const state = get();
        const target = state.remotePlayers[targetId];
        if (!target) return;
        set((s) => ({
          remotePlayers: {
            ...s.remotePlayers,
            [targetId]: {
              ...target,
              hp: REVIVED_HP,
              isDowned: false,
              downedHp: DOWNED_MAX_HP,
            },
          },
        }));
      },

      triggerDamageVignette: (amount = 0.5) => {
        set((s) => ({
          damageVignetteAlpha: Math.min(1.0, s.damageVignetteAlpha + amount),
        }));
      },

      tickMatchTimer: (dt) =>
        set((state) => {
          if (state.screen !== 'playing') return state;
          const nowMs = Date.now();
          const isTimerEnded = state.matchTimeRemaining - dt <= 0;
          const shouldGameOver = isTimerEnded;

          if (shouldGameOver) {
            syncBodyDataset('gameover');
            if (typeof document !== 'undefined' && document.pointerLockElement) {
              document.exitPointerLock?.();
            }
          }

          const nextMatchTime = isTimerEnded ? 300 : state.matchTimeRemaining - dt;
          const nextScreen: ScreenState = shouldGameOver ? 'gameover' : state.screen;

          // Passive slow health regeneration (1 HP per second up to maxHp while alive and not downed)
          let nextHp = state.hp;
          if (!state.isEliminated && !state.isDowned && state.hp > 0 && state.hp < state.maxHp) {
            nextHp = Math.min(state.maxHp, state.hp + dt * 1.0);
          }

          // Match start 5-second countdown
          const nextMatchStartCountdown = Math.max(0, state.matchStartCountdownSec - dt);

          // Drone camera drop intro timer
          const nextDroneTimer = 0;

          // Damage vignette alpha fade
          const nextVignetteAlpha = Math.max(0, state.damageVignetteAlpha - dt * 0.9);

          // Respawn cooldown countdown
          let nextRespawnCooldown = state.respawnCooldownSec;
          if (state.isEliminated && nextRespawnCooldown > 0) {
            nextRespawnCooldown = Math.max(0, nextRespawnCooldown - dt);
            if (nextRespawnCooldown === 0) {
              setTimeout(() => {
                get().respawnPlayer();
              }, 0);
            }
          }

          // Downed bleedout (bleed out 2.0 HP/s, slower if being revived)
          let nextDownedHp = state.downedHp;
          let nextIsDowned = state.isDowned;
          let nextIsEliminated = state.isEliminated;
          if (state.isDowned && !state.isEliminated) {
            const bleedRate = state.isBeingRevived ? 0.5 : 2.0;
            nextDownedHp = Math.max(0, state.downedHp - dt * bleedRate);
            if (nextDownedHp <= 0) {
              nextIsDowned = false;
              nextIsEliminated = true;
              nextRespawnCooldown = RESPAWN_COOLDOWN_SEC;
            }
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
              // Prioritize Dominics E-Scooter if not currently on map!
              const dominicUnused = unusedSpawns.find((sp) => sp.isDominic);
              const chosen = dominicUnused || unusedSpawns[Math.floor(Math.random() * unusedSpawns.length)];
              nextScooters = [
                ...nextScooters,
                {
                  id: chosen.id,
                  label: chosen.label,
                  position: [...chosen.position] as [number, number, number],
                  rotationY: chosen.rotationY,
                  mountedByPlayerId: null,
                  batteryRemainingSec: chosen.isDominic ? DOMINIC_SCOOTER_DURATION_SEC : SCOOTER_DURATION_SEC,
                  isDominic: chosen.isDominic,
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

          // Step Thrown Street Darts & Spawn 3m Pink Smoke Clouds on Impact
          let nextThrownStreetDarts = state.thrownStreetDarts;
          let nextDartSmokeClouds = state.streetDartSmokeClouds.filter(
            (c) => nowMs < c.expiresAt
          );

          if (state.thrownStreetDarts.length > 0) {
            const updatedDartProj: ThrownVapeState[] = [];
            for (const proj of state.thrownStreetDarts) {
              const stepped = stepThrownVapeProjectile(
                proj.position,
                proj.velocity,
                dt,
                proj.groundY
              );
              if (stepped.landed) {
                nextDartSmokeClouds = [
                  ...nextDartSmokeClouds,
                  {
                    id: `dart_smoke_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
                    position: stepped.position,
                    createdAt: nowMs,
                    expiresAt: nowMs + STREET_DART_SMOKE_DURATION_MS,
                    radius: STREET_DART_SMOKE_RADIUS,
                  },
                ];
              } else {
                updatedDartProj.push({
                  ...proj,
                  position: stepped.position,
                  velocity: stepped.velocity,
                });
              }
            }
            nextThrownStreetDarts = updatedDartProj;
          }

          // 3. Periodically Spawn Ground Pickups (Vapes max 5, Kong Strong max 5, Schoko-Croissants max 5, Street Darts max 5)
          let nextPickupTimer = state.pickupSpawnTimerSec + dt;
          let nextPickups = state.mapPickups;
          if (nextPickupTimer >= 6.5) {
            nextPickupTimer = 0;
            const vapeOnMap = nextPickups.filter((p) => p.type === 'vape_smoke').length;
            const kongOnMap = nextPickups.filter((p) => p.type === 'kong_strong').length;
            const croissantOnMap = nextPickups.filter(
              (p) => p.type === 'choco_croissant'
            ).length;
            const dartOnMap = nextPickups.filter((p) => p.type === 'street_dart').length;

            const candidateTypes: PickupItemType[] = [];
            if (vapeOnMap < MAX_MAP_VAPES) candidateTypes.push('vape_smoke');
            if (kongOnMap < MAX_MAP_KONG_STRONG) candidateTypes.push('kong_strong');
            if (croissantOnMap < MAX_MAP_CROISSANTS) candidateTypes.push('choco_croissant');
            if (dartOnMap < MAX_MAP_STREET_DARTS) candidateTypes.push('street_dart');

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
            thrownStreetDarts: nextThrownStreetDarts,
            streetDartSmokeClouds: nextDartSmokeClouds,
            mapPickups: nextPickups,
            pickupSpawnTimerSec: nextPickupTimer,
            damageIndicators: nextDamageIndicators,
            droneIntroTimer: nextDroneTimer,
            matchStartCountdownSec: nextMatchStartCountdown,
            damageVignetteAlpha: nextVignetteAlpha,
            respawnCooldownSec: nextRespawnCooldown,
            isDowned: nextIsDowned,
            downedHp: nextDownedHp,
            isEliminated: nextIsEliminated,
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
                  soldierSkin: meta?.soldierSkin || 'default',
                  weaponSkin: meta?.weaponSkin || 'default',
                  ready: meta?.ready ?? true,
                  hp: meta?.hp ?? 100,
                  maxHp: meta?.maxHp ?? 100,
                  score: meta?.score ?? 0,
                  kills: meta?.kills ?? 0,
                  deaths: meta?.deaths ?? 0,
                  ping: 14,
                  position: [...position] as [number, number, number],
                  targetPosition: [...position] as [number, number, number],
                  velocity: [...velocity] as [number, number, number],
                  rotation: [...rotation] as [number, number],
                  crouching,
                  sliding,
                  ads,
                  ridingScooter,
                  isDowned: Boolean(meta?.isDowned),
                  downedHp: typeof meta?.downedHp === 'number' ? meta.downedHp : 100,
                  lastUpdatePerfMs: now,
                  snapshotBuffer: [snap],
                },
              },
            };
          }

          const nextName = playerName || existing.name;
          const nextTeam = team || existing.team;
          const nextWeaponClass = weaponClass || existing.weaponClass;
          const nextReady = meta?.ready ?? existing.ready;
          const nextHp = typeof meta?.hp === 'number' ? meta.hp : existing.hp;
          const nextMaxHp = typeof meta?.maxHp === 'number' ? meta.maxHp : existing.maxHp;
          const nextKills = typeof meta?.kills === 'number' ? meta.kills : existing.kills;
          const nextDeaths = typeof meta?.deaths === 'number' ? meta.deaths : existing.deaths;
          const nextScore = typeof meta?.score === 'number' ? meta.score : existing.score;
          const nextIsDowned = Boolean(meta?.isDowned);
          const nextDownedHp =
            typeof meta?.downedHp === 'number' ? meta.downedHp : existing.downedHp ?? 100;

          // Mutate high-frequency 60Hz transform fields in-place so useFrame reads them immediately
          // without forcing React to re-render the entire 3D scene tree 60 times a second!
          existing.targetPosition = position;
          existing.velocity = velocity;
          existing.rotation = rotation;
          existing.crouching = crouching;
          existing.sliding = sliding;
          existing.ads = ads;
          existing.weaponClass = nextWeaponClass;
          if (meta?.soldierSkin) existing.soldierSkin = meta.soldierSkin;
          if (meta?.weaponSkin) existing.weaponSkin = meta.weaponSkin;
          existing.ridingScooter = ridingScooter;
          existing.isDowned = nextIsDowned;
          existing.downedHp = nextDownedHp;
          existing.lastUpdatePerfMs = now;
          if (!existing.snapshotBuffer) {
            existing.snapshotBuffer = [snap];
          } else {
            existing.snapshotBuffer.push(snap);
            if (existing.snapshotBuffer.length > 10) {
              existing.snapshotBuffer.shift();
            }
          }

          // Only trigger a React state re-render if UI/HUD metadata actually changed
          const metadataChanged =
            existing.name !== nextName ||
            existing.team !== nextTeam ||
            existing.weaponClass !== nextWeaponClass ||
            existing.ready !== nextReady ||
            existing.isDowned !== nextIsDowned ||
            Math.round(existing.downedHp ?? 100) !== Math.round(nextDownedHp) ||
            Math.round(existing.hp) !== Math.round(nextHp) ||
            existing.maxHp !== nextMaxHp ||
            existing.kills !== nextKills ||
            existing.deaths !== nextDeaths ||
            existing.score !== nextScore;

          if (!metadataChanged) {
            return state;
          }

          existing.name = nextName;
          existing.team = nextTeam;
          existing.weaponClass = nextWeaponClass;
          existing.ready = nextReady;
          existing.hp = nextHp;
          existing.maxHp = nextMaxHp;
          existing.kills = nextKills;
          existing.deaths = nextDeaths;
          existing.score = nextScore;
          existing.isDowned = nextIsDowned;
          existing.downedHp = nextDownedHp;

          return {
            remotePlayers: {
              ...state.remotePlayers,
              [id]: { ...existing },
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
