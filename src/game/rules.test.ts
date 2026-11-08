import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundEngine } from './soundEngine';
import {
  WEAPON_CLASSES,
  PLAYER_DIMENSIONS,
  DEFAULT_CAMPUS_SPAWNS,
  CAMPUS_SCOOTER_SPAWNS,
  MAX_MAP_SCOOTERS,
  MAX_ACTIVE_SCOOTERS,
  SCOOTER_DURATION_SEC,
  MAX_MAP_VAPES,
  VAPE_SMOKE_RADIUS,
  MAX_MAP_CROISSANTS,
  MAX_MAP_KONG_STRONG,
  canFireWeaponOnScooter,
  stepThrownVapeProjectile,
  computeSlideStep,
  selectSafestSpawnPoint,
  isDecorativeMeshExcludedFromCollider,
  clampPbrMaterialValues,
  calculateHitDamage,
  resolveArenaCollisions,
  interpolateTransform,
  hermiteInterpolatePosition,
  computeLissajousWeaponBob,
  hexToRgba,
  type AABB,
  type SpawnPoint,
} from './rules';

test('WEAPON_CLASSES includes balanced firearms and Lidl Barcode Scanner (4m range, 10s stun)', () => {
  assert.equal(WEAPON_CLASSES.smg.ammo, 40);
  assert.equal(WEAPON_CLASSES.assault.ammo, 30);
  assert.equal(WEAPON_CLASSES.sniper.ammo, 3);
  assert.equal(WEAPON_CLASSES.shotgun.ammo, 2);
  assert.equal(WEAPON_CLASSES.semi_sniper.ammo, 8);

  assert.equal(WEAPON_CLASSES.lidl_scanner.maxRange, 4.0);
  assert.equal(WEAPON_CLASSES.lidl_scanner.stunDurationMs, 10000);
  assert.equal(WEAPON_CLASSES.lidl_scanner.damage, 0);
  assert.equal(calculateHitDamage('lidl_scanner', 3.5, 'body'), 0);
  assert.equal(calculateHitDamage('lidl_scanner', 4.5, 'body'), 0);
});

test('DEFAULT_CAMPUS_SPAWNS includes Spawn_09_Lidl_Supermarket and resolveArenaCollisions allows 225m XL map coordinates', () => {
  const lidlSpawn = DEFAULT_CAMPUS_SPAWNS.find(
    (s) => s.name === 'Spawn_09_Lidl_Supermarket'
  );
  assert.ok(lidlSpawn, 'Spawn_09_Lidl_Supermarket should exist');
  assert.equal(lidlSpawn.position[0], -86.0);
  assert.equal(lidlSpawn.position[2], -6.0);

  // Player/Bot at Lidl Supermarket (-115, 0.15, -6) must not be clamped to -78m
  const [rx, rz] = resolveArenaCollisions(-115, 1.0, -6, 0.45, []);
  assert.equal(rx, -115);
  assert.equal(rz, -6);
});

test('canFireWeaponOnScooter blocks normal firearms on E-Scooter but allows Lidl Barcode Scanner', () => {
  assert.equal(canFireWeaponOnScooter('assault', false), true);
  assert.equal(canFireWeaponOnScooter('sniper', false), true);

  // On E-Scooter: normal weapons blocked, Lidl Scanner allowed!
  assert.equal(canFireWeaponOnScooter('assault', true), false);
  assert.equal(canFireWeaponOnScooter('smg', true), false);
  assert.equal(canFireWeaponOnScooter('sniper', true), false);
  assert.equal(canFireWeaponOnScooter('shotgun', true), false);
  assert.equal(canFireWeaponOnScooter('semi_sniper', true), false);
  assert.equal(canFireWeaponOnScooter('lidl_scanner', true), true);
});

test('Item caps and E-Scooter 20s duration & rarity constants are enforced', () => {
  assert.equal(MAX_MAP_VAPES, 5);
  assert.equal(MAX_MAP_CROISSANTS, 5);
  assert.equal(MAX_MAP_KONG_STRONG, 5);
  assert.equal(SCOOTER_DURATION_SEC, 20.0);
  assert.equal(PLAYER_DIMENSIONS.scooterDurationSec, 20.0);
  assert.equal(PLAYER_DIMENSIONS.kongStrongDurationMs, 10000);
  assert.ok(PLAYER_DIMENSIONS.kongStrongSpeedMultiplier > 1.2);
  assert.ok(MAX_ACTIVE_SCOOTERS < MAX_MAP_SCOOTERS);
});

test('stepThrownVapeProjectile simulates ballistic arc and lands on ground to trigger smoke', () => {
  let pos: [number, number, number] = [0, 1.6, 0];
  let vel: [number, number, number] = [0, 4.5, -12];
  let landed = false;
  for (let i = 0; i < 60; i++) {
    const res = stepThrownVapeProjectile(pos, vel, 0.05, 0.16);
    pos = res.position;
    vel = res.velocity;
    if (res.landed) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.equal(pos[1], 0.16);
  assert.ok(pos[2] < -4.0);
});

test('PLAYER_DIMENSIONS & computeSlideStep enforce 6m flat slide and longer downhill stair slide', () => {
  assert.equal(PLAYER_DIMENSIONS.walkSpeed, 7.5);
  assert.ok(PLAYER_DIMENSIONS.slideInitialSpeed > PLAYER_DIMENSIONS.walkSpeed);
  assert.equal(PLAYER_DIMENSIONS.slideMaxFlatDistance, 6.0);

  const flatStep = computeSlideStep(6.0, 2.0, 0);
  assert.equal(flatStep.nextRemainingDistance, 4.0);
  assert.equal(flatStep.shouldContinue, true);

  const flatEnd = computeSlideStep(2.0, 2.0, 0);
  assert.equal(flatEnd.nextRemainingDistance, 0);
  assert.equal(flatEnd.shouldContinue, false);

  const stairStep = computeSlideStep(6.0, 2.0, -0.25);
  assert.ok(stairStep.nextRemainingDistance > 5.5);
  assert.equal(stairStep.shouldContinue, true);
});

test('CAMPUS_SCOOTER_SPAWNS defines 5 bike rack spawn locations', () => {
  assert.equal(CAMPUS_SCOOTER_SPAWNS.length, MAX_MAP_SCOOTERS);
});

test('selectSafestSpawnPoint picks distinct unoccupied spawn point furthest from active enemies', () => {
  const spawns: SpawnPoint[] = [
    { name: 'Spawn_01_Main_Plaza_South', position: [10, 0, 10], rotationY: 0 },
    { name: 'Spawn_02_OldSchool_Atrium_EG', position: [-50, 0, -50], rotationY: 1.5 },
    { name: 'Spawn_03_Skywalk_Bridge_1Stock', position: [100, 4, -60], rotationY: -1.5 },
  ];
  const enemies: [number, number, number][] = [[12, 0, 11]];
  const chosen = selectSafestSpawnPoint(spawns, enemies);
  assert.equal(chosen.name, 'Spawn_03_Skywalk_Bridge_1Stock');

  const occupied: [number, number, number][] = [[100, 4, -60]];
  const distinctChosen = selectSafestSpawnPoint(spawns, enemies, occupied);
  assert.equal(distinctChosen.name, 'Spawn_02_OldSchool_Atrium_EG');
});

test('isDecorativeMeshExcludedFromCollider excludes trees/hedges and Spawn_ nodes', () => {
  assert.equal(isDecorativeMeshExcludedFromCollider('Spawn_01_Main_Plaza_South'), true);
  assert.equal(isDecorativeMeshExcludedFromCollider('trees_and_hedges_04'), true);
  assert.equal(isDecorativeMeshExcludedFromCollider('Main_Building_Floor'), false);
});

test('clampPbrMaterialValues enforces roughness >= 0.35 and metalness <= 0.8', () => {
  const clamped = clampPbrMaterialValues(0.1, 0.95);
  assert.equal(clamped.roughness, 0.35);
  assert.equal(clamped.metalness, 0.8);
});

test('calculateHitDamage computes sniper instant 1-shot headshot, 70 body dmg, and 0 dmg for lidl scanner', () => {
  const sniperBody = calculateHitDamage('sniper', 20, 'body');
  const sniperHead = calculateHitDamage('sniper', 20, 'head');
  const sniperLegs = calculateHitDamage('sniper', 20, 'legs');
  assert.equal(sniperBody, 70);
  assert.ok(sniperHead >= 150); // Instant 1-shot kill!
  assert.equal(sniperLegs, 53);

  const lidlDmg = calculateHitDamage('lidl_scanner', 2, 'head');
  assert.equal(lidlDmg, 0); // 0 damage pure freeze!
});

test('resolveArenaCollisions pushes player out of walls and bounds', () => {
  const boxes: AABB[] = [
    { minX: -2, maxX: 2, minY: 0, maxY: 4, minZ: -2, maxZ: 2 },
  ];
  const [rx] = resolveArenaCollisions(2.2, 1.0, 0, 0.6, boxes, 25);
  assert.ok(rx >= 2.59);
});

test('interpolateTransform and hermiteInterpolatePosition smoothly interpolate network positions', () => {
  const mid = interpolateTransform([0, 0, 0], [10, 4, -6], 0.5);
  assert.deepEqual(mid, [5, 2, -3]);
  const hMid = hermiteInterpolatePosition([0, 0, 0], [2, 0, 0], [10, 0, 0], [2, 0, 0], 0.5, 0.05);
  assert.ok(hMid[0] > 4.5 && hMid[0] < 5.5);
});

test('computeLissajousWeaponBob produces bounded figure-8 bobbing offsets', () => {
  const hipBob = computeLissajousWeaponBob(Math.PI / 2, 1.0, false);
  const adsBob = computeLissajousWeaponBob(Math.PI / 2, 1.0, true);
  assert.ok(Math.abs(hipBob.x) > Math.abs(adsBob.x));
});

test('hexToRgba formats crosshair color and 0-255 alpha properly', () => {
  const rgba = hexToRgba('#EEEEEE', 178);
  assert.ok(rgba.startsWith('rgba(238, 238, 238,'));
});

test('SoundEngine exposes shot, slide, and damage audio synthesis', () => {
  assert.equal(typeof soundEngine.playShot, 'function');
  assert.equal(typeof soundEngine.playSlideSound, 'function');
  assert.equal(typeof soundEngine.playDamageTakenSound, 'function');
});

test('Vape naming and constants are valid', () => {
  assert.equal(MAX_MAP_VAPES, 5);
  assert.equal(VAPE_SMOKE_RADIUS, 10.5);
});

