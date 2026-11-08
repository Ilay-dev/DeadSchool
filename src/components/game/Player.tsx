import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import {
  PLAYER_DIMENSIONS,
  WEAPON_CLASSES,
  calculateHitDamage,
  canFireWeaponOnScooter,
  computeSlideStep,
  DOMINIC_SCOOTER_SPEED_MULTIPLIER,
  ARTHEM_NPC_POSITION,
  type AABB,
  type HitZone,
} from '../../game/rules';
import { FirstPersonWeapon } from './Weapon';
import { soundEngine } from '../../game/soundEngine';
import { multiplayerManager } from '../../network/LocalMultiplayer';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _normalMatrix = new THREE.Matrix3();
const _worldNormal = new THREE.Vector3();

export interface BulletTracer {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  createdAt: number;
  durationMs: number;
  color: string;
}

export interface BulletHoleDecalData {
  id: string;
  position: [number, number, number];
  normal: [number, number, number];
  createdAt: number;
}

export function PlayerController({
  onSpawnTracer,
  onSpawnBulletHole,
}: {
  arenaColliders?: AABB[];
  onSpawnTracer: (
    start: [number, number, number],
    end: [number, number, number],
    color?: string
  ) => void;
  onSpawnBulletHole?: (
    position: [number, number, number],
    normal: [number, number, number]
  ) => void;
}) {
  const { camera, scene } = useThree();
  const { world, rapier } = useRapier();
  const controlsRef = useRef<any>(null);
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const colliderRef = useRef<RapierCollider | null>(null);
  const characterControllerRef = useRef<any>(null);

  const keysHeldRef = useRef<Set<string>>(new Set());
  const mouseDownRef = useRef<boolean>(false);
  const velocityYRef = useRef<number>(0);
  const isGroundedRef = useRef<boolean>(true);
  const lastShotTimeRef = useRef<number>(0);
  const reloadTimerRef = useRef<number>(0);
  const currentEyeOffsetRef = useRef<number>(PLAYER_DIMENSIONS.standingEyeHeight);

  // Slide state refs (6m flat cap, extended when sliding down stairs/ramps)
  const slideDirRef = useRef<[number, number]>([0, -1]);
  const slideSpeedRef = useRef<number>(PLAYER_DIMENSIONS.slideInitialSpeed);
  const slideRemainingRef = useRef<number>(0);
  const slideCooldownRef = useRef<number>(0);
  const shiftLatchRef = useRef<boolean>(false);

  // Authoritative player foot position in world space
  const footPosRef = useRef<[number, number, number]>([18, 0.1, 18]);
  const velocityVecRef = useRef<[number, number, number]>([0, 0, 0]);

  const recoilOffsetRef = useRef({ pitch: 0, yaw: 0, kickBack: 0 });
  const muzzleFlashRef = useRef(0);
  const damageShakeRef = useRef(0);
  const isChargingVapeRef = useRef<boolean>(false);
  const vapeChargeStartPerfRef = useRef<number>(0);

  const hp = useGameStore((s) => s.hp);
  const prevHpRef = useRef(hp);
  const screen = useGameStore((s) => s.screen);
  const selectedMapId = useGameStore((s) => s.selectedMapId);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const respawnNonce = useGameStore((s) => s.respawnNonce);

  // Initialize Rapier KinematicCharacterController with 0.40m step climbing & smooth wall sliding
  useEffect(() => {
    if (!world) return;
    try {
      const controller = world.createCharacterController(0.03);
      controller.setUp({ x: 0, y: 1, z: 0 });
      controller.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
      controller.setMinSlopeSlideAngle((45 * Math.PI) / 180);
      // Min step width 0.05m allows effortlessly stepping up narrow stair treads without snagging
      controller.enableAutostep(PLAYER_DIMENSIONS.maxStepHeight, 0.05, false);
      controller.enableSnapToGround(PLAYER_DIMENSIONS.maxStepHeight);
      controller.setApplyImpulsesToDynamicBodies(true);
      characterControllerRef.current = controller;

      return () => {
        try {
          world.removeCharacterController(controller);
        } catch {
          // Ignore cleanup errors if world already disposed
        }
        characterControllerRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [world]);

  // Trigger responsive minimal screenshake and impact sound when receiving damage
  useEffect(() => {
    if (prevHpRef.current - hp >= 0.5) {
      const diff = prevHpRef.current - hp;
      damageShakeRef.current = Math.min(1.0, damageShakeRef.current + (diff / 25) * 0.45 + 0.35);
      soundEngine.playDamageTakenSound();
    }
    prevHpRef.current = hp;
  }, [hp]);

  // Teleport player to safest unoccupied SpawnPoint on match start, map change, or respawn
  useEffect(() => {
    const state = useGameStore.getState();
    const spawn = state.getSafestSpawnForTeam(playerTeam);
    const sx = spawn.position[0];
    const sy = spawn.position[1];
    const sz = spawn.position[2];

    footPosRef.current = [sx, sy, sz];
    velocityYRef.current = 0;
    isGroundedRef.current = true;
    slideRemainingRef.current = 0;

    const capsuleHalfHeight = PLAYER_DIMENSIONS.totalHeight * 0.5;
    if (rigidBodyRef.current) {
      rigidBodyRef.current.setTranslation(
        { x: sx, y: sy + capsuleHalfHeight, z: sz },
        true
      );
      rigidBodyRef.current.setNextKinematicTranslation({
        x: sx,
        y: sy + capsuleHalfHeight,
        z: sz,
      });
    }

    camera.position.set(sx, sy + PLAYER_DIMENSIONS.standingEyeHeight, sz);
    _euler.set(0, spawn.rotationY, 0, 'YXZ');
    camera.quaternion.setFromEuler(_euler);
  }, [selectedMapId, playerTeam, respawnNonce, camera]);

  // Unlock pointer when paused or in menus
  useEffect(() => {
    if (screen !== 'playing') {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      keysHeldRef.current.clear();
      mouseDownRef.current = false;
    }
  }, [screen]);

  const executeShot = () => {
    const state = useGameStore.getState();
    if (
      state.screen !== 'playing' ||
      state.chatInputOpen ||
      state.isEliminated ||
      state.isDowned ||
      state.droneIntroTimer > 0 ||
      Date.now() < state.stunnedUntil
    ) {
      return;
    }

    // Cannot shoot normal firearms while riding an E-Scooter — ONLY the Lidl Barcode Scanner works on E-Scooters!
    if (!canFireWeaponOnScooter(state.selectedClass, Boolean(state.ridingScooterId))) {
      return;
    }

    const stats = WEAPON_CLASSES[state.selectedClass];
    const now = performance.now();
    if (now - lastShotTimeRef.current < stats.fireRateMs) return;

    const didFire = state.fireRound();
    if (!didFire) return;

    lastShotTimeRef.current = now;
    soundEngine.playShot(state.selectedClass);

    // Apply visual recoil & angular camera kick
    const adsFactor = state.isAds ? 0.6 : 1.0;
    const yawKick = (Math.random() - 0.5) * stats.recoilYaw * adsFactor;
    recoilOffsetRef.current.pitch = stats.recoilPitch * adsFactor;
    recoilOffsetRef.current.yaw = yawKick;
    recoilOffsetRef.current.kickBack = stats.recoilKickback * adsFactor;
    muzzleFlashRef.current = state.selectedClass === 'lidl_scanner' ? 0.12 : 0.055;

    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    _euler.x = Math.min(
      Math.PI / 2.2,
      _euler.x + stats.recoilPitch * (state.isAds ? 0.5 : 0.85)
    );
    _euler.y += yawKick;
    camera.quaternion.setFromEuler(_euler);

    // Hitscan Raycast from exact camera center for each pellet
    const raycaster = new THREE.Raycaster();
    raycaster.camera = camera;
    const spreadAmount = state.isAds ? stats.adsSpread : stats.spread;
    const maxWeaponRange = stats.maxRange || 160;

    for (let p = 0; p < stats.pellets; p++) {
      _rayOrigin.copy(camera.position);
      camera.getWorldDirection(_rayDir);
      _rayDir.x += (Math.random() - 0.5) * spreadAmount;
      _rayDir.y += (Math.random() - 0.5) * spreadAmount;
      _rayDir.z += (Math.random() - 0.5) * spreadAmount;
      _rayDir.normalize();

      raycaster.set(_rayOrigin, _rayDir);
      raycaster.far = maxWeaponRange;

      const hits = raycaster.intersectObjects(scene.children, true);
      const tracerDist = Math.min(80, maxWeaponRange);
      let endPoint: [number, number, number] = [
        _rayOrigin.x + _rayDir.x * tracerDist,
        _rayOrigin.y + _rayDir.y * tracerDist,
        _rayOrigin.z + _rayDir.z * tracerDist,
      ];

      let hitActorId: string | null = null;

      for (const hit of hits) {
        if (hit.distance > maxWeaponRange) break;

        let obj: THREE.Object3D | null = hit.object;
        let hitZone: HitZone = 'body';

        if (hit.object.userData?.hitZone) {
          hitZone = hit.object.userData.hitZone as HitZone;
        } else if (hit.object.userData?.isHead) {
          hitZone = 'head';
        }

        while (obj) {
          if (obj.userData?.actorId) {
            hitActorId = obj.userData.actorId;
            break;
          }
          obj = obj.parent;
        }

        if (hitActorId) {
          const targetActor = state.remotePlayers[hitActorId];
          const isEnemy =
            targetActor &&
            (targetActor.team !== state.playerTeam || state.selectedModeId === 'FFA');

          if (isEnemy) {
            const isHeadshot = hitZone === 'head';
            const dmg = calculateHitDamage(state.selectedClass, hit.distance, hitZone);

            // Lidl Barcode Scanner: Stuns enemy for 10 seconds within 4.0m range!
            if (stats.stunDurationMs && stats.stunDurationMs > 0) {
              state.stunRemoteActor(hitActorId, stats.stunDurationMs, state.playerName);
            }

            if (dmg > 0) {
              state.damageRemoteActor(
                hitActorId,
                dmg,
                isHeadshot,
                state.playerName,
                state.playerTeam,
                stats.name
              );
              const targetActor = state.remotePlayers[hitActorId];
              const indicatorPos: [number, number, number] = targetActor
                ? [targetActor.position[0], targetActor.position[1] + 1.85, targetActor.position[2]]
                : [hit.point.x, hit.point.y + 0.35, hit.point.z];
              state.addDamageIndicator(hitActorId, dmg, isHeadshot, indicatorPos);
            }

            state.triggerHitmarker(isHeadshot || Boolean(stats.stunDurationMs));
            soundEngine.playHitmarker(isHeadshot || Boolean(stats.stunDurationMs));
            multiplayerManager.sendHitscanEvent(
              hitActorId,
              dmg,
              isHeadshot,
              stats.name,
              state.selectedClass,
              stats.stunDurationMs
            );
          }
          endPoint = [hit.point.x, hit.point.y, hit.point.z];
          break;
        }

        if (hit.object.userData?.isEnvironment) {
          endPoint = [hit.point.x, hit.point.y, hit.point.z];

          // Spawn persistent 3D Bullet Hole Decal on environment surfaces (except for laser scanner)
          if (onSpawnBulletHole && state.selectedClass !== 'lidl_scanner' && hit.face) {
            _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
            _worldNormal.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
            onSpawnBulletHole(
              [hit.point.x, hit.point.y, hit.point.z],
              [_worldNormal.x, _worldNormal.y, _worldNormal.z]
            );
          }
          break;
        }
      }

      const handSign = state.settings.leftHanded ? -1 : 1;
      camera.getWorldDirection(_forward);
      _right.crossVectors(_forward, camera.up).normalize();
      const muzzleStart: [number, number, number] = [
        camera.position.x + _forward.x * 0.52 + _right.x * 0.18 * handSign,
        camera.position.y - 0.12 + _forward.y * 0.52,
        camera.position.z + _forward.z * 0.52 + _right.z * 0.18 * handSign,
      ];

      // Replicate shot across WebRTC DataChannels, server WS, & local BroadcastChannel
      multiplayerManager.sendShotEvent(
        muzzleStart,
        endPoint,
        state.selectedClass,
        hitActorId
      );

      if (state.settings.fpBulletTracers) {
        onSpawnTracer(
          muzzleStart,
          endPoint,
          state.selectedClass === 'lidl_scanner' ? '#ff1e1e' : '#fde047'
        );
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();

      // Hold TAB to show centered Leaderboard Overlay (Screenshot 1)
      if (e.key === 'Tab') {
        e.preventDefault();
        store.setTabLeaderboardOpen(true);
        return;
      }

      if (store.chatInputOpen) {
        if (e.key === 'Escape') {
          store.setChatInputOpen(false);
        }
        return;
      }

      const keyUpper = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
      keysHeldRef.current.add(keyUpper);

      // Press Space to Respawn when Eliminated (Screenshot 3 - respects 5s cooldown)
      if (store.isEliminated && keyUpper === 'SPACE') {
        if (store.respawnCooldownSec <= 0) {
          e.preventDefault();
          store.respawnPlayer();
        }
        return;
      }

      if (e.key === 'Escape' || keyUpper === 'P') {
        if (store.screen === 'playing') {
          store.setScreen('paused');
        } else if (store.screen === 'paused') {
          store.setScreen('playing');
        }
        return;
      }

      if (store.screen !== 'playing' || store.isEliminated) return;

      const kb = store.settings.keybinds;

      // Hold [Q] to charge and throw a collected Vape Smoke Grenade along a ballistic trajectory
      if (keyUpper === 'Q' && !e.repeat && store.vapeCount > 0 && !store.isDowned) {
        isChargingVapeRef.current = true;
        vapeChargeStartPerfRef.current = performance.now();
        return;
      }

      // Press [E] to interact with Arthem NPC or mount/dismount nearby Campus E-Scooter
      if (keyUpper === 'E' && !e.repeat) {
        // 1. Check if near Arthem NPC inside the school building
        const distToArthem = Math.hypot(
          footPosRef.current[0] - ARTHEM_NPC_POSITION[0],
          footPosRef.current[2] - ARTHEM_NPC_POSITION[2]
        );
        if (distToArthem <= 2.8 && !store.hasTalkedToArthemThisRound && !store.isEliminated && !store.isDowned) {
          const res = store.interactWithArthem();
          if (res.lethal) {
            soundEngine.playDamageTakenSound();
          }
          return;
        }

        // 2. Mount/dismount nearby Campus E-Scooter
        if (store.ridingScooterId || store.nearbyScooterId) {
          _euler.setFromQuaternion(camera.quaternion, 'YXZ');
          const mounted = store.toggleMountScooter(footPosRef.current, _euler.y);
          soundEngine.playScooterMountSound(mounted);
          return;
        }
      }

      // Press [SHIFT] to start a tactical Slide (~6m flat, longer down stairs!)
      if (
        (e.key === 'Shift' || keyUpper === kb.crouch || keyUpper === 'SHIFT') &&
        !shiftLatchRef.current
      ) {
        shiftLatchRef.current = true;
        if (
          !store.isSliding &&
          !store.ridingScooterId &&
          slideCooldownRef.current <= 0 &&
          isGroundedRef.current
        ) {
          camera.getWorldDirection(_forward);
          _forward.y = 0;
          if (_forward.lengthSq() > 0.001) _forward.normalize();
          slideDirRef.current = [_forward.x, _forward.z];
          slideSpeedRef.current = PLAYER_DIMENSIONS.slideInitialSpeed;
          slideRemainingRef.current = PLAYER_DIMENSIONS.slideMaxFlatDistance;
          store.setSliding(true, PLAYER_DIMENSIONS.slideMaxFlatDistance);
          soundEngine.playSlideSound();
        }
        return;
      }

      if (keyUpper === kb.reload) {
        store.startReload();
        soundEngine.playReload();
      } else if (keyUpper === kb.shoot) {
        executeShot();
      } else if (keyUpper === kb.ads) {
        store.setAds(!store.isAds);
      } else if (e.key === 'Control' || keyUpper === 'C') {
        store.setCrouching(true);
      } else if (keyUpper === kb.switchClass) {
        store.setScreen('select_class');
      } else if (e.key === 'Enter') {
        store.setChatInputOpen(true);
      } else if (keyUpper === kb.quickChat) {
        multiplayerManager.sendChatMessage('Enemy spotted at courtyard plaza!');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        useGameStore.getState().setTabLeaderboardOpen(false);
        return;
      }

      const keyUpper = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
      keysHeldRef.current.delete(keyUpper);
      const store = useGameStore.getState();

      if (keyUpper === 'Q' && isChargingVapeRef.current) {
        isChargingVapeRef.current = false;
        const chargeRatio = Math.min(1.0, (performance.now() - vapeChargeStartPerfRef.current) / 1000);
        const throwForce = 9.0 + chargeRatio * 20.0;
        camera.getWorldDirection(_rayDir);
        const didThrow = store.throwVapeSmokeGrenade(
          [camera.position.x, camera.position.y - 0.1, camera.position.z],
          [_rayDir.x, _rayDir.y, _rayDir.z],
          footPosRef.current[1] + 0.15,
          throwForce
        );
        if (didThrow) {
          soundEngine.playVapeThrowAndPuffSound();
        }
        store.setVapeCharge(0, []);
      }

      if (e.key === 'Control' || keyUpper === 'C') {
        store.setCrouching(false);
      }
      if (e.key === 'Shift' || keyUpper === store.settings.keybinds.crouch || keyUpper === 'SHIFT') {
        shiftLatchRef.current = false;
        if (store.isSliding) {
          slideRemainingRef.current = 0;
          store.setSliding(false, 0);
          slideCooldownRef.current = PLAYER_DIMENSIONS.slideCooldownSec;
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const store = useGameStore.getState();
      if (store.screen !== 'playing' || store.chatInputOpen || store.isEliminated) return;
      if (e.button === 0) {
        mouseDownRef.current = true;
        executeShot();
      } else if (e.button === 2) {
        if (store.settings.toggleAds) {
          store.setAds(!store.isAds);
        } else {
          store.setAds(true);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const store = useGameStore.getState();
      if (e.button === 0) {
        mouseDownRef.current = false;
      } else if (e.button === 2 && !store.settings.toggleAds) {
        store.setAds(false);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (useGameStore.getState().screen === 'playing') {
        e.preventDefault();
      }
    };

    const onBlur = () => {
      keysHeldRef.current.clear();
      mouseDownRef.current = false;
      shiftLatchRef.current = false;
      useGameStore.getState().setTabLeaderboardOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    if (store.screen !== 'playing') return;

    store.tickMatchTimer(dt);

    if (slideCooldownRef.current > 0) {
      slideCooldownRef.current = Math.max(0, slideCooldownRef.current - dt);
    }

    // Automatically collect nearby Ground Pickups (Vapes, Kong Strong cans, Schoko-Croissants) when walking over them
    const collected = store.collectNearbyPickups(footPosRef.current);
    if (collected.length > 0) {
      for (const itemType of collected) {
        soundEngine.playPickupSound(itemType);
      }
    }

    // Check proximity to the Campus E-Scooters at the bike racks
    if (!store.ridingScooterId) {
      let closestId: string | null = null;
      let closestDist = 2.8;
      for (const sc of store.scooters) {
        const d = Math.hypot(
          footPosRef.current[0] - sc.position[0],
          footPosRef.current[2] - sc.position[2]
        );
        if (d < closestDist) {
          closestDist = d;
          closestId = sc.id;
        }
      }
      if (closestId !== store.nearbyScooterId) {
        store.setNearbyScooterId(closestId);
      }
    } else if (store.nearbyScooterId !== store.ridingScooterId) {
      store.setNearbyScooterId(store.ridingScooterId);
    }

    // Check proximity to Arthem NPC in the school corridor
    const distToArthem = Math.hypot(
      footPosRef.current[0] - ARTHEM_NPC_POSITION[0],
      footPosRef.current[2] - ARTHEM_NPC_POSITION[2]
    );
    const nearArthem = distToArthem <= 2.8 && !store.hasTalkedToArthemThisRound;
    if (store.isNearArthem !== nearArthem) {
      store.setIsNearArthem(nearArthem);
    }

    // If eliminated or stunned by Lidl Barcode Scanner (10s), freeze player movement & firing
    const isStunned = Date.now() < store.stunnedUntil;
    if (store.isEliminated || isStunned) {
      store.setMovementSpeedRatio(0);
      return;
    }

    // Handle Reload timer
    if (store.isReloading) {
      const stats = WEAPON_CLASSES[store.selectedClass];
      reloadTimerRef.current += dt;
      if (reloadTimerRef.current >= stats.reloadTime) {
        reloadTimerRef.current = 0;
        store.finishReload();
      }
    } else {
      reloadTimerRef.current = 0;
    }

    // Automatic firing while left mouse or Shoot key held
    const stats = WEAPON_CLASSES[store.selectedClass];
    const kb = store.settings.keybinds;
    if (
      stats.automatic &&
      (mouseDownRef.current || keysHeldRef.current.has(kb.shoot)) &&
      !store.isReloading
    ) {
      executeShot();
    }

    // WASD + Arrow keys movement
    const held = keysHeldRef.current;
    const moveFwd =
      (held.has(kb.forward) || held.has('ARROWUP') ? 1 : 0) -
      (held.has(kb.backward) || held.has('ARROWDOWN') ? 1 : 0);
    const moveStrafe =
      (held.has(kb.right) || held.has('ARROWRIGHT') ? 1 : 0) -
      (held.has(kb.left) || held.has('ARROWLEFT') ? 1 : 0);

    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, camera.up).normalize();

    _moveVec.set(0, 0, 0);
    _moveVec.addScaledVector(_forward, moveFwd);
    _moveVec.addScaledVector(_right, moveStrafe);
    if (_moveVec.lengthSq() > 0) {
      _moveVec.normalize();
    }

    // Kong Strong Energy Drink grants +40% movement speed for 10 seconds!
    const kongSpeedBoost =
      Date.now() < store.kongStrongUntil
        ? PLAYER_DIMENSIONS.kongStrongSpeedMultiplier
        : 1.0;

    // Check revive interaction with nearby downed teammates
    if (!store.isEliminated && !store.isDowned) {
      let nearbyDownedTeammateId: string | null = null;
      for (const p of Object.values(store.remotePlayers)) {
        if (p.team === store.playerTeam && p.isDowned) {
          const d = Math.hypot(
            footPosRef.current[0] - p.position[0],
            footPosRef.current[2] - p.position[2]
          );
          if (d <= 2.8) {
            nearbyDownedTeammateId = p.id;
            break;
          }
        }
      }

      const isReviveKeyHeld = held.has(kb.interact) || held.has('E') || held.has('F');
      if (nearbyDownedTeammateId && isReviveKeyHeld && !store.ridingScooterId) {
        if (store.localRevivingTargetId !== nearbyDownedTeammateId) {
          store.startReviveTeammate(nearbyDownedTeammateId);
          multiplayerManager.sendReviveEvent(nearbyDownedTeammateId, 'start');
        }
        const res = store.stepReviveProgress(dt);
        multiplayerManager.sendReviveEvent(nearbyDownedTeammateId, 'progress', res.progress);
        if (res.completed) {
          multiplayerManager.sendReviveEvent(nearbyDownedTeammateId, 'complete');
          soundEngine.playPickupSound('kong_strong');
        }
      } else if (store.localRevivingTargetId) {
        const cancelTarget = store.localRevivingTargetId;
        store.cancelReviveTeammate();
        multiplayerManager.sendReviveEvent(cancelTarget, 'cancel');
      }
    }

    // Determine horizontal velocity: Downed (Crawling) vs Riding E-Scooter vs Sliding vs Walking
    let desiredDx = 0;
    let desiredDz = 0;
    let currentSpeed: number = PLAYER_DIMENSIONS.walkSpeed * kongSpeedBoost;

    if (store.matchStartCountdownSec > 0) {
      currentSpeed = 0;
      desiredDx = 0;
      desiredDz = 0;
    } else if (store.isDowned) {
      // Fortnite-Style DBNO Crawling
      currentSpeed = 1.35;
      desiredDx = _moveVec.x * currentSpeed * dt;
      desiredDz = _moveVec.z * currentSpeed * dt;
    } else if (store.ridingScooterId) {
      const isDominic = store.scooters.find((s) => s.id === store.ridingScooterId)?.isDominic;
      currentSpeed = PLAYER_DIMENSIONS.scooterSpeed * (isDominic ? DOMINIC_SCOOTER_SPEED_MULTIPLIER : 1.0);
      desiredDx = _moveVec.x * currentSpeed * dt;
      desiredDz = _moveVec.z * currentSpeed * dt;
    } else if (store.isSliding && slideRemainingRef.current > 0) {
      currentSpeed = slideSpeedRef.current * kongSpeedBoost;
      // Allow subtle steering while sliding
      const steerX = slideDirRef.current[0] * 0.85 + _moveVec.x * 0.15;
      const steerZ = slideDirRef.current[1] * 0.85 + _moveVec.z * 0.15;
      const len = Math.hypot(steerX, steerZ) || 1;
      desiredDx = (steerX / len) * currentSpeed * dt;
      desiredDz = (steerZ / len) * currentSpeed * dt;
    } else {
      currentSpeed =
        (store.isCrouching
          ? PLAYER_DIMENSIONS.crouchSpeed
          : PLAYER_DIMENSIONS.walkSpeed) * kongSpeedBoost;
      desiredDx = _moveVec.x * currentSpeed * dt;
      desiredDz = _moveVec.z * currentSpeed * dt;
    }

    // Jump impulse (jumping also cancels slide; blocked while on E-Scooter, downed, or during match countdown)
    if (
      held.has(kb.jump) &&
      isGroundedRef.current &&
      !store.isDowned &&
      !store.ridingScooterId &&
      store.matchStartCountdownSec <= 0
    ) {
      velocityYRef.current = PLAYER_DIMENSIONS.jumpVelocity;
      isGroundedRef.current = false;
      if (store.isSliding) {
        slideRemainingRef.current = 0;
        store.setSliding(false, 0);
      }
    }

    velocityYRef.current += PLAYER_DIMENSIONS.gravity * dt;
    const desiredDy = velocityYRef.current * dt;

    const prevFootY = footPosRef.current[1];
    const isLowCollider = store.isCrouching || store.isSliding;
    // Keep physical capsule height constant so Rapier never recreates the collider mid-slide/crouch
    // (which previously teleported the bottom of the capsule 45cm underground when standing back up).
    const capsuleHalfHeight = PLAYER_DIMENSIONS.totalHeight * 0.5;

    let nextFootX = footPosRef.current[0] + desiredDx;
    let nextFootY = footPosRef.current[1] + desiredDy;
    let nextFootZ = footPosRef.current[2] + desiredDz;

    // Solve movement against Rapier trimesh colliders + invisible border using CharacterController
    const controller = characterControllerRef.current;
    const collider = colliderRef.current;
    const rb = rigidBodyRef.current;

    if (controller && collider && rb) {
      try {
        // Ensure kinematic RigidBody starts at exact authoritative footPosRef on high-refresh-rate monitors
        rb.setTranslation(
          {
            x: footPosRef.current[0],
            y: footPosRef.current[1] + capsuleHalfHeight,
            z: footPosRef.current[2],
          },
          false
        );

        if (velocityYRef.current > 0) {
          controller.disableSnapToGround();
        } else {
          controller.enableSnapToGround(PLAYER_DIMENSIONS.maxStepHeight);
        }

        controller.computeColliderMovement(collider, {
          x: desiredDx,
          y: desiredDy,
          z: desiredDz,
        });
        const corrected = controller.computedMovement();
        let grounded = controller.computedGrounded();

        nextFootX = footPosRef.current[0] + corrected.x;
        nextFootY = Math.max(-15, footPosRef.current[1] + corrected.y);
        nextFootZ = footPosRef.current[2] + corrected.z;

        // Downward anti-penetration floor raycast: ensures player feet never clip underneath floor/stair trimesh
        if (rapier && velocityYRef.current <= 0.5) {
          const rayStartY = nextFootY + 0.95;
          const downRay = new rapier.Ray(
            { x: nextFootX, y: rayStartY, z: nextFootZ },
            { x: 0, y: -1, z: 0 }
          );
          const groundHit = world.castRay(
            downRay,
            1.02,
            true,
            undefined,
            undefined,
            collider,
            rb
          );
          if (groundHit && groundHit.timeOfImpact > 0.05) {
            const floorY = rayStartY - groundHit.timeOfImpact;
            if (floorY >= nextFootY - 0.04 && floorY - nextFootY <= 0.65) {
              nextFootY = Math.max(nextFootY, floorY);
              grounded = true;
            }
          }
        }

        const wasInAir = !isGroundedRef.current;
        const prevDownVel = velocityYRef.current;

        if (grounded && velocityYRef.current <= 0) {
          velocityYRef.current = -0.5;
          isGroundedRef.current = true;
          // Realistic Fall Damage on High Impact Landing
          if (wasInAir && prevDownVel < -11.2) {
            const fallDamage = Math.min(100, Math.round((Math.abs(prevDownVel) - 11.2) * 7.2));
            if (fallDamage > 0) {
              store.applyPlayerDamage(fallDamage, {
                name: 'Fallschaden',
                team: store.playerTeam === 'alpha' ? 'bravo' : 'alpha',
                hp: 100,
                maxHp: 100,
                weaponClass: 'assault',
              });
              soundEngine.playDamageTakenSound();
            }
          }
        } else if (nextFootY <= 0.12 && velocityYRef.current <= 0) {
          nextFootY = Math.max(0.12, nextFootY);
          velocityYRef.current = 0;
          isGroundedRef.current = true;
          if (wasInAir && prevDownVel < -11.2) {
            const fallDamage = Math.min(100, Math.round((Math.abs(prevDownVel) - 11.2) * 7.2));
            if (fallDamage > 0) {
              store.applyPlayerDamage(fallDamage, {
                name: 'Fallschaden',
                team: store.playerTeam === 'alpha' ? 'bravo' : 'alpha',
                hp: 100,
                maxHp: 100,
                weaponClass: 'assault',
              });
              soundEngine.playDamageTakenSound();
            }
          }
        } else {
          isGroundedRef.current = Boolean(grounded);
        }

        rb.setTranslation(
          {
            x: nextFootX,
            y: nextFootY + capsuleHalfHeight,
            z: nextFootZ,
          },
          true
        );
        rb.setNextKinematicTranslation({
          x: nextFootX,
          y: nextFootY + capsuleHalfHeight,
          z: nextFootZ,
        });
      } catch {
        if (nextFootY <= 0.12) {
          nextFootY = 0.12;
          velocityYRef.current = 0;
          isGroundedRef.current = true;
        }
      }
    } else {
      if (nextFootY <= 0.12) {
        nextFootY = 0.12;
        velocityYRef.current = 0;
        isGroundedRef.current = true;
      }
    }

    // Update Slide distance budget (6m flat limit, extended when sliding down stairs/ramps!)
    if (store.isSliding) {
      const verticalDelta = nextFootY - prevFootY;
      const actualHorizStep = Math.hypot(
        nextFootX - footPosRef.current[0],
        nextFootZ - footPosRef.current[2]
      );
      const stepState = computeSlideStep(
        slideRemainingRef.current,
        actualHorizStep,
        verticalDelta
      );
      slideRemainingRef.current = stepState.nextRemainingDistance;
      slideSpeedRef.current =
        PLAYER_DIMENSIONS.slideInitialSpeed * stepState.speedMultiplier;

      // Stop slide if blocked by stairs/walls or if player pulls back [S]
      const minExpectedStep = currentSpeed * dt * 0.42;
      const isBlocked = actualHorizStep < Math.max(0.035, minExpectedStep);
      const isPressingBackward = held.has(kb.backward) || held.has('s') || held.has('S');

      if (!stepState.shouldContinue || isBlocked || isPressingBackward) {
        slideRemainingRef.current = 0;
        store.setSliding(false, 0);
        slideCooldownRef.current = PLAYER_DIMENSIONS.slideCooldownSec;
        // If stopped on stairs / steps, ensure foot clears the riser step
        if (verticalDelta > 0.015) {
          nextFootY = Math.max(nextFootY, prevFootY + 0.05);
        }
      } else {
        store.setSliding(true, stepState.nextRemainingDistance);
      }
    }

    // Safety arena bounds if falling out of world
    if (nextFootY < -12) {
      store.respawnPlayer();
      return;
    }

    velocityVecRef.current = [
      (nextFootX - footPosRef.current[0]) / Math.max(0.001, dt),
      (nextFootY - footPosRef.current[1]) / Math.max(0.001, dt),
      (nextFootZ - footPosRef.current[2]) / Math.max(0.001, dt),
    ];
    footPosRef.current = [nextFootX, nextFootY, nextFootZ];

    // Smooth camera eye height transition: Downed 0.42m (crawling) vs Standing 1.65m (+0.14m on E-Scooter) vs Crouched 0.80m vs Sliding 1.02m
    const targetEyeOffset = store.isDowned
      ? 0.42
      : store.isSliding
        ? 1.02
        : isLowCollider
          ? PLAYER_DIMENSIONS.crouchingEyeHeight
          : store.ridingScooterId
            ? PLAYER_DIMENSIONS.standingEyeHeight + 0.14
            : PLAYER_DIMENSIONS.standingEyeHeight;
    currentEyeOffsetRef.current = THREE.MathUtils.damp(
      currentEyeOffsetRef.current,
      targetEyeOffset,
      14,
      dt
    );

    // Minimal tactical screenshake upon taking damage (shake pitch, yaw, roll and vertical offset)
    let shakePitch = 0;
    let shakeYaw = 0;
    let shakeRoll = 0;
    let shakeY = 0;

    if (damageShakeRef.current > 0.001) {
      const shake = damageShakeRef.current;
      const shakeFreq = performance.now() * 0.05;
      shakePitch = Math.sin(shakeFreq) * 0.024 * shake;
      shakeYaw = Math.cos(shakeFreq * 1.3) * 0.02 * shake;
      shakeRoll = Math.sin(shakeFreq * 0.7) * 0.016 * shake;
      shakeY = (Math.sin(shakeFreq * 1.8) - 0.5) * 0.03 * shake;

      damageShakeRef.current = THREE.MathUtils.damp(damageShakeRef.current, 0, 14, dt);
    }

    camera.position.set(
      nextFootX,
      nextFootY + currentEyeOffsetRef.current + shakeY,
      nextFootZ
    );

    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    if (damageShakeRef.current > 0.001) {
      _euler.x += shakePitch;
      _euler.y += shakeYaw;
      _euler.z += shakeRoll;
    }

    // Street Dart psychedelic trip camera roll & wobble
    if (store.streetDartUntil > Date.now()) {
      const tripTime = performance.now() * 0.003;
      _euler.z += Math.sin(tripTime) * 0.18;
      _euler.x += Math.cos(tripTime * 0.7) * 0.08;
      _euler.y += Math.sin(tripTime * 0.5) * 0.06;
    }
    camera.quaternion.setFromEuler(_euler);

    // Compute ballistic trajectory for charged Vape smoke grenade throw [Q]
    if (isChargingVapeRef.current && store.vapeCount > 0 && !store.isDowned) {
      const chargeRatio = Math.min(
        1.0,
        (performance.now() - vapeChargeStartPerfRef.current) / 1000
      );
      const throwForce = 9.0 + chargeRatio * 20.0;
      camera.getWorldDirection(_rayDir);

      const trajPoints: [number, number, number][] = [];
      const originX = camera.position.x;
      const originY = camera.position.y - 0.1;
      const originZ = camera.position.z;
      const vx = _rayDir.x * throwForce;
      const vy = _rayDir.y * throwForce + 2.5;
      const vz = _rayDir.z * throwForce;
      const gravity = 16.0;
      const groundFloorY = footPosRef.current[1] + 0.15;

      for (let s = 0; s <= 30; s++) {
        const t = s * 0.04;
        const px = originX + vx * t;
        const py = Math.max(groundFloorY, originY + vy * t - 0.5 * gravity * t * t);
        const pz = originZ + vz * t;
        trajPoints.push([px, py, pz]);
        if (py <= groundFloorY && s > 2) break;
      }
      store.setVapeCharge(chargeRatio, trajPoints);
    }

    const speedRatio = store.isSliding
      ? 1.2
      : _moveVec.length() * (currentSpeed / PLAYER_DIMENSIONS.walkSpeed);
    store.setMovementSpeedRatio(speedRatio);

    // Sync mounted E-Scooter position on the map
    if (store.ridingScooterId) {
      store.updateMountedScooterTransform([nextFootX, nextFootY, nextFootZ], _euler.y);
    }

    // Update Local Multiplayer state buffer (with velocity for Hermite P2P interpolation)
    multiplayerManager.updateLocalTransform(
      [nextFootX, nextFootY, nextFootZ],
      [_euler.x, _euler.y],
      velocityVecRef.current
    );
  });

  const halfCylHeight = PLAYER_DIMENSIONS.cylinderHeight * 0.5;

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[18, 1.0, 18]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider
          ref={colliderRef}
          args={[halfCylHeight, PLAYER_DIMENSIONS.capsuleRadius]}
        />
      </RigidBody>

      {screen === 'playing' && (
        <PointerLockControls
          ref={controlsRef}
          selector="#deadshot-canvas-lock-trigger"
        />
      )}
      <FirstPersonWeapon
        recoilOffsetRef={recoilOffsetRef}
        muzzleFlashRef={muzzleFlashRef}
      />
    </>
  );
}
