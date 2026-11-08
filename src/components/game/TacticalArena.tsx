import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  useGameStore,
  type RemoteActor,
  type MapScooterState,
  type GroundPickupItem,
  type ThrownVapeState,
  type SmokeCloudState,
  type FloatingDamageIndicator,
} from '../../store/useGameStore';
import {
  MAPS,
  resolveArenaCollisions,
  type AABB,
  type WeaponId,
  type PickupItemType,
} from '../../game/rules';
import { soundEngine } from '../../game/soundEngine';
import { WeaponModelGeometry } from './Weapon';
import {
  PlayerController,
  type BulletTracer,
  type BulletHoleDecalData,
} from './Player';
import { MapEnvironment } from './MapEnvironment';

function createNameplateTexture(
  name: string,
  team: 'alpha' | 'bravo',
  hpRatio: number,
  isStunned = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96);

    const clampedHp = Math.max(0, Math.min(1, hpRatio));
    const isFriendly = team === 'alpha';
    const mainColor = isStunned ? '#fff000' : isFriendly ? '#3897f0' : '#ef4444';

    // 1. Player Name (Clean bold, matching Image 2: "Player_4")
    ctx.font = 'bold 26px "Plus Jakarta Sans", "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelText = isStunned ? `⚡ ${name}` : name;

    // Dark text outline for crisp contrast in 3D world
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 4;
    ctx.strokeText(labelText, 128, 24);

    ctx.fillStyle = mainColor;
    ctx.fillText(labelText, 128, 24);

    // 2. Health Bar Background (dark charcoal/black rectangle, matching Image 2)
    const barWidth = 140;
    const barHeight = 12;
    const barX = (256 - barWidth) / 2;
    const barY = 44;

    ctx.fillStyle = 'rgba(22, 22, 24, 0.88)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // 3. Health Bar Fill (solid blue/red matching current HP, exactly like Image 2)
    if (clampedHp > 0) {
      const fillW = Math.max(2, Math.round(barWidth * clampedHp));
      ctx.fillStyle = mainColor;
      ctx.fillRect(barX, barY, fillW, barHeight);
    }

    // 4. Downward Triangle Arrow Indicator (▼) under center of health bar (Image 2)
    ctx.beginPath();
    ctx.moveTo(123, 60);
    ctx.lineTo(133, 60);
    ctx.lineTo(128, 67);
    ctx.closePath();
    ctx.fillStyle = isFriendly ? 'rgba(56, 151, 240, 0.75)' : 'rgba(239, 68, 68, 0.75)';
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createScooterBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 24, 60, 0.85)';
    ctx.fillRect(12, 10, 232, 44);
    ctx.strokeStyle = '#fff000';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 10, 232, 44);
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff000';
    ctx.fillText('[E] E-Scooter fahren', 128, 39);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDamageIndicatorTexture(
  totalDamage: number,
  isHeadshot: boolean,
  hitCount: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    const text = isHeadshot ? `★ ${totalDamage}` : `${totalDamage}`;
    ctx.font = isHeadshot ? '900 52px "Plus Jakarta Sans", sans-serif' : '900 48px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Deep black outline for extreme contrast
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 9;
    ctx.strokeText(text, 128, 64);

    // Glowing color: gold/yellow for crits, pure white for standard hits
    ctx.fillStyle = isHeadshot ? '#ffd700' : '#ffffff';
    ctx.fillText(text, 128, 64);

    // Stacking combo hit count tag (e.g. x2, x3)
    if (hitCount > 1) {
      ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText(`x${hitCount}`, 205, 34);
      ctx.fillStyle = '#f97316';
      ctx.fillText(`x${hitCount}`, 205, 34);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function SingleDamageIndicator({ indicator }: { indicator: FloatingDamageIndicator }) {
  const tex = useMemo(
    () => createDamageIndicatorTexture(indicator.totalDamage, indicator.isHeadshot, indicator.hitCount),
    [indicator.totalDamage, indicator.isHeadshot, indicator.hitCount]
  );
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame(() => {
    if (!spriteRef.current) return;
    const now = Date.now();
    const elapsedMs = now - indicator.createdAt;
    const progress = Math.min(1, Math.max(0, elapsedMs / indicator.durationMs));

    // Float upward gently over 1 second
    spriteRef.current.position.set(
      indicator.position[0],
      indicator.position[1] + progress * 1.35,
      indicator.position[2]
    );

    // Pop-in scale on impact then fade out
    const scale = progress < 0.12 ? 0.7 + (progress / 0.12) * 0.7 : 1.4;
    spriteRef.current.scale.set(scale * 1.4, scale * 0.7, 1);

    if (spriteRef.current.material) {
      spriteRef.current.material.opacity = progress > 0.65 ? (1 - progress) / 0.35 : 1.0;
    }
  });

  return (
    <sprite ref={spriteRef} position={indicator.position} renderOrder={1000}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

function FloatingDamageIndicators() {
  const damageIndicators = useGameStore((s) => s.damageIndicators);
  if (damageIndicators.length === 0) return null;

  return (
    <>
      {damageIndicators.map((ind) => (
        <SingleDamageIndicator key={ind.id} indicator={ind} />
      ))}
    </>
  );
}

export const ARENA_COLLIDERS: AABB[] = [
  { minX: -12, maxX: -4, minY: 0, maxY: 8, minZ: -12, maxZ: -4 },
  { minX: 4, maxX: 12, minY: 0, maxY: 8, minZ: 4, maxZ: 12 },
];

function PbrEnvironmentSetup({
  isSoftwareGl = false,
  graphicsPreset = 'ultra',
}: {
  isSoftwareGl?: boolean;
  graphicsPreset?: 'low' | 'ultra';
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (isSoftwareGl) return;
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = graphicsPreset === 'ultra' ? 0.45 : 0.35;

    return () => {
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene, isSoftwareGl, graphicsPreset]);

  return null;
}

export function TacticalSoldierMesh({
  team,
  weaponClass = 'assault',
  isHit = false,
  isStunned = false,
  outlineColor = 'None',
  showcasePose = false,
  isMoving = false,
  isSliding = false,
  isCrouching = false,
  moveSpeed = 0,
  animTime = 0,
  soldierSkin = 'default',
  liveActor,
}: {
  team: 'alpha' | 'bravo';
  weaponClass?: WeaponId;
  isHit?: boolean;
  isStunned?: boolean;
  outlineColor?: string;
  showcasePose?: boolean;
  isMoving?: boolean;
  isSliding?: boolean;
  isCrouching?: boolean;
  moveSpeed?: number;
  animTime?: number;
  soldierSkin?: string;
  liveActor?: RemoteActor;
}) {
  let baseUniform = team === 'alpha' ? '#2c3847' : '#422c2c';
  let baseVest = '#141619';
  let baseAccent = team === 'alpha' ? '#2b7fff' : '#e74c3c';
  let baseCap = '#181a1d';
  let baseSkin = '#d8a47f';

  if (soldierSkin === 'ghost_infiltrator') {
    baseUniform = '#09090b';
    baseVest = '#020304';
    baseAccent = '#38bdf8';
    baseCap = '#000000';
    baseSkin = '#18181b';
  } else if (soldierSkin === 'desert_commando') {
    baseUniform = '#c2956e';
    baseVest = '#8c6b4f';
    baseAccent = '#f59e0b';
    baseCap = '#9a7556';
  } else if (soldierSkin === 'cyber_raider') {
    baseUniform = '#0f172a';
    baseVest = '#0284c7';
    baseAccent = '#06b6d4';
    baseCap = '#0369a1';
  } else if (soldierSkin === 'campus_enforcer') {
    baseUniform = '#1e3a8a';
    baseVest = '#172554';
    baseAccent = '#facc15';
    baseCap = '#1e293b';
  } else if (soldierSkin === 'lidl_manager') {
    baseUniform = '#0050aa';
    baseVest = '#fff000';
    baseAccent = '#ef4444';
    baseCap = '#0050aa';
  }

  const uniformColor = isHit
    ? '#ffffff'
    : isStunned
      ? '#0050aa'
      : baseUniform;
  const teamAccentColor = isHit
    ? '#ffffff'
    : isStunned
      ? '#fff000'
      : baseAccent;
  const vestColor = isHit ? '#ffffff' : baseVest;
  const skinColor = isHit ? '#ffffff' : baseSkin;
  const capColor = isHit ? '#ffffff' : baseCap;

  const outlineHex = isStunned
    ? '#fff000'
    : outlineColor === 'Red'
      ? '#ef4444'
      : outlineColor === 'Yellow'
        ? '#eab308'
        : outlineColor === 'Purple'
          ? '#a855f7'
          : null;

  const rootRef = useRef<THREE.Group>(null);
  const upperBodyRef = useRef<THREE.Group>(null);
  const leftLegPivotRef = useRef<THREE.Group>(null);
  const rightLegPivotRef = useRef<THREE.Group>(null);
  const leftArmPivotRef = useRef<THREE.Group>(null);
  const rightArmPivotRef = useRef<THREE.Group>(null);
  const headPivotRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = animTime > 0 ? animTime : state.clock.elapsedTime;
    const nowMs = Date.now();

    const activeSpeed = liveActor
      ? Math.hypot(liveActor.velocity?.[0] || 0, liveActor.velocity?.[2] || 0)
      : moveSpeed;
    const activeMoving = liveActor ? activeSpeed > 0.35 : isMoving;
    const activeSliding = liveActor ? Boolean(liveActor.sliding) : isSliding;
    const activeCrouching = liveActor ? Boolean(liveActor.crouching) : isCrouching;
    const activeStunned = liveActor
      ? Boolean(liveActor.stunnedUntil && nowMs < liveActor.stunnedUntil)
      : isStunned;
    const activeHit = liveActor
      ? Boolean(liveActor.lastHitTime && nowMs - liveActor.lastHitTime < 90)
      : isHit;

    let rootY = 0;
    let rootRotX = 0;
    let rootRotZ = 0;

    let upperBodyRotX = 0;
    let upperBodyRotY = 0;
    let upperBodyRotZ = 0;

    let leftLegRotX = 0;
    let leftLegRotZ = 0;
    let leftLegY = 0;

    let rightLegRotX = 0;
    let rightLegRotZ = 0;
    let rightLegY = 0;

    let leftArmRotX = showcasePose ? 0.15 : 0.45;
    let leftArmRotY = 0;
    let leftArmRotZ = showcasePose ? 0.12 : 0.1;

    let rightArmRotX = showcasePose ? -0.85 : 0.75;
    let rightArmRotY = showcasePose ? 0.25 : -0.2;
    let rightArmRotZ = showcasePose ? -0.25 : -0.1;

    let headRotX = 0;
    let headRotY = 0;

    if (activeStunned) {
      // 1. Stunned / Frozen animation by Lidl Scanner (10s freeze)
      const twitch = Math.sin(t * 38) * 0.04;
      rootRotZ = twitch;
      headRotX = 0.22;
      headRotY = twitch * 2.5;
      leftArmRotX = 0.15 + twitch;
      rightArmRotX = 0.25 - twitch;
    } else if (activeSliding) {
      // 2. Tactical Combat Slide Pose (Reclined torso, forward extended leg, tuck leg)
      rootY = -0.42;
      rootRotX = 0.06;
      upperBodyRotX = -0.62;
      upperBodyRotZ = -0.12;

      // Extended front leg
      leftLegRotX = -1.25;
      leftLegRotZ = -0.12;

      // Bent rear tuck leg
      rightLegRotX = 0.98;
      rightLegRotZ = 0.16;

      // Pushed forward weapon aim along slide vector
      rightArmRotX = 1.05;
      rightArmRotY = -0.15;
      leftArmRotX = 0.85;
      leftArmRotZ = 0.22;
    } else if (activeCrouching) {
      // 3. Crouching / Sneaking animation
      rootY = -0.34;
      upperBodyRotX = 0.26;
      if (activeMoving) {
        // Sneak stalking strides
        const sneakFreq = 6.8;
        const sneakAmp = 0.38;
        const stride = Math.sin(t * sneakFreq);
        leftLegRotX = 0.46 + stride * sneakAmp;
        rightLegRotX = 0.46 - stride * sneakAmp;
        upperBodyRotY = Math.sin(t * sneakFreq) * 0.05;
        rootY = -0.34 + Math.abs(stride) * 0.025;
      } else {
        leftLegRotX = 0.52;
        rightLegRotX = 0.52;
      }
      leftArmRotX = 0.55;
      rightArmRotX = 0.82;
    } else if (activeMoving) {
      // 4. Running / Walking Strides
      const isFast = activeSpeed > 4.6;
      const strideFreq = isFast ? 12.0 : 9.6;
      const strideAmp = isFast ? 0.72 : 0.54;
      const stride = Math.sin(t * strideFreq);

      leftLegRotX = stride * strideAmp;
      rightLegRotX = -stride * strideAmp;

      // Heel lift on back stride
      leftLegY = Math.max(0, -stride) * 0.06;
      rightLegY = Math.max(0, stride) * 0.06;

      // Torso bounce & counter-sway
      rootY = Math.abs(stride) * 0.065;
      upperBodyRotY = Math.sin(t * strideFreq) * 0.07;
      upperBodyRotZ = Math.sin(t * strideFreq * 0.5) * 0.04;

      // Arm swing
      leftArmRotX = -stride * 0.45 + 0.42;
      rightArmRotX = 0.75 + stride * 0.14;
      headRotY = -upperBodyRotY * 0.45;
    } else {
      // 5. Idle breathing & subtle stance shift
      const breathe = Math.sin(t * 2.2);
      rootY = breathe * 0.014;
      upperBodyRotX = breathe * 0.016;
      if (showcasePose) {
        upperBodyRotY = Math.sin(t * 0.8) * 0.04;
      }
    }

    if (activeHit) {
      upperBodyRotX -= 0.18;
      rootRotZ += (Math.random() - 0.5) * 0.12;
    }

    if (rootRef.current) {
      rootRef.current.position.y = rootY;
      rootRef.current.rotation.x = rootRotX;
      rootRef.current.rotation.z = rootRotZ;
    }
    if (upperBodyRef.current) {
      upperBodyRef.current.rotation.set(upperBodyRotX, upperBodyRotY, upperBodyRotZ);
    }
    if (leftLegPivotRef.current) {
      leftLegPivotRef.current.position.y = 0.78 + leftLegY;
      leftLegPivotRef.current.rotation.set(leftLegRotX, 0, leftLegRotZ);
    }
    if (rightLegPivotRef.current) {
      rightLegPivotRef.current.position.y = 0.78 + rightLegY;
      rightLegPivotRef.current.rotation.set(rightLegRotX, 0, rightLegRotZ);
    }
    if (leftArmPivotRef.current) {
      leftArmPivotRef.current.rotation.set(leftArmRotX, leftArmRotY, leftArmRotZ);
    }
    if (rightArmPivotRef.current) {
      rightArmPivotRef.current.rotation.set(rightArmRotX, rightArmRotY, rightArmRotZ);
    }
    if (headPivotRef.current) {
      headPivotRef.current.rotation.set(headRotX, headRotY, 0);
    }
  });

  return (
    <group>
      {/* Ground Contact Shadow Disc */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} />
      </mesh>

      <group ref={rootRef}>
        {/* LEGS HITBOX ZONES WITH HIP PIVOTS */}
        <group ref={leftLegPivotRef} position={[-0.14, 0.78, 0]}>
          <mesh
            position={[0, -0.39, 0]}
            userData={{ hitZone: 'legs' }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.21, 0.78, 0.24]} />
            <meshStandardMaterial color={uniformColor} roughness={0.75} metalness={0.1} />
          </mesh>
          {/* Tactical Boot */}
          <mesh position={[0, -0.74, 0.03]} userData={{ hitZone: 'legs' }}>
            <boxGeometry args={[0.22, 0.12, 0.28]} />
            <meshStandardMaterial color="#0e1014" roughness={0.8} />
          </mesh>
        </group>

        <group ref={rightLegPivotRef} position={[0.14, 0.78, 0]}>
          <mesh
            position={[0, -0.39, 0]}
            userData={{ hitZone: 'legs' }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.21, 0.78, 0.24]} />
            <meshStandardMaterial color={uniformColor} roughness={0.75} metalness={0.1} />
          </mesh>
          {/* Tactical Boot */}
          <mesh position={[0, -0.74, 0.03]} userData={{ hitZone: 'legs' }}>
            <boxGeometry args={[0.22, 0.12, 0.28]} />
            <meshStandardMaterial color="#0e1014" roughness={0.8} />
          </mesh>
        </group>

        {/* UPPER BODY (TORSO, VEST, ARMS, HEAD, WEAPON) */}
        <group ref={upperBodyRef} position={[0, 0.8, 0]}>
          {/* Belt & Holster */}
          <mesh position={[0, 0, 0]} userData={{ hitZone: 'body' }}>
            <boxGeometry args={[0.54, 0.09, 0.32]} />
            <meshStandardMaterial color="#111316" roughness={0.5} metalness={0.3} />
          </mesh>

          {/* Torso & Kevlar Vest */}
          <mesh
            position={[0, 0.32, 0]}
            userData={{ hitZone: 'body' }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.52, 0.64, 0.3]} />
            <meshStandardMaterial color={uniformColor} roughness={0.7} metalness={0.15} />
          </mesh>

          <mesh
            position={[0, 0.32, 0]}
            userData={{ hitZone: 'body' }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.55, 0.54, 0.34]} />
            <meshStandardMaterial color={vestColor} roughness={0.5} metalness={0.25} />
          </mesh>

          <mesh position={[0, 0.44, 0.175]} userData={{ hitZone: 'body' }}>
            <boxGeometry args={[0.36, 0.07, 0.02]} />
            <meshStandardMaterial
              color={teamAccentColor}
              emissive={teamAccentColor}
              emissiveIntensity={0.25}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.44, -0.175]} userData={{ hitZone: 'body' }}>
            <boxGeometry args={[0.36, 0.07, 0.02]} />
            <meshStandardMaterial
              color={teamAccentColor}
              emissive={teamAccentColor}
              emissiveIntensity={0.25}
              roughness={0.4}
            />
          </mesh>

          {[-0.15, 0, 0.15].map((px) => (
            <mesh key={px} position={[px, 0.16, 0.18]} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.11, 0.17, 0.06]} />
              <meshStandardMaterial color="#0b0c0e" roughness={0.5} />
            </mesh>
          ))}

          {outlineHex && (
            <mesh position={[0, 0.3, 0]} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.59, 0.68, 0.37]} />
              <meshBasicMaterial color={outlineHex} wireframe transparent opacity={0.45} />
            </mesh>
          )}

          {/* Left Arm Pivot */}
          <group ref={leftArmPivotRef} position={[-0.35, 0.35, 0.06]}>
            <mesh
              position={[0, -0.22, 0]}
              userData={{ hitZone: 'body' }}
              castShadow
            >
              <boxGeometry args={[0.17, 0.52, 0.17]} />
              <meshStandardMaterial color={uniformColor} roughness={0.75} />
            </mesh>
            <mesh position={[-0.03, -0.5, 0.06]} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.15, 0.15, 0.16]} />
              <meshStandardMaterial color="#121417" roughness={0.6} />
            </mesh>
          </group>

          {/* Right Arm Pivot & Weapon */}
          <group ref={rightArmPivotRef} position={[0.35, 0.35, 0.12]}>
            <mesh
              position={[0, -0.22, 0]}
              userData={{ hitZone: 'body' }}
              castShadow
            >
              <boxGeometry args={[0.17, 0.52, 0.17]} />
              <meshStandardMaterial color={uniformColor} roughness={0.75} />
            </mesh>

            {/* Held Weapon Mount */}
            <group
              position={showcasePose ? [-0.01, 0.36, 0.1] : [-0.11, -0.16, 0.20]}
              rotation={showcasePose ? [0.95, 0.2, 0.55] : [0, Math.PI, 0]}
              scale={showcasePose ? 1.05 : 0.9}
            >
              <WeaponModelGeometry weaponId={weaponClass} />
            </group>
          </group>

          {/* HEAD HITBOX ZONE WITH PIVOT */}
          <group ref={headPivotRef} position={[0, 0.72, 0]}>
            <mesh
              position={[0, 0.08, 0]}
              userData={{ isHead: true, hitZone: 'head' }}
              castShadow
            >
              <boxGeometry args={[0.32, 0.34, 0.32]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.04, 0.025]} userData={{ isHead: true, hitZone: 'head' }}>
              <boxGeometry args={[0.33, 0.14, 0.31]} />
              <meshStandardMaterial color="#5c4028" roughness={0.85} />
            </mesh>
            <mesh position={[-0.07, 0.10, 0.165]} userData={{ isHead: true, hitZone: 'head' }}>
              <boxGeometry args={[0.045, 0.032, 0.01]} />
              <meshBasicMaterial color="#1a1c1e" />
            </mesh>
            <mesh position={[0.07, 0.10, 0.165]} userData={{ isHead: true, hitZone: 'head' }}>
              <boxGeometry args={[0.045, 0.032, 0.01]} />
              <meshBasicMaterial color="#1a1c1e" />
            </mesh>

            <mesh position={[0, 0.23, 0]} userData={{ isHead: true, hitZone: 'head' }}>
              <boxGeometry args={[0.34, 0.1, 0.34]} />
              <meshStandardMaterial color={capColor} roughness={0.65} />
            </mesh>
            <mesh
              position={[0, 0.19, 0.21]}
              rotation={[0.1, 0, 0]}
              userData={{ isHead: true, hitZone: 'head' }}
            >
              <boxGeometry args={[0.32, 0.035, 0.14]} />
              <meshStandardMaterial color={capColor} roughness={0.65} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function ActorBillboardLabel({
  name,
  team,
  hpRatio,
  isStunned,
  isTeammate,
  hasLineOfSight = true,
}: {
  name: string;
  team: 'alpha' | 'bravo';
  hpRatio: number;
  isStunned: boolean;
  isTeammate: boolean;
  hasLineOfSight?: boolean;
}) {
  // Quantize HP ratio to 40 steps (2.5%) to cache textures efficiently while remaining silky smooth
  const quantizedHp = Math.round(Math.max(0, Math.min(1, hpRatio)) * 40) / 40;
  const tex = useMemo(
    () => createNameplateTexture(name, team, quantizedHp, isStunned),
    [name, team, quantizedHp, isStunned]
  );

  // Requirement: "Seine Teammates kann man natürlich durch Wände sehen, seine Gegner natürlich nicht."
  // If enemy is behind a wall or occluded, do not render their nameplate
  if (!isTeammate && !hasLineOfSight) {
    return null;
  }

  return (
    <sprite
      position={[0, 2.18, 0]}
      scale={[1.45, 0.54, 1]}
      renderOrder={isTeammate ? 999 : 1}
    >
      <spriteMaterial
        map={tex}
        transparent
        depthTest={!isTeammate}
      />
    </sprite>
  );
}

/**
 * 5 Campus E-Scooters parked near the Bike Racks (max 5 on the map).
 * Players can walk up and press [E] to mount and ride them at 13.8 m/s.
 */
function CampusScooters() {
  const scooters = useGameStore((s) => s.scooters);
  const ridingScooterId = useGameStore((s) => s.ridingScooterId);
  const nearbyScooterId = useGameStore((s) => s.nearbyScooterId);
  const screen = useGameStore((s) => s.screen);

  const badgeTex = useMemo(() => createScooterBadgeTexture(), []);

  return (
    <>
      {scooters.map((sc: MapScooterState) => {
        // Hide world mesh of the scooter the local player is currently riding (rendered as 1st-person handlebar)
        if (sc.id === ridingScooterId) return null;
        const isNearby = sc.id === nearbyScooterId && screen === 'playing';

        return (
          <group
            key={sc.id}
            position={sc.position}
            rotation={[0, sc.rotationY, 0]}
          >
            {/* E-Scooter Deck Platform */}
            <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.24, 0.05, 0.96]} />
              <meshStandardMaterial color="#181c24" roughness={0.5} metalness={0.6} />
            </mesh>
            {/* Electric Blue/Lime Side Trim */}
            <mesh position={[0, 0.13, 0]}>
              <boxGeometry args={[0.25, 0.02, 0.88]} />
              <meshStandardMaterial
                color="#0050aa"
                emissive="#2b7fff"
                emissiveIntensity={0.4}
              />
            </mesh>
            {/* Front & Rear Wheels */}
            <mesh position={[0, 0.11, -0.42]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
              <meshStandardMaterial color="#0d0f12" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.11, 0.42]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
              <meshStandardMaterial color="#0d0f12" roughness={0.8} />
            </mesh>
            {/* Steering Stem Column */}
            <mesh position={[0, 0.66, -0.36]} rotation={[-0.14, 0, 0]} castShadow>
              <cylinderGeometry args={[0.024, 0.028, 1.08, 12]} />
              <meshStandardMaterial color="#272c35" roughness={0.35} metalness={0.8} />
            </mesh>
            {/* Handlebar */}
            <mesh position={[0, 1.16, -0.43]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.52, 12]} />
              <meshStandardMaterial color="#111317" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* LED Headlight */}
            <mesh position={[0, 1.12, -0.46]}>
              <boxGeometry args={[0.05, 0.04, 0.03]} />
              <meshBasicMaterial color="#fef08a" />
            </mesh>

            {/* Floating [E] E-Scooter fahren Prompt when player is nearby */}
            {isNearby && (
              <sprite position={[0, 1.65, 0]} scale={[1.8, 0.45, 1]}>
                <spriteMaterial map={badgeTex} transparent depthTest={false} />
              </sprite>
            )}
          </group>
        );
      })}
    </>
  );
}

/**
 * Animated High-Speed Bullet Projectile Streaks (replaces static lines in space).
 */
function AnimatedBulletStreaks({ tracers }: { tracers: BulletTracer[] }) {
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});

  useFrame(() => {
    const now = performance.now();
    for (const t of tracers) {
      const mesh = meshRefs.current[t.id];
      if (!mesh) continue;
      const progress = Math.min(1, (now - t.createdAt) / Math.max(16, t.durationMs));
      const sx = t.start[0] + (t.end[0] - t.start[0]) * progress;
      const sy = t.start[1] + (t.end[1] - t.start[1]) * progress;
      const sz = t.start[2] + (t.end[2] - t.start[2]) * progress;
      mesh.position.set(sx, sy, sz);
    }
  });

  return (
    <>
      {tracers.map((t) => {
        const startVec = new THREE.Vector3(...t.start);
        const endVec = new THREE.Vector3(...t.end);
        const totalDist = startVec.distanceTo(endVec);
        const streakLen = Math.min(2.6, Math.max(0.5, totalDist * 0.32));
        const orientation = new THREE.Matrix4();
        orientation.lookAt(startVec, endVec, new THREE.Vector3(0, 1, 0));
        const rot = new THREE.Euler().setFromRotationMatrix(orientation);

        return (
          <mesh
            key={t.id}
            ref={(el) => {
              meshRefs.current[t.id] = el;
            }}
            position={t.start}
            rotation={rot}
          >
            <boxGeometry args={[0.018, 0.018, streakLen]} />
            <meshBasicMaterial color={t.color || '#fde047'} transparent opacity={0.92} />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Persistent 3D Bullet Hole Decals (Einschusslöcher) aligned flush with surface normals.
 */
function BulletHoleDecals({ decals }: { decals: BulletHoleDecalData[] }) {
  return (
    <>
      {decals.map((d) => {
        const pos = new THREE.Vector3(...d.position);
        const norm = new THREE.Vector3(...d.normal).normalize();
        // Offset 0.008m along surface normal to prevent z-fighting
        const offsetPos = pos.clone().addScaledVector(norm, 0.008);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          norm
        );

        return (
          <group
            key={d.id}
            position={[offsetPos.x, offsetPos.y, offsetPos.z]}
            quaternion={quat}
          >
            {/* Outer scorched impact ring */}
            <mesh>
              <circleGeometry args={[0.068, 12]} />
              <meshBasicMaterial
                color="#26292e"
                transparent
                opacity={0.78}
                depthWrite={false}
              />
            </mesh>
            {/* Deep dark bullet entry hole */}
            <mesh position={[0, 0, 0.002]}>
              <circleGeometry args={[0.032, 10]} />
              <meshBasicMaterial color="#07080a" depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function RemoteActorsAndBots({
  onSpawnTracer,
}: {
  onSpawnTracer?: (
    start: [number, number, number],
    end: [number, number, number],
    color?: string
  ) => void;
}) {
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const selectedModeId = useGameStore((s) => s.selectedModeId);
  const enemyOutline = useGameStore((s) => s.settings.enemyOutline);
  const screen = useGameStore((s) => s.screen);
  const { camera } = useThree();
  const { world, rapier } = useRapier();

  const groupRefs = useRef<Record<string, THREE.Group | null>>({});
  const renderStatesRef = useRef<
    Record<
      string,
      {
        pos: [number, number, number];
        yaw: number;
        initialized: boolean;
      }
    >
  >({});
  const botTimersRef = useRef<Record<string, number>>({});
  const botHeadingsRef = useRef<Record<string, number>>({});
  const losMapRef = useRef<Record<string, boolean>>({});

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    const elapsed = state.clock.elapsedTime;
    const nowPerf = performance.now();
    const nowMs = Date.now();

    // Check line-of-sight for each actor so enemies behind walls never show nameplates
    if (world && rapier) {
      try {
        Object.values(store.remotePlayers).forEach((actor: RemoteActor) => {
          const isTeammate = actor.team === store.playerTeam && store.selectedModeId !== 'FFA';
          if (isTeammate) {
            losMapRef.current[actor.id] = true;
            return;
          }
          const toX = actor.position[0] - camera.position.x;
          const toY = actor.position[1] + 1.5 - camera.position.y;
          const toZ = actor.position[2] - camera.position.z;
          const dist = Math.hypot(toX, toY, toZ) || 1;
          const ray = new rapier.Ray(
            { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            { x: toX / dist, y: toY / dist, z: toZ / dist }
          );
          const hit = world.castRay(ray, Math.max(0.5, dist - 0.6), true);
          losMapRef.current[actor.id] = !hit || hit.timeOfImpact >= dist - 0.7;
        });
      } catch {
        // Fallback
      }
    }

    Object.values(store.remotePlayers).forEach((actor: RemoteActor) => {
      const grp = groupRefs.current[actor.id];
      if (!grp) return;

      const isActorStunned =
        actor.stunnedUntil !== undefined && nowMs < actor.stunnedUntil;

      // If stunned by Lidl Barcode Scanner, freeze bot/actor completely for 10 seconds!
      if (isActorStunned) {
        grp.position.set(
          actor.position[0],
          actor.position[1],
          actor.position[2]
        );
        return;
      }

      if (actor.isBot && store.screen === 'playing' && store.selectedModeId === 'BOTS') {
        const seed = actor.id.charCodeAt(actor.id.length - 1);
        if (botHeadingsRef.current[actor.id] === undefined) {
          botHeadingsRef.current[actor.id] = actor.rotation[1] || seed;
        }

        const toPlayerX = camera.position.x - actor.position[0];
        const toPlayerZ = camera.position.z - actor.position[2];
        const distToPlayer = Math.hypot(toPlayerX, toPlayerZ) || 1;
        const desiredYaw = Math.atan2(toPlayerX, toPlayerZ);

        // Check line-of-sight and wall clearance using Rapier Raycasts so bots NEVER walk through walls
        let moveYaw = botHeadingsRef.current[actor.id];
        if (actor.botArchetype === 'rusher' && distToPlayer > 7) {
          moveYaw = desiredYaw;
        } else if (actor.botArchetype === 'strafer') {
          moveYaw = desiredYaw + Math.sin(elapsed * 1.8 + seed) * 1.35;
        } else {
          moveYaw = botHeadingsRef.current[actor.id] + Math.sin(elapsed * 0.9 + seed) * 0.4 * dt;
        }

        // When low on health (hp < 40), bot retreats toward cover
        if (actor.hp < 40) {
          moveYaw = desiredYaw + Math.PI * 0.85;
        }

        const dirX = Math.sin(moveYaw);
        const dirZ = Math.cos(moveYaw);
        let wallBlocked = false;
        let hasLineOfSightToPlayer = true;

        if (world && rapier) {
          try {
            // 1. Wall obstacle detection ray at chest height (1.0m) in movement direction
            const moveRay = new rapier.Ray(
              {
                x: actor.position[0],
                y: actor.position[1] + 1.0,
                z: actor.position[2],
              },
              { x: dirX, y: 0, z: dirZ }
            );
            const wallHit = world.castRay(moveRay, 2.2, true);
            if (wallHit && wallHit.timeOfImpact < 1.8) {
              wallBlocked = true;
              // Turn smoothly away from the wall
              botHeadingsRef.current[actor.id] = moveYaw + Math.PI * 0.62;
            } else {
              botHeadingsRef.current[actor.id] = moveYaw;
            }

            // 2. Line-of-sight ray toward player so bots cannot shoot through walls
            const losRay = new rapier.Ray(
              {
                x: actor.position[0],
                y: actor.position[1] + 1.5,
                z: actor.position[2],
              },
              {
                x: toPlayerX / distToPlayer,
                y: (camera.position.y - (actor.position[1] + 1.5)) / distToPlayer,
                z: toPlayerZ / distToPlayer,
              }
            );
            const losHit = world.castRay(losRay, Math.max(0.5, distToPlayer - 0.8), true);
            if (losHit && losHit.timeOfImpact < distToPlayer - 1.0) {
              hasLineOfSightToPlayer = false;
            }
          } catch {
            // Ignore raycast errors during physics step transitions
          }
        }

        // Also block AI Bot line-of-sight if player or bot is inside a Vape Smoke Cloud
        if (hasLineOfSightToPlayer && store.smokeClouds.length > 0) {
          for (const cloud of store.smokeClouds) {
            const distPlayerToSmoke = Math.hypot(
              camera.position.x - cloud.position[0],
              camera.position.z - cloud.position[2]
            );
            const distBotToSmoke = Math.hypot(
              actor.position[0] - cloud.position[0],
              actor.position[2] - cloud.position[2]
            );
            if (distPlayerToSmoke <= cloud.radius || distBotToSmoke <= cloud.radius) {
              hasLineOfSightToPlayer = false;
              break;
            }
          }
        }

        const isRusherSliding =
          actor.botArchetype === 'rusher' &&
          distToPlayer > 8 &&
          distToPlayer < 18 &&
          Math.sin(elapsed * 1.6 + seed) > 0.72;
        actor.sliding = isRusherSliding;
        actor.crouching =
          actor.botArchetype === 'anchor'
            ? distToPlayer < 35 && hasLineOfSightToPlayer
            : !isRusherSliding && Math.sin(elapsed * 0.35 + seed) > 0.78;

        const botSpeed = wallBlocked
          ? 0
          : isRusherSliding
            ? 7.2
            : actor.botArchetype === 'rusher'
              ? 5.2
              : 4.0;
        const tx = actor.position[0] + dirX * botSpeed * dt;
        const tz = actor.position[2] + dirZ * botSpeed * dt;
        actor.velocity = [dirX * botSpeed, 0, dirZ * botSpeed];

        const [rx, rz] = resolveArenaCollisions(
          tx,
          actor.position[1] + 0.9,
          tz,
          0.45,
          ARENA_COLLIDERS,
          225
        );
        actor.position = [rx, actor.position[1], rz];
        actor.targetPosition = [rx, actor.position[1], rz];

        actor.rotation = [0, hasLineOfSightToPlayer ? desiredYaw : moveYaw];

        // Weapon-specific fire rates, damage, range, and accuracy for Tactical AI
        let fireInterval = 1.35;
        let botDamage = 16;
        let effectiveRange = 38;
        let tracerColor = '#fde047';

        if (actor.weaponClass === 'sniper') {
          fireInterval = 2.1 + (seed % 2) * 0.4;
          botDamage = 50;
          effectiveRange = 65;
          tracerColor = '#fbbf24';
        } else if (actor.weaponClass === 'semi_sniper') {
          fireInterval = 1.1 + (seed % 2) * 0.3;
          botDamage = 26;
          effectiveRange = 55;
          tracerColor = '#facc15';
        } else if (actor.weaponClass === 'assault') {
          fireInterval = 0.9 + (seed % 2) * 0.25;
          botDamage = 16;
          effectiveRange = 40;
          tracerColor = '#fde047';
        } else if (actor.weaponClass === 'smg') {
          fireInterval = 0.65 + (seed % 2) * 0.2;
          botDamage = 12;
          effectiveRange = 26;
          tracerColor = '#fef08a';
        } else if (actor.weaponClass === 'shotgun') {
          fireInterval = 1.4;
          botDamage = 38;
          effectiveRange = 14;
          tracerColor = '#f97316';
        } else if (actor.weaponClass === 'lidl_scanner') {
          fireInterval = 2.2;
          botDamage = 0;
          effectiveRange = 5.5;
          tracerColor = '#fff000';
        }

        const lastBotShot = botTimersRef.current[actor.id] || 0;
        if (
          actor.team !== store.playerTeam &&
          hasLineOfSightToPlayer &&
          !store.isEliminated &&
          distToPlayer <= effectiveRange &&
          elapsed - lastBotShot > fireInterval
        ) {
          botTimersRef.current[actor.id] = elapsed;
          soundEngine.playShot(actor.weaponClass);

          if (onSpawnTracer) {
            onSpawnTracer(
              [actor.position[0], actor.position[1] + 1.25, actor.position[2]],
              [
                camera.position.x + (Math.random() - 0.5) * 0.5,
                camera.position.y + (Math.random() - 0.5) * 0.3,
                camera.position.z + (Math.random() - 0.5) * 0.5,
              ],
              tracerColor
            );
          }

          if (actor.weaponClass === 'lidl_scanner') {
            store.applyPlayerStun(10000);
          } else {
            const damageWithDist = Math.max(
              6,
              Math.round(botDamage * (1 - (distToPlayer / effectiveRange) * 0.35))
            );
            store.applyPlayerDamage(damageWithDist, {
              name: actor.name,
              team: actor.team,
              hp: actor.hp,
              maxHp: actor.maxHp,
              weaponClass: actor.weaponClass,
            });
          }
        }

        grp.position.set(actor.position[0], actor.position[1], actor.position[2]);
        grp.rotation.set(0, actor.rotation[1], 0);
      } else if (!actor.isBot) {
        // 60-240 FPS Continuous Dead-Reckoning Velocity Extrapolation + Exponential Spring Smoother
        let rState = renderStatesRef.current[actor.id];
        if (!rState || !rState.initialized) {
          rState = {
            pos: [
              actor.targetPosition[0],
              actor.targetPosition[1],
              actor.targetPosition[2],
            ],
            yaw: actor.rotation[1] || 0,
            initialized: true,
          };
          renderStatesRef.current[actor.id] = rState;
        }

        const packetAgeSec = Math.min(
          0.04,
          Math.max(0, (nowPerf - (actor.lastUpdatePerfMs || nowPerf)) / 1000)
        );
        const vx = actor.velocity?.[0] || 0;
        const vy = actor.velocity?.[1] || 0;
        const vz = actor.velocity?.[2] || 0;

        // Sub-frame dead-reckoning between 60 FPS WebRTC DataChannel ticks
        const predX = actor.targetPosition[0] + vx * packetAgeSec * 0.5;
        const predY = Math.max(0.08, actor.targetPosition[1] + vy * packetAgeSec * 0.35);
        const predZ = actor.targetPosition[2] + vz * packetAgeSec * 0.5;

        const distError = Math.hypot(
          predX - rState.pos[0],
          predY - rState.pos[1],
          predZ - rState.pos[2]
        );

        if (distError > 8.5) {
          // Instant snap ONLY on actual respawn/teleport across the arena
          rState.pos[0] = predX;
          rState.pos[1] = predY;
          rState.pos[2] = predZ;
        } else {
          // Smooth 60-240 FPS critically-damped tracking with velocity feed-forward
          rState.pos[0] += vx * dt * 0.35;
          rState.pos[2] += vz * dt * 0.35;
          rState.pos[0] = THREE.MathUtils.damp(rState.pos[0], predX, 28, dt);
          rState.pos[1] = THREE.MathUtils.damp(rState.pos[1], predY, 30, dt);
          rState.pos[2] = THREE.MathUtils.damp(rState.pos[2], predZ, 28, dt);
        }

        // Shortest-arc angular yaw interpolation (prevents 360-degree spin at +/-PI boundary)
        const targetYaw = actor.rotation[1] || 0;
        const angleDiff = Math.atan2(
          Math.sin(targetYaw - rState.yaw),
          Math.cos(targetYaw - rState.yaw)
        );
        rState.yaw = THREE.MathUtils.damp(rState.yaw, rState.yaw + angleDiff, 24, dt);

        actor.position[0] = rState.pos[0];
        actor.position[1] = rState.pos[1];
        actor.position[2] = rState.pos[2];

        grp.position.set(rState.pos[0], rState.pos[1], rState.pos[2]);
        grp.rotation.set(0, rState.yaw, 0);
      }
    });
  });

  if (screen !== 'playing' && screen !== 'paused') {
    return null;
  }

  const nowMs = Date.now();

  return (
    <>
      {Object.values(remotePlayers).map((actor) => {
        const isTeammate = actor.team === playerTeam && selectedModeId !== 'FFA';
        const isRecentlyHit =
          actor.lastHitTime !== undefined && nowMs - actor.lastHitTime < 90;
        const isStunned =
          actor.stunnedUntil !== undefined && nowMs < actor.stunnedUntil;
        const speed = Math.hypot(actor.velocity?.[0] || 0, actor.velocity?.[2] || 0);
        const isMoving = speed > 0.35;
        const isSliding = Boolean(actor.sliding);
        const isCrouching = Boolean(actor.crouching);

        return (
          <group
            key={actor.id}
            ref={(el) => {
              if (el && !groupRefs.current[actor.id]) {
                el.position.set(
                  actor.position[0],
                  actor.position[1],
                  actor.position[2]
                );
                el.rotation.set(0, actor.rotation[1] || 0, 0);
              }
              groupRefs.current[actor.id] = el;
            }}
            userData={{ actorId: actor.id }}
          >
            <TacticalSoldierMesh
              team={actor.team}
              weaponClass={actor.weaponClass}
              isHit={isRecentlyHit}
              isStunned={isStunned}
              outlineColor={!isTeammate ? enemyOutline : 'None'}
              isMoving={isMoving}
              isSliding={isSliding}
              isCrouching={isCrouching}
              moveSpeed={speed}
              liveActor={actor}
            />

            {screen === 'playing' && (
              <ActorBillboardLabel
                name={actor.name}
                team={actor.team}
                hpRatio={actor.hp / actor.maxHp}
                isStunned={isStunned}
                isTeammate={isTeammate}
                hasLineOfSight={losMapRef.current[actor.id] ?? true}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

export function MainMenuHeroShowcase() {
  const heroGroupRef = useRef<THREE.Group>(null);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const equippedSoldierSkin = useGameStore((s) => s.equippedSoldierSkin);
  const { camera } = useThree();

  useFrame((state) => {
    const grp = heroGroupRef.current;
    if (!grp) return;

    grp.position.copy(camera.position);
    grp.quaternion.copy(camera.quaternion);
    grp.translateZ(-2.65);
    grp.translateY(-1.08);
    grp.translateX(-0.18);
    grp.rotateY(Math.sin(state.clock.elapsedTime * 1.1) * 0.06 - 0.12);
  });

  return (
    <group ref={heroGroupRef} scale={1.1}>
      <pointLight position={[0.4, 2.1, 1.5]} intensity={3.2} distance={10} color="#ffffff" />
      <TacticalSoldierMesh
        team="alpha"
        weaponClass={selectedClass}
        soldierSkin={equippedSoldierSkin}
        showcasePose={true}
      />
    </group>
  );
}

function createLidlSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Lidl Blue Background Square/Banner
    ctx.fillStyle = '#0050aa';
    ctx.fillRect(0, 0, 512, 256);

    // Yellow Circle with Red Rim
    ctx.beginPath();
    ctx.arc(256, 128, 108, 0, Math.PI * 2);
    ctx.fillStyle = '#fff000';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#e60014';
    ctx.stroke();

    // Bold LIDL Typography
    ctx.font = '900 84px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0050aa';
    ctx.fillText('LIDL', 256, 132);

    // Red dot on the 'i'
    ctx.beginPath();
    ctx.arc(217, 88, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#e60014';
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Iconic 3D Illuminated LIDL Supermarket Signage mounted on the new Supermarket building
 * (`X: -138.3 .. -92.1, Y: 0 .. 7.8, Z: -19.1 .. 7.1`) and a tall parking lot pylon sign.
 */
function LidlSupermarketSignage() {
  const signTex = useMemo(() => createLidlSignTexture(), []);

  return (
    <group>
      {/* East Facade Illuminated LIDL Sign above the Supermarket Entrance */}
      <mesh position={[-91.9, 6.2, -6.0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[7.2, 3.2, 0.25]} />
        <meshBasicMaterial map={signTex} />
      </mesh>
      {/* Tall Roadside LIDL Pylon Sign at the Supermarket Vorplatz */}
      <group position={[-84.5, 0, 6.5]}>
        <mesh position={[0, 5.5, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.35, 11, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, 10.6, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[4.4, 2.2, 0.45]} />
          <meshBasicMaterial map={signTex} />
        </mesh>
      </group>
    </group>
  );
}

function createPickupBadgeTexture(type: PickupItemType): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    const borderColor =
      type === 'vape_smoke'
        ? '#06b6d4'
        : type === 'kong_strong'
          ? '#facc15'
          : '#f59e0b';
    const label =
      type === 'vape_smoke'
        ? '💨 VAPE [Q]'
        : type === 'kong_strong'
          ? '⚡ KONG STRONG (+SPEED)'
          : '🥐 SCHOKO-CROISSANT (+HP)';

    ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
    ctx.fillRect(8, 12, 240, 40);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(8, 12, 240, 40);
    ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 128, 38);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 3D Model of a Vape-Pen (for Smoke Grenades / Rauchgranaten).
 */
export function VapePen3DModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* Main Sleek Anodized Vape Body (Cyan/Magenta Gradient Look) */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.048, 0.32, 16]} />
        <meshStandardMaterial
          color="#06b6d4"
          roughness={0.25}
          metalness={0.75}
          emissive="#0891b2"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Neon Magenta Mid Band */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.09, 16]} />
        <meshStandardMaterial
          color="#ec4899"
          roughness={0.3}
          metalness={0.6}
          emissive="#db2777"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Metallic Silver Airflow Ring */}
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.03, 16]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.92} />
      </mesh>
      {/* Ergonomic Black Flat Duckbill Mouthpiece */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.068, 0.095, 0.038]} />
        <meshStandardMaterial color="#111318" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Glowing Cyan LED Puff Ring at Base */}
      <mesh position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.022, 16]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
    </group>
  );
}

/**
 * 3D Model of a Kong Strong Energy Drink Can (Dose).
 */
export function KongStrongCan3DModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* Main Aluminum Can Cylinder (Royal Blue & Red Kong Strong Design) */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.36, 20]} />
        <meshStandardMaterial
          color="#003da5"
          roughness={0.28}
          metalness={0.82}
          emissive="#002b75"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Red Energy Stripe Band */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.097, 0.097, 0.14, 20]} />
        <meshStandardMaterial
          color="#e60014"
          roughness={0.3}
          metalness={0.7}
          emissive="#b91c1c"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Gold Kong Emblem Chest Plate */}
      <mesh position={[0, 0.22, 0.092]}>
        <boxGeometry args={[0.1, 0.09, 0.018]} />
        <meshStandardMaterial
          color="#facc15"
          roughness={0.25}
          metalness={0.88}
          emissive="#eab308"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Beveled Silver Top Rim & Lid */}
      <mesh position={[0, 0.405, 0]}>
        <cylinderGeometry args={[0.086, 0.095, 0.02, 20]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.18} metalness={0.95} />
      </mesh>
      {/* Silver Pull-Tab on Top Lid */}
      <mesh position={[0, 0.418, 0.015]}>
        <boxGeometry args={[0.036, 0.006, 0.055]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.15} metalness={0.95} />
      </mesh>
      {/* Silver Bottom Rim */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.095, 0.086, 0.02, 20]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.18} metalness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * 3D Model of a Schoko-Croissant (Flaky Golden Crescent Pastry with Dark Chocolate Stripes & Tips).
 */
export function SchokoCroissant3DModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale} position={[0, 0.16, 0]}>
      {/* Center Thick Golden Pastry Segment */}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.078, 0.12, 8, 14]} />
        <meshStandardMaterial color="#d97706" roughness={0.62} metalness={0.05} />
      </mesh>
      {/* Left & Right Curved Crescent Segments */}
      <mesh
        position={[-0.13, 0.025, 0.055]}
        rotation={[0.35, 0.48, Math.PI / 2 - 0.25]}
        castShadow
      >
        <capsuleGeometry args={[0.062, 0.1, 8, 12]} />
        <meshStandardMaterial color="#b45309" roughness={0.65} metalness={0.05} />
      </mesh>
      <mesh
        position={[0.13, 0.025, 0.055]}
        rotation={[0.35, -0.48, Math.PI / 2 + 0.25]}
        castShadow
      >
        <capsuleGeometry args={[0.062, 0.1, 8, 12]} />
        <meshStandardMaterial color="#b45309" roughness={0.65} metalness={0.05} />
      </mesh>
      {/* Chocolate-Dipped Crescent Tips (Left & Right) */}
      <mesh
        position={[-0.21, 0.01, 0.13]}
        rotation={[0.5, 0.85, Math.PI / 2 - 0.4]}
      >
        <capsuleGeometry args={[0.044, 0.07, 8, 10]} />
        <meshStandardMaterial color="#3b1d0e" roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh
        position={[0.21, 0.01, 0.13]}
        rotation={[0.5, -0.85, Math.PI / 2 + 0.4]}
      >
        <capsuleGeometry args={[0.044, 0.07, 8, 10]} />
        <meshStandardMaterial color="#3b1d0e" roughness={0.42} metalness={0.12} />
      </mesh>
      {/* Dark Chocolate Drizzle Stripes across the top */}
      {[-0.07, 0, 0.07].map((ox) => (
        <mesh key={ox} position={[ox, 0.115, 0.01]} rotation={[0.2, 0.3, 0]}>
          <boxGeometry args={[0.024, 0.016, 0.14]} />
          <meshStandardMaterial color="#2e1509" roughness={0.35} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

const SMOKE_PUFF_OFFSETS: [number, number, number, number][] = [
  // 1. Central Core Column (High density, vertical billowing)
  [0, 1.4, 0, 3.8],
  [0, 3.2, 0, 4.2],
  [0, 4.8, 0, 3.8],

  // 2. Inner Ring (r ~ 3.2m - 4.8m)
  [3.2, 1.4, 2.0, 3.6],
  [-3.4, 1.5, 2.2, 3.7],
  [2.4, 1.2, -3.0, 3.5],
  [-2.8, 1.4, -2.6, 3.6],
  [0.9, 3.4, 1.2, 3.4],
  [-1.2, 3.2, -1.0, 3.4],
  [4.2, 1.8, -0.5, 3.3],
  [-4.1, 1.7, 0.6, 3.3],
  [0.5, 1.5, 4.2, 3.4],
  [-0.6, 1.5, -4.0, 3.4],

  // 3. Mid-Span Billow Ring (r ~ 5.6m - 7.6m)
  [5.8, 1.6, 2.4, 3.8],
  [-6.0, 1.7, 2.7, 3.8],
  [5.0, 1.4, -4.0, 3.6],
  [-5.3, 1.6, -3.8, 3.7],
  [2.1, 1.8, 6.0, 3.7],
  [-2.3, 1.7, 5.9, 3.7],
  [2.4, 1.5, -6.1, 3.6],
  [-2.6, 1.6, -5.8, 3.6],
  [4.0, 3.4, -2.4, 3.2],
  [-3.8, 3.2, 2.6, 3.2],
  [0, 4.2, 3.6, 3.1],
  [0, 4.1, -3.7, 3.1],

  // 4. Outer Perimeter Expanding to full 10.5m radius!
  [8.4, 1.6, 1.4, 4.0],
  [-8.5, 1.6, 1.5, 4.0],
  [1.5, 1.5, 8.4, 4.0],
  [-1.6, 1.5, -8.5, 4.0],
  [6.4, 1.7, 6.2, 3.9],
  [-6.5, 1.7, 6.3, 3.9],
  [6.5, 1.6, -6.4, 3.8],
  [-6.4, 1.6, -6.5, 3.8],
  [8.0, 2.5, -3.0, 3.4],
  [-8.1, 2.5, 3.1, 3.4],
  [3.0, 2.7, 8.0, 3.4],
  [-3.1, 2.7, -8.1, 3.4],
];

/**
 * Renders Ground Pickups (Vapes, Kong Strong cans, Schoko-Croissants),
 * flying Vape projectiles, and dense volumetric 3D Smoke Clouds.
 */
function GroundPickupsAndSmoke() {
  const mapPickups = useGameStore((s) => s.mapPickups);
  const thrownVapes = useGameStore((s) => s.thrownVapes);
  const smokeClouds = useGameStore((s) => s.smokeClouds);

  const pickupGroupRefs = useRef<Record<string, THREE.Group | null>>({});
  const smokeGroupRefs = useRef<Record<string, THREE.Group | null>>({});

  const vapeBadge = useMemo(() => createPickupBadgeTexture('vape_smoke'), []);
  const kongBadge = useMemo(() => createPickupBadgeTexture('kong_strong'), []);
  const croissantBadge = useMemo(() => createPickupBadgeTexture('choco_croissant'), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const nowMs = Date.now();

    for (const item of mapPickups) {
      const grp = pickupGroupRefs.current[item.id];
      if (!grp) continue;
      grp.position.set(
        item.position[0],
        item.position[1] + Math.sin(t * 2.6 + item.rotationY) * 0.06,
        item.position[2]
      );
      grp.rotation.y = item.rotationY + t * 1.35;
    }

    for (const cloud of smokeClouds) {
      const grp = smokeGroupRefs.current[cloud.id];
      if (!grp) continue;
      const ageMs = nowMs - cloud.createdAt;
      const expandFactor = Math.min(1, ageMs / 650);
      const scale = 0.35 + expandFactor * 0.65;
      grp.scale.set(scale, scale, scale);
      grp.rotation.y = t * 0.18;
    }
  });

  return (
    <>
      {/* Ground Pickups on the Map (Max 5 Vapes, Max 5 Kong Strong, Max 5 Schoko-Croissants) */}
      {mapPickups.map((item: GroundPickupItem) => {
        const ringColor =
          item.type === 'vape_smoke'
            ? '#06b6d4'
            : item.type === 'kong_strong'
              ? '#facc15'
              : '#f59e0b';
        const badgeTex =
          item.type === 'vape_smoke'
            ? vapeBadge
            : item.type === 'kong_strong'
              ? kongBadge
              : croissantBadge;

        return (
          <group
            key={item.id}
            ref={(el) => {
              pickupGroupRefs.current[item.id] = el;
            }}
            position={item.position}
          >
            {/* Glowing Ground Pickup Pad Ring */}
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.32, 0.44, 24]} />
              <meshBasicMaterial
                color={ringColor}
                transparent
                opacity={0.75}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            {item.type === 'vape_smoke' && <VapePen3DModel scale={1.35} />}
            {item.type === 'kong_strong' && <KongStrongCan3DModel scale={1.25} />}
            {item.type === 'choco_croissant' && <SchokoCroissant3DModel scale={1.35} />}

            {/* Floating Item Label */}
            <sprite position={[0, 0.92, 0]} scale={[1.65, 0.42, 1]}>
              <spriteMaterial map={badgeTex} transparent depthTest={false} />
            </sprite>
          </group>
        );
      })}

      {/* Flying Thrown Vape Projectiles ([Q]) */}
      {thrownVapes.map((proj: ThrownVapeState) => (
        <group
          key={proj.id}
          position={proj.position}
          rotation={[proj.position[1] * 4, proj.position[0] * 2, proj.position[2] * 3]}
        >
          <VapePen3DModel scale={1.3} />
        </group>
      ))}

      {/* Volumetric 3D Vape Smoke Clouds (Rauchbereiche) */}
      {smokeClouds.map((cloud: SmokeCloudState) => (
        <group
          key={cloud.id}
          ref={(el) => {
            smokeGroupRefs.current[cloud.id] = el;
          }}
          position={cloud.position}
        >
          {/* Dropped Emitting Vape at Center of Smoke Cloud */}
          <group position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0.4, 0]}>
            <VapePen3DModel scale={1.2} />
          </group>

          {/* Billowing Volumetric Smoke Puffs */}
          {SMOKE_PUFF_OFFSETS.map(([ox, oy, oz, rad], idx) => (
            <mesh key={idx} position={[ox, oy, oz]}>
              <icosahedronGeometry args={[rad, 2]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#e2e8f0' : '#cbd5e1'}
                roughness={0.95}
                metalness={0.0}
                transparent
                opacity={0.72}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function InteriorBuildingLights() {
  const graphicsPreset = useGameStore((s) => s.settings.graphicsPreset);
  const isUltra = graphicsPreset === 'ultra';

  return (
    <group name="interior_building_lights">
      {/* 1. Lidl Supermarket Ceiling Lighting Array */}
      <pointLight position={[-102, 4.0, -6]} intensity={isUltra ? 3.0 : 1.8} distance={16} decay={2} color="#fff6e5" />
      <pointLight position={[-118, 4.0, -6]} intensity={isUltra ? 3.0 : 1.8} distance={16} decay={2} color="#fff6e5" />
      <pointLight position={[-132, 4.0, -6]} intensity={isUltra ? 3.0 : 1.8} distance={16} decay={2} color="#fff6e5" />

      {/* 2. Covered Campus Corridors, Walkways & Spawn Interiors */}
      <pointLight position={[-44, 3.6, 12]} intensity={isUltra ? 2.4 : 1.4} distance={14} decay={2} color="#f0f6ff" />
      <pointLight position={[-25, 3.6, 28]} intensity={isUltra ? 2.2 : 1.2} distance={12} decay={2} color="#fff0db" />
      <pointLight position={[28, 3.6, -32]} intensity={isUltra ? 2.4 : 1.4} distance={14} decay={2} color="#eef4ff" />
      <pointLight position={[-15, 3.6, -46]} intensity={isUltra ? 2.2 : 1.2} distance={12} decay={2} color="#fff4e8" />
    </group>
  );
}

export function TacticalArenaScene({
  tracers,
  bulletHoles,
  onSpawnTracer,
  onSpawnBulletHole,
  isSoftwareGl = false,
}: {
  tracers: BulletTracer[];
  bulletHoles: BulletHoleDecalData[];
  onSpawnTracer: (
    start: [number, number, number],
    end: [number, number, number],
    color?: string
  ) => void;
  onSpawnBulletHole: (
    position: [number, number, number],
    normal: [number, number, number]
  ) => void;
  isSoftwareGl?: boolean;
}) {
  const selectedMapId = useGameStore((s) => s.selectedMapId);
  const screen = useGameStore((s) => s.screen);
  const graphicsPreset = useGameStore((s) => s.settings.graphicsPreset);

  const mapDef = useMemo(
    () => MAPS.find((m) => m.id === selectedMapId) || MAPS[0],
    [selectedMapId]
  );

  useFrame((state) => {
    if (screen !== 'playing' && screen !== 'paused') {
      const t = state.clock.elapsedTime * 0.22;
      state.camera.position.set(14 + Math.sin(t) * 2.2, 2.8, 14 + Math.cos(t) * 2.2);
      state.camera.lookAt(0, 2.6, 0);
    }
  });

  const isUltra = graphicsPreset === 'ultra' && !isSoftwareGl;
  const shadowResolution = isUltra ? 4096 : 1024;

  return (
    <>
      <color attach="background" args={[mapDef.skyColor]} />
      <fog attach="fog" args={[mapDef.fogColor, isUltra ? 70 : 55, isUltra ? 340 : 280]} />

      {/* Atmospheric Sky Dome in Ultra Preset */}
      {isUltra && (
        <Sky
          distance={450000}
          sunPosition={[45, 80, 30]}
          inclination={0.52}
          azimuth={0.25}
        />
      )}

      {/* Dynamic PBR Lighting Architecture */}
      <PbrEnvironmentSetup
        isSoftwareGl={isSoftwareGl}
        graphicsPreset={graphicsPreset}
      />

      {/* Subtle deep ambient light so covered interiors are moodier and darker than the outside */}
      <ambientLight color="#9ab7d9" intensity={isUltra ? 0.22 : 0.40} />
      <hemisphereLight args={['#8fb3df', '#231e1a', isUltra ? 0.28 : 0.32]} />

      {/* High-Definition Sun Directional Light with Soft Shadows */}
      <directionalLight
        position={[45, 80, 30]}
        intensity={isUltra ? 2.25 : 1.6}
        color="#fff5e8"
        castShadow={isUltra}
        shadow-mapSize={[shadowResolution, shadowResolution]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-bias={-0.00012}
        shadow-normalBias={0.02}
      />

      {/* Dedicated Atmospheric Interior Building Lights for Lidl & Campus Hallways */}
      <InteriorBuildingLights />

      {/* Final 3D GLB Map Integration (./assets/map.glb) */}
      <MapEnvironment mapUrl={mapDef.glbUrl || './assets/map.glb'} />

      {/* Illuminated 3D LIDL Signage on the Supermarket Building & Vorplatz */}
      <LidlSupermarketSignage />

      {/* Rare Campus E-Scooters (max 2 active, 20s ride duration) */}
      <CampusScooters />

      {/* Ground Pickups (Vapes, Kong Strong Cans, Schoko-Croissants) & 3D Vape Smoke Clouds */}
      <GroundPickupsAndSmoke />

      {/* Persistent 3D Bullet Hole Decals on Walls & Objects */}
      <BulletHoleDecals decals={bulletHoles} />

      {/* Animated High-Speed Projectile Streaks */}
      <AnimatedBulletStreaks tracers={tracers} />

      {/* Remote Players & Tactical Bots */}
      <RemoteActorsAndBots onSpawnTracer={onSpawnTracer} />

      {/* Floating 3D Stacking Damage Numbers */}
      <FloatingDamageIndicators />

      {/* First-Person Player Controller & Weapon */}
      {screen === 'playing' && (
        <PlayerController
          arenaColliders={ARENA_COLLIDERS}
          onSpawnTracer={onSpawnTracer}
          onSpawnBulletHole={onSpawnBulletHole}
        />
      )}
    </>
  );
}
