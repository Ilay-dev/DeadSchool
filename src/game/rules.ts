export type WeaponId =
  | 'smg'
  | 'assault'
  | 'sniper'
  | 'shotgun'
  | 'semi_sniper'
  | 'lidl_scanner'
  | 'fist';

export type HitZone = 'head' | 'body' | 'legs';

export interface WeaponStats {
  id: WeaponId;
  name: string;
  rangeLabel: 'Close' | 'Medium' | 'Long' | '4m Stun';
  maxRange: number; // maximum effective raycast range in meters
  ammo: number;
  maxAmmo: number;
  health: number;
  reloadTime: number; // in seconds
  fireRateMs: number;
  damage: number;
  stunDurationMs: number; // > 0 for Lidl Barcode Scanner (4,000ms = 4s)
  headshotMultiplier: number; // 1.5x standard, 2.0x sniper
  bodyMultiplier: number; // 1.0x
  legsMultiplier: number; // 0.75x
  recoilPitch: number;
  recoilYaw: number;
  recoilKickback: number;
  adsFov: number;
  spread: number;
  adsSpread: number;
  pellets: number;
  automatic: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const WEAPON_CLASSES: Record<WeaponId, WeaponStats> = {
  smg: {
    id: 'smg',
    name: 'SMG',
    rangeLabel: 'Close',
    maxRange: 35.0, // Max 35m range
    ammo: 40,
    maxAmmo: 40,
    health: 100,
    reloadTime: 1.5,
    fireRateMs: 78,
    damage: 19,
    stunDurationMs: 0,
    headshotMultiplier: 1.5,
    bodyMultiplier: 1.0,
    legsMultiplier: 0.75,
    recoilPitch: 0.012,
    recoilYaw: 0.006,
    recoilKickback: 0.028,
    adsFov: 68,
    spread: 0.022,
    adsSpread: 0.006,
    pellets: 1,
    automatic: true,
    primaryColor: '#e5e5e5',
    secondaryColor: '#22252a',
    accentColor: '#d4af37',
  },
  assault: {
    id: 'assault',
    name: 'Assault Rifle',
    rangeLabel: 'Medium',
    maxRange: 50.0, // Max 50m range
    ammo: 30,
    maxAmmo: 30,
    health: 100,
    reloadTime: 1.7,
    fireRateMs: 102,
    damage: 25,
    stunDurationMs: 0,
    headshotMultiplier: 1.5,
    bodyMultiplier: 1.0,
    legsMultiplier: 0.75,
    recoilPitch: 0.016,
    recoilYaw: 0.005,
    recoilKickback: 0.038,
    adsFov: 60,
    spread: 0.014,
    adsSpread: 0.0025,
    pellets: 1,
    automatic: true,
    primaryColor: '#1d2024',
    secondaryColor: '#2f343b',
    accentColor: '#111315',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Rifle',
    rangeLabel: 'Long',
    maxRange: 99999.0, // Infinite sniper range (no range limit)
    ammo: 3,
    maxAmmo: 3,
    health: 100,
    reloadTime: 2.03,
    fireRateMs: 1120,
    damage: 70, // 70 damage on body hit, instant 1-shot kill (154 dmg) on headshot
    stunDurationMs: 0,
    headshotMultiplier: 2.2, // 70 * 2.2 = 154 dmg -> kills any 100 HP player immediately
    bodyMultiplier: 1.0, // exactly 70 HP reduction
    legsMultiplier: 0.75, // 53 dmg
    recoilPitch: 0.055,
    recoilYaw: 0.008,
    recoilKickback: 0.075,
    adsFov: 20, // High-magnification sniper scope zoom
    spread: 0.032,
    adsSpread: 0.0001,
    pellets: 1,
    automatic: false,
    primaryColor: '#4d5c3b', // AWP Tactical Olive Drab Green (Image 2)
    secondaryColor: '#141619', // Matte Black Hardware & Scope
    accentColor: '#364227',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    rangeLabel: 'Close',
    maxRange: 45,
    ammo: 2,
    maxAmmo: 2,
    health: 100,
    reloadTime: 1.6,
    fireRateMs: 360,
    damage: 14,
    stunDurationMs: 0,
    headshotMultiplier: 1.5,
    bodyMultiplier: 1.0,
    legsMultiplier: 0.75,
    recoilPitch: 0.048,
    recoilYaw: 0.014,
    recoilKickback: 0.065,
    adsFov: 70,
    spread: 0.062,
    adsSpread: 0.038,
    pellets: 8,
    automatic: false,
    primaryColor: '#434b54',
    secondaryColor: '#7a4b2a',
    accentColor: '#272b30',
  },
  semi_sniper: {
    id: 'semi_sniper',
    name: 'Semi-Auto Sniper',
    rangeLabel: 'Long',
    maxRange: 190,
    ammo: 8,
    maxAmmo: 8,
    health: 100,
    reloadTime: 1.83,
    fireRateMs: 285,
    damage: 46,
    stunDurationMs: 0,
    headshotMultiplier: 2.0,
    bodyMultiplier: 1.0,
    legsMultiplier: 0.75,
    recoilPitch: 0.028,
    recoilYaw: 0.007,
    recoilKickback: 0.048,
    adsFov: 36,
    spread: 0.02,
    adsSpread: 0.0012,
    pellets: 1,
    automatic: false,
    primaryColor: '#b08f40',
    secondaryColor: '#1e2024',
    accentColor: '#8c6f2d',
  },
  lidl_scanner: {
    id: 'lidl_scanner',
    name: 'Lidl Scanner',
    rangeLabel: '4m Stun',
    maxRange: 4.0, // Maximum 4 meters range!
    ammo: 5,
    maxAmmo: 5,
    health: 100,
    reloadTime: 1.4,
    fireRateMs: 480,
    damage: 0, // 0 damage: Pure freeze stun gun, knocks out target without dealing damage!
    stunDurationMs: 4000, // Knocks out / stuns target for 4 seconds!
    headshotMultiplier: 1.0,
    bodyMultiplier: 1.0,
    legsMultiplier: 1.0,
    recoilPitch: 0.008,
    recoilYaw: 0.003,
    recoilKickback: 0.022,
    adsFov: 74,
    spread: 0.008,
    adsSpread: 0.002,
    pellets: 1,
    automatic: false,
    primaryColor: '#0050aa', // Lidl Blue
    secondaryColor: '#fff000', // Lidl Yellow
    accentColor: '#e60014', // Lidl Red
  },
  fist: {
    id: 'fist',
    name: 'Fäuste',
    rangeLabel: 'Close',
    maxRange: 1.8,
    ammo: 1,
    maxAmmo: 1,
    health: 100,
    reloadTime: 0.1,
    fireRateMs: 380,
    damage: 5,
    stunDurationMs: 0,
    headshotMultiplier: 1.2,
    bodyMultiplier: 1.0,
    legsMultiplier: 0.8,
    recoilPitch: 0.015,
    recoilYaw: 0.01,
    recoilKickback: 0.02,
    adsFov: 78,
    spread: 0.005,
    adsSpread: 0.005,
    pellets: 1,
    automatic: false,
    primaryColor: '#ef4444',
    secondaryColor: '#1f2937',
    accentColor: '#f97316',
  },
};

export const WEAPON_LIST: WeaponStats[] = [
  WEAPON_CLASSES.smg,
  WEAPON_CLASSES.assault,
  WEAPON_CLASSES.sniper,
  WEAPON_CLASSES.shotgun,
  WEAPON_CLASSES.semi_sniper,
  WEAPON_CLASSES.lidl_scanner,
];

// Player Physics, Capsule, Slide (Shift), E-Scooter & Pickup Constants
export const PLAYER_DIMENSIONS = {
  totalHeight: 1.8, // 1.80m total standing height
  capsuleRadius: 0.3, // 0.30m radius (smooth doorway & stair clearance)
  cylinderHeight: 1.2, // 1.2m cylinder + 2 * 0.3m hemispheres = 1.80m
  crouchTotalHeight: 0.9, // 0.90m crouched/sliding height
  crouchCylinderHeight: 0.3, // 0.3m cylinder + 2 * 0.3m hemispheres = 0.90m
  standingCameraOffsetFromCenter: 0.75, // +0.75m above capsule center -> 1.65m eye height
  standingEyeHeight: 1.65, // 0.90m center + 0.75m = 1.65m
  crouchingEyeHeight: 0.8, // 0.80m above ground when crouched/sliding
  walkSpeed: 7.5, // 7.5 m/s normal walk (no sprint)
  slideInitialSpeed: 11.4, // faster than walking during Shift-slide
  slideMaxFlatDistance: 6.0, // ~6 meters max slide on flat ground
  slideCooldownSec: 0.45, // brief cooldown after slide finishes
  scooterSpeed: 13.8, // E-Scooter riding speed
  scooterDurationSec: 20.0, // E-Scooter lasts 20 seconds before expiring
  kongStrongSpeedMultiplier: 1.4, // +40% speed for 10 seconds after picking up Kong Strong
  kongStrongDurationMs: 10000, // 10 seconds speed boost
  crouchSpeed: 3.8, // 3.8 m/s
  gravity: -22.0, // -22.0 m/s^2
  jumpHeight: 1.2, // 1.2m jump height
  jumpVelocity: Math.sqrt(2 * 22.0 * 1.2), // v = sqrt(2 * g * h) ≈ 7.266 m/s
  maxStepHeight: 0.4, // 0.40m step climbing height (stairs & curbs)
} as const;

/**
 * Enforces the E-Scooter firing rule:
 * You CANNOT shoot normal firearms from an E-Scooter, EXCEPT the Lidl Barcode Scanner (`lidl_scanner`),
 * which works while riding an E-Scooter!
 */
export function canFireWeaponOnScooter(
  weaponId: WeaponId,
  isRidingScooter: boolean
): boolean {
  if (!isRidingScooter) return true;
  return weaponId === 'lidl_scanner';
}

/**
 * Computes the remaining slide distance and current slide speed.
 * On flat or uphill ground, remaining slide distance decreases by horizontal distance traveled (stopping after 6m).
 * When sliding downhill / down stairs (verticalDelta < -0.012), gravity extends the slide so you can slide longer!
 */
export function computeSlideStep(
  remainingDistance: number,
  horizontalDistMoved: number,
  verticalDelta: number
): { nextRemainingDistance: number; speedMultiplier: number; shouldContinue: boolean } {
  const isDownhillOrStairs = verticalDelta < -0.012;
  const effectiveConsumption = isDownhillOrStairs
    ? Math.max(0.05, horizontalDistMoved * 0.18)
    : Math.max(0.02, horizontalDistMoved);

  const nextRemaining = Math.max(0, remainingDistance - effectiveConsumption);
  const progressRatio = nextRemaining / PLAYER_DIMENSIONS.slideMaxFlatDistance;
  const speedMultiplier = isDownhillOrStairs
    ? 1.18
    : 0.72 + 0.38 * Math.max(0, Math.min(1, progressRatio));

  return {
    nextRemainingDistance: nextRemaining,
    speedMultiplier,
    shouldContinue: nextRemaining > 0.05,
  };
}

/**
 * Ballistic trajectory step for a thrown Vape Smoke Grenade ([Q]).
 */
export function stepThrownVapeProjectile(
  position: [number, number, number],
  velocity: [number, number, number],
  dt: number,
  groundY = 0.16
): {
  position: [number, number, number];
  velocity: [number, number, number];
  landed: boolean;
} {
  const gravity = -18.0;
  const nextVx = velocity[0] * (1 - 0.15 * dt);
  const nextVy = velocity[1] + gravity * dt;
  const nextVz = velocity[2] * (1 - 0.15 * dt);

  const nextX = position[0] + nextVx * dt;
  const nextY = position[1] + nextVy * dt;
  const nextZ = position[2] + nextVz * dt;

  if (nextY <= groundY && nextVy <= 0) {
    return {
      position: [nextX, groundY, nextZ],
      velocity: [0, 0, 0],
      landed: true,
    };
  }

  return {
    position: [nextX, nextY, nextZ],
    velocity: [nextVx, nextVy, nextVz],
    landed: false,
  };
}

export interface MapScooterSpawn {
  id: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  isDominic?: boolean;
}

// E-Scooters are rarer on the map (max 2 regular active, plus exactly 1 Dominics E-Scooter)
export const MAX_MAP_SCOOTERS = 6;
export const MAX_ACTIVE_SCOOTERS = 2;
export const SCOOTER_DURATION_SEC = 20.0;
export const SCOOTER_RESPAWN_INTERVAL_SEC = 26.0;

// Dominics E-Scooter (Max 1 on map, 3x speed, 10s battery)
export const DOMINIC_SCOOTER_ID = 'scooter_dominic';
export const DOMINIC_SCOOTER_SPEED_MULTIPLIER = 3.0; // 3x normal scooter speed! (41.4 m/s)
export const DOMINIC_SCOOTER_DURATION_SEC = 10.0; // 10 seconds battery limit

export const CAMPUS_SCOOTER_SPAWNS: MapScooterSpawn[] = [
  {
    id: DOMINIC_SCOOTER_ID,
    label: "Dominics E-Scooter (3x Speed · 10s)",
    position: [-18.5, 0.15, -4.5],
    rotationY: 0.6,
    isDominic: true,
  },
  {
    id: 'scooter_1',
    label: 'Lidl Supermarkt Parkplatz',
    position: [-89.5, 0.15, -4.5],
    rotationY: 1.57,
  },
  {
    id: 'scooter_2',
    label: 'Fahrradständer Süd-Plaza',
    position: [13.5, 0.12, 14.5],
    rotationY: 0.4,
  },
  {
    id: 'scooter_3',
    label: 'Fahrradständer Altes Atrium',
    position: [-5.5, 0.12, 4.2],
    rotationY: -0.8,
  },
  {
    id: 'scooter_4',
    label: 'Fahrradständer Neue Schule',
    position: [-26.5, 0.2, -27.5],
    rotationY: -0.3,
  },
  {
    id: 'scooter_5',
    label: 'Fahrradständer Sporthalle',
    position: [66.0, 0.15, -7.5],
    rotationY: 1.57,
  },
];

// Ground Pickups: Vape Smoke Grenades (max 5), Kong Strong (max 5), Schoko-Croissants (max 5), Street Dart (max 5)
export type PickupItemType =
  | 'vape_smoke'
  | 'kong_strong'
  | 'choco_croissant'
  | 'street_dart';

export const MAX_MAP_VAPES = 5;
export const MAX_MAP_KONG_STRONG = 5;
export const MAX_MAP_CROISSANTS = 5;
export const MAX_MAP_STREET_DARTS = 5;
export const STREET_DART_DURATION_MS = 5000; // 5s psychedelic trip
export const STREET_DART_SMOKE_RADIUS = 3.0; // 3m pink smoke cloud radius
export const STREET_DART_SMOKE_DURATION_MS = 8000; // 8s smoke cloud duration
export const VAPE_SMOKE_RADIUS = 10.5; // Massive expanding smoke ball (covers wide plaza)
export const VAPE_SMOKE_DURATION_MS = 12000;

// Arthem NPC inside the school (spawns in school hallway / atrium)
export const ARTHEM_NPC_POSITION: [number, number, number] = [1.2, 0.15, -13.5];
export const ARTHEM_LETHAL_CHANCE = 0.20; // 20% chance of death, 80% street dart

// Justus NPC outdoors (half as tall as normal player, gives Vapes, 20% punches you!)
export const JUSTUS_NPC_POSITION: [number, number, number] = [-6.5, 0.15, 14.5];

// Lidl Kassierer NPC & Prison for Shoplifting
export const LIDL_KASSIERER_NPC_POSITION: [number, number, number] = [-98.0, 0.15, -6.0];
export const PRISON_CELL_POSITION: [number, number, number] = [-128.0, 0.15, 8.0];
export const PRISON_DURATION_SEC = 20.0;

// Hausmeister (Janitor) NPC outdoors on ground level
export const HAUSMEISTER_NPC_POSITION: [number, number, number] = [-14.5, 0.15, 8.5];
export const HAUSMEISTER_INTERACTION_COOLDOWN_SEC = 20.0; // 20s cooldown per player

export const MATCH_DURATION_OPTIONS = [60, 300, 600, 900] as const; // 1 Min, 5 Min, 10 Min, 15 Min

export const CAMPUS_PICKUP_SPAWN_POINTS: [number, number, number][] = [
  // Lidl Supermarket Sector (West)
  [-88.5, 0.18, -6.5],
  [-91.0, 0.18, 2.0],
  [-96.0, 0.18, 9.5],
  // Main Plaza & Old School Atrium
  [15.2, 0.15, 11.4],
  [8.4, 0.15, 16.2],
  [2.5, 0.15, 3.8],
  [-4.2, 0.15, -3.5],
  // Courtyard & New School Aula
  [-8.0, 0.15, -16.5],
  [5.5, 0.15, -21.0],
  [-22.0, 0.2, -24.5],
  [-30.5, 0.22, -18.0],
  // Skywalk, Sports Courts, BackBlocks & Turnhalle
  [-36.0, 4.15, -12.5],
  [18.0, 0.15, -62.0],
  [-22.0, 0.25, -78.0],
  [58.0, 0.18, -8.5],
  [70.5, 0.18, -11.0],
];

export interface SpawnPoint {
  name: string;
  position: [number, number, number];
  rotationY: number;
}

export const DEFAULT_CAMPUS_SPAWNS: SpawnPoint[] = [
  { name: 'Spawn_01_Main_Plaza_South', position: [18, 0.1, 18], rotationY: -Math.PI * 0.75 },
  { name: 'Spawn_02_OldSchool_Atrium_EG', position: [0, 0.1, 0], rotationY: 0 },
  { name: 'Spawn_03_Skywalk_Bridge_1Stock', position: [-38.5, 4.1, -15], rotationY: Math.PI * 0.5 },
  { name: 'Spawn_04_NewSchool_Aula_Pit', position: [-32.5, 0.2, -32], rotationY: Math.PI * 0.25 },
  { name: 'Spawn_05_BeerGarden_Courtyard', position: [0, 0.1, -25], rotationY: 0 },
  { name: 'Spawn_06_SportsCourts_East', position: [34, 0.1, -70], rotationY: -Math.PI * 0.5 },
  { name: 'Spawn_07_SportsHall_Turnhalle', position: [76, 0.15, -9], rotationY: -Math.PI * 0.5 },
  { name: 'Spawn_08_Overpass_Bridge', position: [-62, 3.8, 32], rotationY: Math.PI * 0.5 },
  { name: 'Spawn_09_Lidl_Supermarket', position: [-86, 0.15, -6], rotationY: -Math.PI * 0.5 },
];

/**
 * Fortnite-Style Downed (DBNO) & Revive Constants
 */
export const DOWNED_MAX_HP = 100;
export const REVIVE_DURATION_SEC = 5.0;
export const REVIVED_HP = 20;
export const RESPAWN_COOLDOWN_SEC = 5.0;

/**
 * Selects the safest / farthest spawn point from active enemies and avoids already occupied spawns
 * so every player/bot spawns at a distinct spawn point.
 */
export function selectSafestSpawnPoint(
  spawns: SpawnPoint[],
  enemyPositions: [number, number, number][],
  occupiedPositions: [number, number, number][] = []
): SpawnPoint {
  const pool = spawns.length > 0 ? spawns : DEFAULT_CAMPUS_SPAWNS;

  const unoccupiedPool = pool.filter((sp) => {
    for (const occ of occupiedPositions) {
      const dx = sp.position[0] - occ[0];
      const dz = sp.position[2] - occ[2];
      if (dx * dx + dz * dz < 20.25) {
        return false;
      }
    }
    return true;
  });

  const candidatePool = unoccupiedPool.length > 0 ? unoccupiedPool : pool;

  if (enemyPositions.length === 0) {
    return candidatePool[0];
  }

  let bestSpawn = candidatePool[0];
  let bestMinDistSq = -1;

  for (const sp of candidatePool) {
    let minEnemyDistSq = Infinity;
    for (const ep of enemyPositions) {
      const dx = sp.position[0] - ep[0];
      const dy = sp.position[1] - ep[1];
      const dz = sp.position[2] - ep[2];
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < minEnemyDistSq) {
        minEnemyDistSq = dSq;
      }
    }
    if (minEnemyDistSq > bestMinDistSq) {
      bestMinDistSq = minEnemyDistSq;
      bestSpawn = sp;
    }
  }

  return bestSpawn;
}

export function isDecorativeMeshExcludedFromCollider(nodeName: string): boolean {
  const lower = nodeName.toLowerCase();
  return (
    lower.startsWith('spawn_') ||
    lower.includes('trees_and_hedges') ||
    lower.includes('leaf') ||
    lower.includes('leaves') ||
    lower.includes('foliage') ||
    lower.includes('cable') ||
    lower.includes('wire') ||
    lower.includes('grass')
  );
}

export type GameModeId = 'TDM' | 'FFA' | 'BOTS';

export interface MapDefinition {
  id: string;
  name: string;
  subtitle: string;
  glbUrl: string;
  skyColor: string;
  fogColor: string;
  groundColor: string;
  wallColor: string;
  accentColor: string;
  alphaSpawn: [number, number, number];
  bravoSpawn: [number, number, number];
}

export const MAPS: MapDefinition[] = [
  {
    id: 'timber_campus',
    name: 'Timber Campus XL',
    subtitle: 'Full Campus & Lidl Arena',
    glbUrl: './assets/map.glb',
    skyColor: '#8cb4d8',
    fogColor: '#b8cfe6',
    groundColor: '#69727c',
    wallColor: '#b58d5e',
    accentColor: '#2b7fff',
    alphaSpawn: [18, 0.1, 18],
    bravoSpawn: [-86, 0.15, -6],
  },
  {
    id: 'tuscan',
    name: 'Lidl & Vorplatz',
    subtitle: 'Supermarkt & West-Sektor',
    glbUrl: './assets/map.glb',
    skyColor: '#7ca5d0',
    fogColor: '#adc6e2',
    groundColor: '#56606b',
    wallColor: '#0050aa',
    accentColor: '#fff000',
    alphaSpawn: [-86, 0.15, -6],
    bravoSpawn: [-32.5, 0.2, -32],
  },
  {
    id: 'factory',
    name: 'Skywalk & Bridge',
    subtitle: 'Upper Level Sector',
    glbUrl: './assets/map.glb',
    skyColor: '#7a9ec2',
    fogColor: '#a0bcd8',
    groundColor: '#373b42',
    wallColor: '#8d7b68',
    accentColor: '#c0392b',
    alphaSpawn: [-38.5, 4.1, -15],
    bravoSpawn: [-62, 3.8, 32],
  },
  {
    id: 'canyon',
    name: 'Turnhalle & Courts',
    subtitle: 'SportsHall & Ost-Sektor',
    glbUrl: './assets/map.glb',
    skyColor: '#8ab0d6',
    fogColor: '#b0cae3',
    groundColor: '#a8583b',
    wallColor: '#8c462d',
    accentColor: '#dc2626',
    alphaSpawn: [76, 0.15, -9],
    bravoSpawn: [34, 0.1, -70],
  },
];

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function checkSphereAABBCollision(
  x: number,
  y: number,
  z: number,
  radius: number,
  box: AABB
): { collided: boolean; pushX: number; pushZ: number } {
  if (y < box.minY || y > box.maxY) {
    return { collided: false, pushX: 0, pushZ: 0 };
  }
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));

  const dx = x - closestX;
  const dz = z - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq) || 0.0001;
    const overlap = radius - dist;
    return {
      collided: true,
      pushX: (dx / dist) * overlap,
      pushZ: (dz / dist) * overlap,
    };
  }
  return { collided: false, pushX: 0, pushZ: 0 };
}

export function resolveArenaCollisions(
  x: number,
  y: number,
  z: number,
  radius: number,
  colliders: AABB[],
  arenaHalfExtent = 225.0
): [number, number] {
  let nx = Math.max(-arenaHalfExtent, Math.min(arenaHalfExtent, x));
  let nz = Math.max(-arenaHalfExtent, Math.min(arenaHalfExtent, z));

  for (const box of colliders) {
    const res = checkSphereAABBCollision(nx, y, nz, radius, box);
    if (res.collided) {
      nx += res.pushX;
      nz += res.pushZ;
    }
  }
  return [nx, nz];
}

export function interpolateTransform(
  current: [number, number, number],
  target: [number, number, number],
  alpha: number
): [number, number, number] {
  const t = Math.max(0, Math.min(1, alpha));
  return [
    current[0] + (target[0] - current[0]) * t,
    current[1] + (target[1] - current[1]) * t,
    current[2] + (target[2] - current[2]) * t,
  ];
}

export function hermiteInterpolatePosition(
  p0: [number, number, number],
  v0: [number, number, number],
  p1: [number, number, number],
  v1: [number, number, number],
  tRaw: number,
  dtBuffer = 0.05
): [number, number, number] {
  const t = Math.max(0, Math.min(1, tRaw));
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return [
    h00 * p0[0] + h10 * v0[0] * dtBuffer + h01 * p1[0] + h11 * v1[0] * dtBuffer,
    h00 * p0[1] + h10 * v0[1] * dtBuffer + h01 * p1[1] + h11 * v1[1] * dtBuffer,
    h00 * p0[2] + h10 * v0[2] * dtBuffer + h01 * p1[2] + h11 * v1[2] * dtBuffer,
  ];
}

export function computeLissajousWeaponBob(
  phase: number,
  speedRatio: number,
  isAds: boolean
): { x: number; y: number } {
  const clampedRatio = Math.max(0, Math.min(1.2, speedRatio));
  const amp = (isAds ? 0.0018 : 0.0095) * clampedRatio;
  return {
    x: Math.sin(phase) * amp,
    y: Math.sin(phase * 2 + Math.PI / 2) * amp * 0.55,
  };
}

export function calculateHitDamage(
  weaponId: WeaponId,
  distance: number,
  hitZoneOrHeadshot: HitZone | boolean
): number {
  const stats = WEAPON_CLASSES[weaponId];
  if (stats.damage <= 0 || distance > stats.maxRange) {
    return 0;
  }

  const zone: HitZone =
    typeof hitZoneOrHeadshot === 'boolean'
      ? hitZoneOrHeadshot
        ? 'head'
        : 'body'
      : hitZoneOrHeadshot;

  let falloff = 1.0;
  if (stats.rangeLabel === 'Close') {
    if (distance > 14) falloff = Math.max(0.45, 1 - (distance - 14) * 0.022);
  } else if (stats.rangeLabel === 'Medium') {
    if (distance > 32) falloff = Math.max(0.65, 1 - (distance - 32) * 0.012);
  }

  const zoneMult =
    zone === 'head'
      ? stats.headshotMultiplier
      : zone === 'legs'
        ? stats.legsMultiplier
        : stats.bodyMultiplier;

  const raw = stats.damage * falloff * zoneMult;
  return Math.max(1, Math.round(raw));
}

export function clampPbrMaterialValues(roughness: number, metalness: number): {
  roughness: number;
  metalness: number;
} {
  return {
    roughness: Math.max(roughness ?? 0.5, 0.35),
    metalness: Math.min(metalness ?? 0.1, 0.8),
  };
}

export function hexToRgba(hex: string, alpha255: number): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, 'e');
  const r = parseInt(full.slice(0, 2), 16) || 238;
  const g = parseInt(full.slice(2, 4), 16) || 238;
  const b = parseInt(full.slice(4, 6), 16) || 238;
  const a = Math.max(0, Math.min(1, alpha255 / 255));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}
