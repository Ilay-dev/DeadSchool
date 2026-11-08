import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import {
  WEAPON_CLASSES,
  type WeaponId,
} from '../../game/rules';

function TacticalForearmAndGlove({
  gripPos = [-0.025, -0.03, -0.18],
  sleevePos = [-0.055, -0.14, -0.06],
  isAds = false,
}: {
  gripPos?: [number, number, number];
  sleevePos?: [number, number, number];
  isAds?: boolean;
}) {
  return (
    <group>
      {/* Black Tactical Glove gripping forend (matches Screenshots 1 & 2) */}
      <mesh position={gripPos} rotation={[0.28, 0.22, 0.05]}>
        <boxGeometry args={[0.072, 0.072, 0.125]} />
        <meshStandardMaterial color="#111317" roughness={0.82} metalness={0.08} />
      </mesh>
      {/* Knuckle guard plate */}
      <mesh
        position={[gripPos[0] - 0.012, gripPos[1] + 0.015, gripPos[2]]}
        rotation={[0.28, 0.22, 0.05]}
      >
        <boxGeometry args={[0.076, 0.035, 0.085]} />
        <meshStandardMaterial color="#1c2026" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Olive/Dark Grey Tactical Jacket Sleeve (hidden in ADS so it never blocks peripheral view) */}
      {!isAds && (
        <mesh position={sleevePos} rotation={[0.68, 0.16, -0.12]}>
          <cylinderGeometry args={[0.044, 0.055, 0.25, 12]} />
          <meshStandardMaterial color="#2b2d28" roughness={0.88} metalness={0.04} />
        </mesh>
      )}
      {/* Right hand glove on pistol grip */}
      {!isAds && (
        <mesh position={[0.012, -0.065, 0.05]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.062, 0.08, 0.075]} />
          <meshStandardMaterial color="#111317" roughness={0.82} metalness={0.08} />
        </mesh>
      )}
    </group>
  );
}

function getWeaponSkinPalette(
  skinId: string,
  defaultPrimary: string,
  defaultSecondary: string,
  defaultAccent: string
) {
  switch (skinId) {
    case 'dragon_flame':
      return {
        primary: '#b91c1c',
        secondary: '#ea580c',
        accent: '#facc15',
        metalness: 0.55,
        roughness: 0.28,
        emissive: '#7f1d1d',
        emissiveIntensity: 0.15,
      };
    case 'cyber_neon':
      return {
        primary: '#090d16',
        secondary: '#06b6d4',
        accent: '#d946ef',
        metalness: 0.75,
        roughness: 0.22,
        emissive: '#0891b2',
        emissiveIntensity: 0.18,
      };
    case 'gold_midnight':
      return {
        primary: '#111215',
        secondary: '#f59e0b',
        accent: '#fbbf24',
        metalness: 0.92,
        roughness: 0.15,
        emissive: '#b45309',
        emissiveIntensity: 0.1,
      };
    case 'arctic_glacier':
      return {
        primary: '#f0f9ff',
        secondary: '#38bdf8',
        accent: '#0284c7',
        metalness: 0.35,
        roughness: 0.3,
        emissive: '#bae6fd',
        emissiveIntensity: 0.08,
      };
    case 'obsidian_stealth':
      return {
        primary: '#08090b',
        secondary: '#181b20',
        accent: '#27272a',
        metalness: 0.85,
        roughness: 0.38,
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'lidl_edition':
      return {
        primary: '#0050aa',
        secondary: '#fff000',
        accent: '#e60014',
        metalness: 0.35,
        roughness: 0.35,
        emissive: '#003580',
        emissiveIntensity: 0.1,
      };
    default:
      return {
        primary: defaultPrimary,
        secondary: defaultSecondary,
        accent: defaultAccent,
        metalness: 0.65,
        roughness: 0.45,
        emissive: '#000000',
        emissiveIntensity: 0,
      };
  }
}

export function LidlLogoDecal({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Blue Outer Disc
      ctx.fillStyle = '#0050aa';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();

      // Yellow Center Disc with Red Rim
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.fillStyle = '#fff000';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#e60014';
      ctx.stroke();

      // Bold LIDL Letters
      ctx.font = '900 42px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0050aa';
      ctx.fillText('LIDL', 64, 66);

      // Red Dot on 'i'
      ctx.beginPath();
      ctx.arc(44, 44, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e60014';
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <planeGeometry args={[0.07, 0.07]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function WeaponModelGeometry({
  weaponId,
  isAds = false,
  skinId = 'default',
}: {
  weaponId: WeaponId;
  isAds?: boolean;
  skinId?: string;
}) {
  const stats = WEAPON_CLASSES[weaponId];
  const sightColor = useGameStore((s) => s.settings.sightColor);
  const sightHex =
    sightColor === 'Green' ? '#22c55e' : sightColor === 'Cyan' ? '#06b6d4' : '#ef4444';

  if (weaponId === 'fist') {
    // Tactical Bare-Knuckle Boxer Fists Guard
    return (
      <group position={[0, -0.06, -0.24]}>
        {/* Right Punching Fist */}
        <group position={[0.14, -0.04, 0.02]} rotation={[0.15, -0.22, 0.1]}>
          {/* Fist Clenched Hand */}
          <mesh castShadow>
            <boxGeometry args={[0.075, 0.072, 0.09]} />
            <meshStandardMaterial color="#1f242c" roughness={0.7} metalness={0.2} />
          </mesh>
          {/* Knuckle Armor Plate */}
          <mesh position={[0, 0.025, -0.04]}>
            <boxGeometry args={[0.07, 0.024, 0.022]} />
            <meshStandardMaterial color="#374151" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0.02, -0.08, 0.12]} rotation={[-0.45, 0.1, 0]}>
            <cylinderGeometry args={[0.042, 0.048, 0.22, 10]} />
            <meshStandardMaterial color="#111827" roughness={0.8} />
          </mesh>
        </group>

        {/* Left Defensive Guard Fist */}
        <group position={[-0.14, 0.02, 0.06]} rotation={[0.25, 0.25, -0.12]}>
          {/* Fist Clenched Hand */}
          <mesh castShadow>
            <boxGeometry args={[0.075, 0.072, 0.09]} />
            <meshStandardMaterial color="#1f242c" roughness={0.7} metalness={0.2} />
          </mesh>
          {/* Knuckle Armor Plate */}
          <mesh position={[0, 0.025, -0.04]}>
            <boxGeometry args={[0.07, 0.024, 0.022]} />
            <meshStandardMaterial color="#374151" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Forearm */}
          <mesh position={[-0.02, -0.08, 0.12]} rotation={[-0.45, -0.1, 0]}>
            <cylinderGeometry args={[0.042, 0.048, 0.22, 10]} />
            <meshStandardMaterial color="#111827" roughness={0.8} />
          </mesh>
        </group>
      </group>
    );
  }

  if (weaponId === 'lidl_scanner') {
    // Iconic Lidl Handheld Barcode Scanner with official Lidl Emblem
    return (
      <group>
        {/* Ergonomic Pistol Handle in Lidl Blue */}
        <mesh position={[0, -0.065, 0.02]} rotation={[-0.28, 0, 0]} castShadow>
          <boxGeometry args={[0.046, 0.145, 0.056]} />
          <meshStandardMaterial color="#0050aa" roughness={0.35} metalness={0.2} />
        </mesh>
        {/* Yellow Trigger Button */}
        <mesh position={[0, -0.025, -0.015]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.028, 0.042, 0.025]} />
          <meshStandardMaterial
            color="#fff000"
            emissive="#eab308"
            emissiveIntensity={0.25}
            roughness={0.3}
          />
        </mesh>
        {/* Upper Scanner Head Housing (Lidl Blue) */}
        <mesh position={[0, 0.028, -0.055]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.078, 0.068, 0.185]} />
          <meshStandardMaterial color="#0050aa" roughness={0.3} metalness={0.25} />
        </mesh>
        {/* Lidl Yellow & Red Side Brand Stripes */}
        <mesh position={[0, 0.032, -0.055]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.082, 0.022, 0.13]} />
          <meshStandardMaterial color="#fff000" roughness={0.35} />
        </mesh>
        {/* Official Lidl Round Logos on both left and right flanks */}
        <LidlLogoDecal position={[-0.042, 0.034, -0.05]} rotation={[0, -Math.PI / 2, 0]} scale={0.7} />
        <LidlLogoDecal position={[0.042, 0.034, -0.05]} rotation={[0, Math.PI / 2, 0]} scale={0.7} />
        <mesh position={[0, 0.032, -0.055]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.084, 0.008, 0.132]} />
          <meshStandardMaterial color="#e60014" roughness={0.3} />
        </mesh>
        {/* Top Status LED & OLED Price Display ("4.0m STUN - 10s") */}
        <mesh position={[0, 0.065, -0.005]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[0.054, 0.008, 0.046]} />
          <meshStandardMaterial
            color="#0a192f"
            emissive="#22c55e"
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* Rubberized Front Bumper Ring (Lidl Red) */}
        <mesh position={[0, 0.024, -0.15]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.086, 0.074, 0.026]} />
          <meshStandardMaterial color="#e60014" roughness={0.5} />
        </mesh>
        {/* Glowing Red Laser Barcode Emitter Window */}
        <mesh position={[0, 0.024, -0.164]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.068, 0.042, 0.006]} />
          <meshBasicMaterial color="#ff1e1e" />
        </mesh>
        {/* Persistent Laser Aiming Line */}
        <mesh position={[0, 0.024, -0.34]}>
          <boxGeometry args={[0.06, 0.0025, 0.34]} />
          <meshBasicMaterial color="#ff1e1e" transparent opacity={0.65} />
        </mesh>
        {/* Coiled POS Cable at base */}
        {!isAds && (
          <mesh position={[0, -0.14, 0.045]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
            <meshStandardMaterial color="#181a1f" roughness={0.7} />
          </mesh>
        )}
        <TacticalForearmAndGlove
          gripPos={[-0.018, -0.06, 0.015]}
          sleevePos={[-0.04, -0.16, 0.08]}
          isAds={isAds}
        />
      </group>
    );
  }

  if (weaponId === 'smg') {
    const skin = getWeaponSkinPalette(skinId, '#e4dfd5', '#14161a', '#dcd7cc');
    // KRISS Vector Two-Tone Cream/Black SMG with Authentic EOTech Holographic Sight (Images 3 & 4)
    return (
      <group>
        {/* 1. Main upper chassis in Bone-White / Cream polymer or Equipped Skin */}
        <mesh position={[0, 0.024, -0.05]} castShadow>
          <boxGeometry args={[0.062, 0.09, 0.34]} />
          <meshStandardMaterial
            color={skin.primary}
            roughness={skin.roughness}
            metalness={skin.metalness}
            emissive={skin.emissive}
            emissiveIntensity={skin.emissiveIntensity}
          />
        </mesh>

        {/* 2. Full-length Black Picatinny Top Rail with Transverse Ribs (Image 3 & 4) */}
        <mesh position={[0, 0.072, -0.06]}>
          <boxGeometry args={[0.046, 0.012, 0.36]} />
          <meshStandardMaterial color="#121417" roughness={0.35} metalness={0.85} />
        </mesh>
        {/* Transverse Grooved Teeth along top rail */}
        {[-0.22, -0.19, -0.16, -0.13, -0.1, -0.07, -0.04, -0.01, 0.02, 0.05, 0.08].map((rz) => (
          <mesh key={rz} position={[0, 0.078, rz]}>
            <boxGeometry args={[0.048, 0.003, 0.014]} />
            <meshStandardMaterial color="#0b0c0e" roughness={0.4} metalness={0.9} />
          </mesh>
        ))}

        {/* 3. Oval Fire Selector Dial on receiver side (Image 3) */}
        <mesh position={[-0.033, 0.024, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.004, 12]} />
          <meshStandardMaterial color="#131518" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0.033, 0.024, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.004, 12]} />
          <meshStandardMaterial color="#131518" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* 4. Super-V Angled Lower Recoil Chassis & Magwell in Matte Black */}
        <mesh position={[0, -0.058, -0.11]} rotation={[0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.056, 0.165, 0.11]} />
          <meshStandardMaterial color="#14161a" roughness={0.45} metalness={0.65} />
        </mesh>
        {/* Cream or Skin accent inlays */}
        <mesh position={[0.029, -0.062, -0.1]} rotation={[0.16, 0, 0]}>
          <boxGeometry args={[0.004, 0.12, 0.08]} />
          <meshStandardMaterial color={skin.accent} roughness={skin.roughness} metalness={skin.metalness} />
        </mesh>
        <mesh position={[-0.029, -0.062, -0.1]} rotation={[0.16, 0, 0]}>
          <boxGeometry args={[0.004, 0.12, 0.08]} />
          <meshStandardMaterial color={skin.accent} roughness={skin.roughness} metalness={skin.metalness} />
        </mesh>

        {/* 5. Authentic Extended 40-round Stick Magazine with Bumper Baseplate & Witness Windows */}
        <group position={[0, -0.185, -0.135]} rotation={[0.16, 0, 0]}>
          {/* Main Stick Body */}
          <mesh>
            <boxGeometry args={[0.034, 0.23, 0.048]} />
            <meshStandardMaterial color="#1a1c22" roughness={0.45} metalness={0.65} />
          </mesh>
          {/* Witness Round Indicator Window along rear edge */}
          <mesh position={[0, -0.01, 0.024]}>
            <boxGeometry args={[0.012, 0.16, 0.003]} />
            <meshStandardMaterial color="#0f1115" roughness={0.8} />
          </mesh>
          {/* Brass cartridge indicators inside window */}
          {[-0.06, -0.02, 0.02, 0.06].map((wz) => (
            <mesh key={wz} position={[0, wz, 0.025]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.003, 0.003, 0.006, 8]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.9} />
            </mesh>
          ))}
          {/* Flared Heavy Polymer Bumper Baseplate */}
          <mesh position={[0, -0.118, 0.003]}>
            <boxGeometry args={[0.042, 0.022, 0.058]} />
            <meshStandardMaterial color="#0f1013" roughness={0.7} metalness={0.3} />
          </mesh>
          {/* Baseplate grip ridges */}
          {[-0.012, 0.012].map((bx) => (
            <mesh key={bx} position={[bx, -0.126, 0.003]}>
              <boxGeometry args={[0.004, 0.006, 0.048]} />
              <meshStandardMaterial color="#0b0c0e" roughness={0.8} />
            </mesh>
          ))}
        </group>

        {/* 6. Barrel Shroud & Compensator */}
        <mesh position={[0, 0.025, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.12, 14]} />
          <meshStandardMaterial color="#111316" roughness={0.25} metalness={0.9} />
        </mesh>

        {/* 7. Folding Stock Adapter at Rear (hidden in ADS) */}
        {!isAds && (
          <mesh position={[0, -0.01, 0.14]}>
            <boxGeometry args={[0.046, 0.08, 0.08]} />
            <meshStandardMaterial color="#131518" roughness={0.5} metalness={0.6} />
          </mesh>
        )}

        {/* 8. Authentic EOTech Holographic Sight Housing (Images 3 & 4) */}
        <group position={[0, 0.08, -0.05]}>
          {/* Base clamp on Picatinny rail */}
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.054, 0.016, 0.12]} />
            <meshStandardMaterial color="#181a1e" roughness={0.35} metalness={0.8} />
          </mesh>

          {/* Optical Window Cutout (Hollow Inner Aperture - solid center block removed!) */}
          {/* Top hood roof */}
          <mesh position={[0, 0.076, 0]}>
            <boxGeometry args={[0.058, 0.009, 0.112]} />
            <meshStandardMaterial color="#101114" roughness={0.3} metalness={0.82} />
          </mesh>
          {/* Left upright pillar */}
          <mesh position={[-0.026, 0.046, 0]}>
            <boxGeometry args={[0.009, 0.055, 0.112]} />
            <meshStandardMaterial color="#101114" roughness={0.3} metalness={0.82} />
          </mesh>
          {/* Right upright pillar */}
          <mesh position={[0.026, 0.046, 0]}>
            <boxGeometry args={[0.009, 0.055, 0.112]} />
            <meshStandardMaterial color="#101114" roughness={0.3} metalness={0.82} />
          </mesh>

          {/* Rear Control Panel Faceplate (exact match to Image 4!) */}
          <group position={[0, 0.022, 0.055]}>
            {/* Panel backing */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.052, 0.028, 0.004]} />
              <meshStandardMaterial color="#181a1d" roughness={0.5} metalness={0.7} />
            </mesh>
            {/* Top Center Circular "NV" Button (Image 4) */}
            <mesh position={[0, 0.006, 0.002]}>
              <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
              <meshStandardMaterial color="#0e0f11" roughness={0.7} />
            </mesh>
            {/* Left & Right Square Brightness Arrow Buttons (Image 4) */}
            <mesh position={[-0.012, -0.006, 0.002]}>
              <boxGeometry args={[0.008, 0.008, 0.003]} />
              <meshStandardMaterial color="#0c0d0f" roughness={0.7} />
            </mesh>
            <mesh position={[0.012, -0.006, 0.002]}>
              <boxGeometry args={[0.008, 0.008, 0.003]} />
              <meshStandardMaterial color="#0c0d0f" roughness={0.7} />
            </mesh>
            {/* 4 Corner Cross-Head Screws (Image 4) */}
            {[-0.02, 0.02].map((sx) =>
              [-0.008, 0.008].map((sy) => (
                <mesh key={`${sx}_${sy}`} position={[sx, sy, 0.002]}>
                  <circleGeometry args={[0.0028, 8]} />
                  <meshStandardMaterial color="#2c3038" roughness={0.3} metalness={0.9} />
                </mesh>
              ))
            )}
          </group>

          {/* Clear Optical Glass Lens inside EOTech Window */}
          <mesh position={[0, 0.048, 0]}>
            <boxGeometry args={[0.044, 0.044, 0.002]} />
            <meshPhysicalMaterial
              color="#e0f2fe"
              transparent
              opacity={0.08}
              roughness={0.02}
              metalness={0.05}
              transmission={0.92}
              ior={1.5}
            />
          </mesh>

          {/* Glowing Red Laser Dot Reticle centered in holographic window */}
          <group position={[0, 0.048, 0]}>
            {/* Subtle outer holographic ring (thin and clean) */}
            <mesh>
              <ringGeometry args={[0.012, 0.0135, 24]} />
              <meshBasicMaterial color="#ff2222" transparent opacity={0.85} />
            </mesh>
            {/* 4 Cardinal Crosshair Ticks */}
            {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((rot, idx) => (
              <mesh key={idx} rotation={[0, 0, rot]} position={[0, 0, 0]}>
                <boxGeometry args={[0.0014, 0.005, 0.001]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            ))}
            {/* Bright Center Aiming Laser Dot */}
            <mesh>
              <sphereGeometry args={[0.003, 12, 12]} />
              <meshBasicMaterial color="#ff1111" />
            </mesh>
          </group>
        </group>

        {/* 9. Gloved Hands gripping weapon */}
        <TacticalForearmAndGlove
          gripPos={[-0.02, -0.042, -0.14]}
          sleevePos={[-0.048, -0.13, -0.04]}
          isAds={isAds}
        />
      </group>
    );
  }

  if (weaponId === 'sniper') {
    const skin = getWeaponSkinPalette(skinId, '#475634', '#15171a', '#101215');
    // Tactical Olive-Drab AWP Sniper Rifle (Image 2)
    // In ADS (Image 1), the rifle switches to the fullscreen circular sniper scope HUD overlay
    if (isAds) {
      return null;
    }

    return (
      <group>
        {/* 1. Classic AWP / L96 Olive Drab Green Synthetic Stock or Skin (Image 2) */}
        <mesh position={[0, -0.014, -0.1]} castShadow>
          <boxGeometry args={[0.06, 0.092, 0.46]} />
          <meshStandardMaterial
            color={skin.primary}
            roughness={skin.roughness}
            metalness={skin.metalness}
            emissive={skin.emissive}
            emissiveIntensity={skin.emissiveIntensity}
          />
        </mesh>

        {/* Ergonomic Thumbhole Stock & Rear Cheek Piece in Black (Image 2) */}
        <mesh position={[0, -0.028, 0.18]} rotation={[-0.06, 0, 0]}>
          <boxGeometry args={[0.054, 0.12, 0.18]} />
          <meshStandardMaterial color={skin.primary} roughness={skin.roughness} metalness={skin.metalness} />
        </mesh>
        <mesh position={[0, 0.024, 0.16]}>
          <boxGeometry args={[0.046, 0.035, 0.13]} />
          <meshStandardMaterial color="#15171a" roughness={0.65} metalness={0.3} />
        </mesh>

        {/* 2. Top Picatinny Rail for Scope Mount */}
        <mesh position={[0, 0.042, -0.08]}>
          <boxGeometry args={[0.04, 0.012, 0.28]} />
          <meshStandardMaterial color="#141619" roughness={0.35} metalness={0.88} />
        </mesh>

        {/* 3. Dual Heavy Tactical Scope Mounting Rings (Image 2) */}
        <mesh position={[0, 0.065, -0.14]}>
          <torusGeometry args={[0.024, 0.005, 10, 20]} />
          <meshStandardMaterial color="#101215" roughness={0.3} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.065, -0.02]}>
          <torusGeometry args={[0.024, 0.005, 10, 20]} />
          <meshStandardMaterial color="#101215" roughness={0.3} metalness={0.9} />
        </mesh>

        {/* 4. Massive Tactical High-Magnification Sniper Scope (Image 2) */}
        <group position={[0, 0.065, -0.08]}>
          {/* Main 30mm Scope Body Tube */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.019, 0.019, 0.28, 18]} />
            <meshStandardMaterial color="#181a1e" roughness={0.28} metalness={0.85} />
          </mesh>

          {/* Rear Ocular Eyepiece Bell with Knurled Magnification Ring (Image 2) */}
          <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.024, 0.07, 18]} />
            <meshStandardMaterial color="#121316" roughness={0.3} metalness={0.88} />
          </mesh>
          {/* Knurled Elevation Turret Knob on top (Image 2) */}
          <mesh position={[0, 0.026, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.018, 16]} />
            <meshStandardMaterial color="#0f1013" roughness={0.4} metalness={0.85} />
          </mesh>
          {/* Knurled Windage Turret Knob on right side (Image 2) */}
          <mesh position={[0.026, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.011, 0.011, 0.018, 16]} />
            <meshStandardMaterial color="#0f1013" roughness={0.4} metalness={0.85} />
          </mesh>
          {/* Forward Objective Bell Flaring Out (Image 2) */}
          <mesh position={[0, 0, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.029, 0.022, 0.09, 18]} />
            <meshStandardMaterial color="#121316" roughness={0.28} metalness={0.88} />
          </mesh>
          {/* Rear Ocular Dark Reflection Lens facing the shooter (Image 2) */}
          <mesh position={[0, 0, 0.176]} rotation={[0, 0, 0]}>
            <circleGeometry args={[0.025, 18]} />
            <meshStandardMaterial color="#080a0d" roughness={0.1} metalness={0.95} />
          </mesh>
        </group>

        {/* 5. Heavy Long Fluted Barrel in Matte Black */}
        <mesh position={[0, 0.014, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.018, 0.54, 16]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.25} metalness={0.88} />
        </mesh>

        {/* 6. Dual-Port Heavy Muzzle Brake at barrel tip */}
        <mesh position={[0, 0.014, -0.81]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.022, 0.07, 14]} />
          <meshStandardMaterial color="#101114" roughness={0.3} metalness={0.92} />
        </mesh>

        {/* 7. Right-Side Bolt Action Handle with spherical knob (Image 2) */}
        <mesh position={[0.038, 0.026, 0.02]} rotation={[0, 0, -0.45]}>
          <cylinderGeometry args={[0.007, 0.007, 0.06, 8]} />
          <meshStandardMaterial color="#22252a" roughness={0.25} metalness={0.9} />
        </mesh>
        <mesh position={[0.062, 0.008, 0.02]}>
          <sphereGeometry args={[0.01, 10, 10]} />
          <meshStandardMaterial color="#131417" roughness={0.35} metalness={0.85} />
        </mesh>

        {/* 8. Authentic Accuracy International 5-Round Steel Box Magazine */}
        <group position={[0, -0.082, -0.06]}>
          {/* Stamped Steel Box Body */}
          <mesh>
            <boxGeometry args={[0.044, 0.095, 0.105]} />
            <meshStandardMaterial color="#181a1f" roughness={0.35} metalness={0.82} />
          </mesh>
          {/* Side Strengthening Grooves / Ribs */}
          {[-0.023, 0.023].map((sx) => (
            <mesh key={sx} position={[sx, 0, 0]}>
              <boxGeometry args={[0.002, 0.065, 0.075]} />
              <meshStandardMaterial color="#101114" roughness={0.4} metalness={0.9} />
            </mesh>
          ))}
          {/* Steel Floorplate with Finger Catch */}
          <mesh position={[0, -0.048, 0]}>
            <boxGeometry args={[0.048, 0.012, 0.112]} />
            <meshStandardMaterial color="#121316" roughness={0.3} metalness={0.88} />
          </mesh>
          {/* Front Magazine Catch Lug */}
          <mesh position={[0, 0.02, -0.054]}>
            <boxGeometry args={[0.016, 0.024, 0.008]} />
            <meshStandardMaterial color="#22252c" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>

        {/* 9. Tactical Forearms and Gloves */}
        <TacticalForearmAndGlove
          gripPos={[-0.022, -0.028, -0.22]}
          sleevePos={[-0.05, -0.12, -0.09]}
          isAds={isAds}
        />
      </group>
    );
  }

  if (weaponId === 'shotgun') {
    // Double-Barrel Break-Action Wood & Blued Steel Shotgun
    return (
      <group>
        {/* Twin side-by-side blued steel barrels */}
        <mesh position={[-0.017, 0.026, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.016, 0.52, 14]} />
          <meshStandardMaterial color={stats.primaryColor} roughness={0.24} metalness={0.86} />
        </mesh>
        <mesh position={[0.017, 0.026, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.016, 0.52, 14]} />
          <meshStandardMaterial color={stats.primaryColor} roughness={0.24} metalness={0.86} />
        </mesh>
        {/* Center ventilated rib + Brass bead front sight */}
        <mesh position={[0, 0.04, -0.28]}>
          <boxGeometry args={[0.012, 0.006, 0.5]} />
          <meshStandardMaterial color="#1c2026" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.048, -0.52]}>
          <sphereGeometry args={[0.0048, 8, 8]} />
          <meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.4} roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Full-Length High-Capacity Under-Barrel Tubular Magazine */}
        <group position={[0, 0.005, -0.28]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.48, 14]} />
            <meshStandardMaterial color="#1a1c22" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Knurled Front Magazine End Cap */}
          <mesh position={[0, 0, -0.245]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.02, 14]} />
            <meshStandardMaterial color="#121316" roughness={0.5} metalness={0.88} />
          </mesh>
          {/* Dual Heavy Barrel-to-Magazine Clamp */}
          <mesh position={[0, 0.012, -0.20]}>
            <boxGeometry args={[0.046, 0.038, 0.022]} />
            <meshStandardMaterial color="#121316" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>

        {/* Tactical Receiver Side-Saddle Shell Carrier with 4 Red 12-Gauge Shells */}
        <group position={[-0.038, 0.014, -0.01]}>
          {/* Side-Saddle Polymer Mounting Plate */}
          <mesh>
            <boxGeometry args={[0.008, 0.046, 0.12]} />
            <meshStandardMaterial color="#111317" roughness={0.6} metalness={0.4} />
          </mesh>
          {/* 4 Red 12-Gauge Shotgun Shells */}
          {[-0.042, -0.014, 0.014, 0.042].map((sz) => (
            <group key={sz} position={[-0.008, 0, sz]}>
              {/* Red Plastic Hull */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.01, 0.01, 0.022, 12]} />
                <meshStandardMaterial color="#dc2626" roughness={0.4} metalness={0.2} />
              </mesh>
              {/* Polished Brass Rim / Base */}
              <mesh position={[-0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.0105, 0.0105, 0.008, 12]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.15} metalness={0.92} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Checkered Walnut wood forend */}
        <mesh position={[0, 0.002, -0.18]}>
          <boxGeometry args={[0.068, 0.05, 0.24]} />
          <meshStandardMaterial color={stats.secondaryColor} roughness={0.58} metalness={0.08} />
        </mesh>
        {/* Engraved Steel break-action receiver */}
        <mesh position={[0, 0.012, -0.01]}>
          <boxGeometry args={[0.066, 0.076, 0.14]} />
          <meshStandardMaterial color="#323842" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Walnut shoulder stock (hidden in ADS to prevent camera clipping) */}
        {!isAds && (
          <mesh position={[0, -0.035, 0.17]} rotation={[-0.14, 0, 0]}>
            <boxGeometry args={[0.058, 0.105, 0.22]} />
            <meshStandardMaterial color={stats.secondaryColor} roughness={0.62} metalness={0.08} />
          </mesh>
        )}
        <TacticalForearmAndGlove
          gripPos={[-0.02, -0.022, -0.18]}
          sleevePos={[-0.048, -0.12, -0.07]}
          isAds={isAds}
        />
      </group>
    );
  }

  if (weaponId === 'semi_sniper') {
    const skin = getWeaponSkinPalette(skinId, stats.primaryColor, stats.secondaryColor, stats.accentColor);
    // Gold/Tan Tactical Marksman Rifle (SCAR-H / M110 DMR)
    return (
      <group>
        {/* Tan/Gold anodized receiver or equipped skin */}
        <mesh position={[0, 0.016, -0.06]} castShadow>
          <boxGeometry args={[0.064, 0.088, 0.34]} />
          <meshStandardMaterial
            color={skin.primary}
            roughness={skin.roughness}
            metalness={skin.metalness}
            emissive={skin.emissive}
            emissiveIntensity={skin.emissiveIntensity}
          />
        </mesh>
        {/* Quad-rail handguard */}
        <mesh position={[0, 0.02, -0.31]}>
          <boxGeometry args={[0.058, 0.07, 0.24]} />
          <meshStandardMaterial color={stats.accentColor} roughness={0.38} metalness={0.62} />
        </mesh>
        {/* Barrel & tactical suppressor */}
        <mesh position={[0, 0.02, -0.51]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.26, 14]} />
          <meshStandardMaterial color={stats.secondaryColor} roughness={0.22} metalness={0.88} />
        </mesh>
        {/* Modern Tactical Cantilever LPVO Marksman Scope (Low-Power Variable Optic) */}
        {isAds ? (
          <group position={[0, 0.088, -0.06]}>
            {/* Thin outer optic ring */}
            <mesh>
              <torusGeometry args={[0.032, 0.003, 14, 28]} />
              <meshStandardMaterial color="#0f1114" roughness={0.2} metalness={0.9} />
            </mesh>
            {/* Multi-coated optical glass */}
            <mesh position={[0, 0, 0.001]}>
              <circleGeometry args={[0.031, 28]} />
              <meshPhysicalMaterial
                color="#e0f2fe"
                transparent
                opacity={0.08}
                roughness={0.02}
                metalness={0.05}
                transmission={0.92}
                ior={1.5}
              />
            </mesh>
            {/* Tactical Illuminated Mil-Dot Reticle */}
            <mesh position={[0, 0, 0.002]}>
              <boxGeometry args={[0.06, 0.0008, 0.001]} />
              <meshBasicMaterial color="#ff2222" transparent opacity={0.75} />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <boxGeometry args={[0.0008, 0.06, 0.001]} />
              <meshBasicMaterial color="#ff2222" transparent opacity={0.75} />
            </mesh>
            {/* Stadia hashmarks */}
            {[-0.015, -0.008, 0.008, 0.015].map((hx) => (
              <mesh key={`hx_${hx}`} position={[hx, 0, 0.002]}>
                <boxGeometry args={[0.0006, 0.004, 0.001]} />
                <meshBasicMaterial color="#ff2222" transparent opacity={0.8} />
              </mesh>
            ))}
            {[-0.015, -0.008, 0.008, 0.015].map((hy) => (
              <mesh key={`hy_${hy}`} position={[0, hy, 0.002]}>
                <boxGeometry args={[0.004, 0.0006, 0.001]} />
                <meshBasicMaterial color="#ff2222" transparent opacity={0.8} />
              </mesh>
            ))}
            {/* Center illuminated dot */}
            <mesh position={[0, 0, 0.003]}>
              <sphereGeometry args={[0.002, 8, 8]} />
              <meshBasicMaterial color={sightHex} />
            </mesh>
          </group>
        ) : (
          <group position={[0, 0.088, -0.06]}>
            {/* CNC Cantilever Scope Mount Base clamped to rail */}
            <mesh position={[0, -0.026, -0.02]}>
              <boxGeometry args={[0.038, 0.022, 0.18]} />
              <meshStandardMaterial color="#14171d" roughness={0.3} metalness={0.85} />
            </mesh>
            {/* Dual Cantilever Rings */}
            <mesh position={[0, 0, -0.08]}>
              <torusGeometry args={[0.022, 0.0045, 10, 20]} />
              <meshStandardMaterial color="#101216" roughness={0.25} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <torusGeometry args={[0.022, 0.0045, 10, 20]} />
              <meshStandardMaterial color="#101216" roughness={0.25} metalness={0.9} />
            </mesh>
            {/* 34mm Main Tube */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.22, 18]} />
              <meshStandardMaterial color="#17191f" roughness={0.25} metalness={0.88} />
            </mesh>
            {/* Flared Objective Bell (front) */}
            <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.019, 0.06, 18]} />
              <meshStandardMaterial color="#121316" roughness={0.28} metalness={0.88} />
            </mesh>
            {/* Multi-Coated Objective Lens */}
            <mesh position={[0, 0, -0.151]}>
              <circleGeometry args={[0.023, 16]} />
              <meshStandardMaterial color="#0b1b2b" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Ocular Bell with Magnification Ring & Throw Lever (rear) */}
            <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.02, 0.06, 18]} />
              <meshStandardMaterial color="#121316" roughness={0.3} metalness={0.85} />
            </mesh>
            {/* Rapid Zoom Throw Lever */}
            <mesh position={[0.024, 0.012, 0.09]} rotation={[0, 0, -0.6]}>
              <boxGeometry args={[0.005, 0.016, 0.01]} />
              <meshStandardMaterial color="#2c3038" roughness={0.3} metalness={0.9} />
            </mesh>
            {/* Tactical Knurled Elevation Turret (Top) */}
            <mesh position={[0, 0.022, -0.02]}>
              <cylinderGeometry args={[0.01, 0.01, 0.014, 14]} />
              <meshStandardMaterial color="#0e1013" roughness={0.4} metalness={0.85} />
            </mesh>
            {/* Tactical Knurled Windage Turret (Right) */}
            <mesh position={[0.022, 0, -0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, 0.014, 14]} />
              <meshStandardMaterial color="#0e1013" roughness={0.4} metalness={0.85} />
            </mesh>
          </group>
        )}
        {/* Straight 20-rd 7.62mm marksman magazine */}
        <mesh position={[0, -0.088, -0.09]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.044, 0.15, 0.078]} />
          <meshStandardMaterial color="#1c1f24" roughness={0.42} metalness={0.68} />
        </mesh>
        {/* Precision adjustable buttstock (hidden in ADS) */}
        {!isAds && (
          <mesh position={[0, 0.005, 0.19]}>
            <boxGeometry args={[0.054, 0.098, 0.16]} />
            <meshStandardMaterial color={stats.primaryColor} roughness={0.36} metalness={0.58} />
          </mesh>
        )}
        <TacticalForearmAndGlove
          gripPos={[-0.024, -0.025, -0.21]}
          sleevePos={[-0.05, -0.12, -0.09]}
          isAds={isAds}
        />
      </group>
    );
  }

  // Default: Assault Rifle (M4A1 Carbine with Arched Reflex Sight, Grooved Picatinny Rail, A2 Front Sight & Birdcage Flash Hider - matching Images 3 & 4!)
  const skin = getWeaponSkinPalette(skinId, '#1a1c21', '#131519', '#1e2126');
  return (
    <group>
      {/* 1. Upper & lower matte-black tactical receiver or skin */}
      <mesh position={[0, 0.014, -0.05]} castShadow>
        <boxGeometry args={[0.062, 0.092, 0.28]} />
        <meshStandardMaterial
          color={skin.primary}
          roughness={skin.roughness}
          metalness={skin.metalness}
          emissive={skin.emissive}
          emissiveIntensity={skin.emissiveIntensity}
        />
      </mesh>
      {/* Brass deflector & forward assist housing on right side */}
      <mesh position={[0.034, 0.032, -0.02]} rotation={[0.2, 0.35, 0]}>
        <boxGeometry args={[0.016, 0.024, 0.045]} />
        <meshStandardMaterial color="#14161a" roughness={0.45} metalness={0.7} />
      </mesh>
      {/* Forward assist plunger knob */}
      <mesh position={[0.042, 0.038, 0.01]} rotation={[0.4, 0.5, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.025, 8]} />
        <meshStandardMaterial color="#111215" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Trigger guard & trigger */}
      <mesh position={[0, -0.052, -0.03]}>
        <boxGeometry args={[0.018, 0.028, 0.065]} />
        <meshStandardMaterial color="#15171b" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.045, -0.03]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.006, 0.02, 0.01]} />
        <meshStandardMaterial color="#0d0e11" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* 2. Top Picatinny Rail with Realistic Grooved Teeth (matching Images 3 & 4) */}
      <mesh position={[0, 0.062, -0.07]}>
        <boxGeometry args={[0.044, 0.012, 0.26]} />
        <meshStandardMaterial color="#111317" roughness={0.38} metalness={0.82} />
      </mesh>
      {/* Transverse Grooved Slots along the Picatinny rail */}
      {[-0.18, -0.15, -0.12, -0.09, -0.06, -0.03, 0.0, 0.03].map((gz) => (
        <mesh key={gz} position={[0, 0.068, gz]}>
          <boxGeometry args={[0.046, 0.004, 0.012]} />
          <meshStandardMaterial color="#0b0c0f" roughness={0.4} metalness={0.85} />
        </mesh>
      ))}

      {/* 3. Ribbed Carbine Handguard with Cooling Ribs (matching Images 3 & 4) */}
      <mesh position={[0, 0.024, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.033, 0.036, 0.22, 16]} />
        <meshStandardMaterial color={skin.secondary} roughness={0.62} metalness={skin.metalness} />
      </mesh>
      {/* Handguard radial ribs */}
      {[-0.2, -0.23, -0.26, -0.29, -0.32, -0.35].map((rz) => (
        <mesh key={rz} position={[0, 0.024, rz]}>
          <torusGeometry args={[0.035, 0.0035, 8, 16]} />
          <meshStandardMaterial color="#0e0f13" roughness={0.65} metalness={0.45} />
        </mesh>
      ))}
      {/* Top handguard rail extension */}
      <mesh position={[0, 0.06, -0.28]}>
        <boxGeometry args={[0.034, 0.01, 0.22]} />
        <meshStandardMaterial color="#111317" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* 4. Steel Barrel & A2 Birdcage Flash Hider */}
      <mesh position={[0, 0.024, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.22, 12]} />
        <meshStandardMaterial color="#21242a" roughness={0.25} metalness={0.88} />
      </mesh>
      {/* Birdcage Flash Hider with longitudinal slots */}
      <mesh position={[0, 0.024, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.017, 0.048, 14]} />
        <meshStandardMaterial color="#131518" roughness={0.3} metalness={0.92} />
      </mesh>

      {/* 5. A2 Triangular Front Sight Tower (visible in hip-fire and lower sight in ADS, Images 3 & 4) */}
      <group position={[0, 0.024, -0.41]}>
        {/* Slanted rear triangular leg */}
        <mesh position={[0, 0.042, 0.012]} rotation={[-0.42, 0, 0]}>
          <boxGeometry args={[0.012, 0.068, 0.016]} />
          <meshStandardMaterial color="#15171b" roughness={0.35} metalness={0.8} />
        </mesh>
        {/* Vertical front leg */}
        <mesh position={[0, 0.044, -0.022]}>
          <boxGeometry args={[0.012, 0.072, 0.016]} />
          <meshStandardMaterial color="#15171b" roughness={0.35} metalness={0.8} />
        </mesh>
        {/* Front sight post pin */}
        <mesh position={[0, 0.078, -0.005]}>
          <cylinderGeometry args={[0.002, 0.002, 0.018, 8]} />
          <meshStandardMaterial color="#0f1013" roughness={0.25} metalness={0.9} />
        </mesh>
        {/* Left protective ear */}
        <mesh position={[-0.01, 0.076, -0.005]} rotation={[0, 0, 0.22]}>
          <boxGeometry args={[0.003, 0.022, 0.016]} />
          <meshStandardMaterial color="#15171b" roughness={0.35} metalness={0.8} />
        </mesh>
        {/* Right protective ear */}
        <mesh position={[0.01, 0.076, -0.005]} rotation={[0, 0, -0.22]}>
          <boxGeometry args={[0.003, 0.022, 0.016]} />
          <meshStandardMaterial color="#15171b" roughness={0.35} metalness={0.8} />
        </mesh>
      </group>

      {/* 6. Sculpted Reflex Sight Housing (exact match to Images 3 & 4!) */}
      <group position={[0, 0.068, -0.06]}>
        {/* Riser Mount Base clamped to rail */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.052, 0.02, 0.088]} />
          <meshStandardMaterial color="#1c1f24" roughness={0.32} metalness={0.8} />
        </mesh>
        {/* Rail clamp bolts on left side */}
        <mesh position={[-0.028, 0.008, 0.018]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.008, 8]} />
          <meshStandardMaterial color="#2c3038" roughness={0.25} metalness={0.9} />
        </mesh>
        <mesh position={[-0.028, 0.008, -0.018]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.008, 8]} />
          <meshStandardMaterial color="#2c3038" roughness={0.25} metalness={0.9} />
        </mesh>
        {/* Rear adjustment button pads (visible in Image 3 & 4) */}
        <mesh position={[-0.012, 0.014, 0.045]}>
          <boxGeometry args={[0.012, 0.01, 0.004]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.8} />
        </mesh>
        <mesh position={[0.012, 0.014, 0.045]}>
          <boxGeometry args={[0.012, 0.01, 0.004]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.8} />
        </mesh>

        {/* Upright Reflex Frame Hood: flat bottom, vertical sides, chamfered corner bevels, flat top bridge (Image 3 & 4) */}
        {/* Bottom crossbar */}
        <mesh position={[0, 0.024, 0]}>
          <boxGeometry args={[0.054, 0.008, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>
        {/* Left vertical pillar */}
        <mesh position={[-0.026, 0.046, 0]}>
          <boxGeometry args={[0.006, 0.038, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>
        {/* Right vertical pillar */}
        <mesh position={[0.026, 0.046, 0]}>
          <boxGeometry args={[0.006, 0.038, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>
        {/* Top horizontal bridge bar */}
        <mesh position={[0, 0.066, 0]}>
          <boxGeometry args={[0.044, 0.006, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>
        {/* Left upper chamfered bevel */}
        <mesh position={[-0.021, 0.062, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.006, 0.012, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>
        {/* Right upper chamfered bevel */}
        <mesh position={[0.021, 0.062, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.006, 0.012, 0.038]} />
          <meshStandardMaterial color="#111317" roughness={0.28} metalness={0.88} />
        </mesh>

        {/* Anti-reflective coated optical glass pane inside frame */}
        <mesh position={[0, 0.046, 0]}>
          <boxGeometry args={[0.046, 0.038, 0.002]} />
          <meshPhysicalMaterial
            color="#a5f3fc"
            transparent
            opacity={0.14}
            roughness={0.05}
            metalness={0.1}
            transmission={0.88}
            ior={1.48}
          />
        </mesh>

        {/* Crisp illuminated Red Dot Reticle centered in reflex optic (Image 4) */}
        <mesh position={[0, 0.046, 0]}>
          <sphereGeometry args={[0.0028, 10, 10]} />
          <meshBasicMaterial color="#ff2222" />
        </mesh>
      </group>

      {/* 7. Curved 30-Round Magpul PMAG with Textured Grip Ribs & Flared Baseplate */}
      <group position={[0, -0.098, -0.075]} rotation={[0.22, 0, 0]}>
        {/* Upper Mag Body */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.042, 0.08, 0.072]} />
          <meshStandardMaterial color={skin.accent} roughness={0.45} metalness={skin.metalness} />
        </mesh>
        {/* Curved Lower Banana Mag Body */}
        <mesh position={[0, -0.035, -0.012]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.042, 0.11, 0.068]} />
          <meshStandardMaterial color={skin.accent} roughness={0.45} metalness={skin.metalness} />
        </mesh>
        {/* Textured Horizontal Polymer Grip Ribs */}
        {[-0.06, -0.03, 0.0, 0.03].map((my) => (
          <mesh key={my} position={[0, my, -0.012]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.046, 0.012, 0.072]} />
            <meshStandardMaterial color="#111317" roughness={0.65} metalness={0.4} />
          </mesh>
        ))}
        {/* Flared Rubberized Ranger Floorplate / Baseplate */}
        <mesh position={[0, -0.095, -0.024]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.048, 0.018, 0.078]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.8} metalness={0.2} />
        </mesh>
      </group>

      {/* 8. Collapsible M4 Buttstock (hidden in ADS so it never clips camera) */}
      {!isAds && (
        <group position={[0, 0.008, 0.18]}>
          {/* Buffer tube */}
          <mesh position={[0, 0.012, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.14, 12]} />
            <meshStandardMaterial color="#15171b" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Stock body & buttpad */}
          <mesh position={[0, -0.015, 0.04]} rotation={[-0.1, 0, 0]}>
            <boxGeometry args={[0.048, 0.11, 0.16]} />
            <meshStandardMaterial color="#131418" roughness={0.65} metalness={0.4} />
          </mesh>
        </group>
      )}

      {/* 9. Tactical Gloves & Hands gripping rifle */}
      <TacticalForearmAndGlove
        gripPos={[-0.025, -0.022, -0.21]}
        sleevePos={[-0.048, -0.125, -0.09]}
        isAds={isAds}
      />
    </group>
  );
}

const ADS_OFFSETS_BY_WEAPON: Record<WeaponId, { x: number; y: number; z: number }> = {
  // Scale-compensated by 1.12 so red dot / holographic reticle matches exact screen center (0, 0)
  assault: { x: 0.0, y: -0.12768, z: -0.52 },
  smg: { x: 0.0, y: -0.14336, z: -0.52 },
  sniper: { x: 0.0, y: 0.0, z: -0.5 },
  semi_sniper: { x: 0.0, y: -0.09856, z: -0.53 },
  shotgun: { x: 0.0, y: -0.0538, z: -0.5 },
  lidl_scanner: { x: 0.0, y: -0.075, z: -0.46 },
  fist: { x: 0.0, y: -0.08, z: -0.38 },
};

export function FirstPersonWeapon({
  recoilOffsetRef,
  muzzleFlashRef,
}: {
  recoilOffsetRef: React.MutableRefObject<{ pitch: number; yaw: number; kickBack: number }>;
  muzzleFlashRef: React.MutableRefObject<number>;
}) {
  const weaponGroupRef = useRef<THREE.Group>(null);
  const flashMeshRef = useRef<THREE.Mesh>(null);
  const { camera, scene } = useThree();

  const selectedClass = useGameStore((s) => s.selectedClass);
  const isAds = useGameStore((s) => s.isAds);
  const isEliminated = useGameStore((s) => s.isEliminated);
  const ridingScooterId = useGameStore((s) => s.ridingScooterId);
  const leftHanded = useGameStore((s) => s.settings.leftHanded);
  const baseFov = useGameStore((s) => s.settings.fov);

  const bobTimerRef = useRef(0);
  const smoothedSpeedRef = useRef(0);
  const currentAdsPosRef = useRef({ x: 0.21, y: -0.18, z: -0.44 });
  const slideTiltRef = useRef(0);

  // Parent weaponGroupRef directly to the Three.js Camera!
  // This guarantees 100% zero frame lag and zero world-space floating-point jitter during mouse rotation or movement.
  useEffect(() => {
    const group = weaponGroupRef.current;
    if (!group) return;
    camera.add(group);
    if (!camera.parent) {
      scene.add(camera);
    }
    return () => {
      camera.remove(group);
    };
  }, [camera, scene]);

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const group = weaponGroupRef.current;
    if (!group) return;

    const store = useGameStore.getState();
    const stats = WEAPON_CLASSES[store.selectedClass];

    // Smoothly interpolate Camera FOV for ADS (or wide FOV boost when sliding/riding E-Scooter)
    const perspCam = camera as THREE.PerspectiveCamera;
    const speedFovBoost = store.ridingScooterId ? 7 : store.isSliding ? 5 : 0;
    const targetFov = store.isAds ? stats.adsFov : baseFov + speedFovBoost;
    perspCam.fov = THREE.MathUtils.damp(perspCam.fov, targetFov, 16, dt);
    perspCam.updateProjectionMatrix();

    // Ultra-smooth, low-amplitude walk cadence (0.0 in ADS so aiming is 100% rock-steady)
    const isMoving =
      store.movementSpeedRatio > 0.08 && !store.isSliding && !store.ridingScooterId;
    smoothedSpeedRef.current = THREE.MathUtils.damp(
      smoothedSpeedRef.current,
      isMoving ? Math.min(1.0, store.movementSpeedRatio) : 0,
      10,
      dt
    );

    if (smoothedSpeedRef.current > 0.02) {
      const freq = store.isCrouching ? 5.5 : 8.0;
      bobTimerRef.current += dt * freq;
    }

    const bobAmp = store.isAds ? 0.0 : smoothedSpeedRef.current * 0.0022;
    const bobX = Math.cos(bobTimerRef.current) * bobAmp;
    const bobY = Math.sin(bobTimerRef.current * 2) * bobAmp * 0.8;

    // Procedural Recoil Recovery (clamped in ADS so weapon never kicks back into the camera)
    recoilOffsetRef.current.pitch = THREE.MathUtils.damp(
      recoilOffsetRef.current.pitch,
      0,
      18,
      dt
    );
    recoilOffsetRef.current.yaw = THREE.MathUtils.damp(
      recoilOffsetRef.current.yaw,
      0,
      18,
      dt
    );
    recoilOffsetRef.current.kickBack = THREE.MathUtils.damp(
      recoilOffsetRef.current.kickBack,
      0,
      20,
      dt
    );

    const handSign = leftHanded ? -1 : 1;
    const baseHipX = 0.21 * handSign;
    const baseHipY = -0.18;
    const baseHipZ = -0.44;

    const adsTarget = ADS_OFFSETS_BY_WEAPON[store.selectedClass] || ADS_OFFSETS_BY_WEAPON.assault;

    currentAdsPosRef.current.x = THREE.MathUtils.damp(
      currentAdsPosRef.current.x,
      store.isAds ? adsTarget.x : baseHipX,
      18,
      dt
    );
    currentAdsPosRef.current.y = THREE.MathUtils.damp(
      currentAdsPosRef.current.y,
      store.isAds ? adsTarget.y : baseHipY,
      18,
      dt
    );
    currentAdsPosRef.current.z = THREE.MathUtils.damp(
      currentAdsPosRef.current.z,
      store.isAds ? adsTarget.z : baseHipZ,
      18,
      dt
    );

    // Smooth tactical slide cant/tilt when sliding with Shift
    slideTiltRef.current = THREE.MathUtils.damp(
      slideTiltRef.current,
      store.isSliding && !store.isAds ? 0.28 * handSign : 0,
      14,
      dt
    );

    const reloadDropY = store.isReloading ? -0.22 : 0;
    const reloadTiltX = store.isReloading ? -0.52 : 0;
    const safeKickBack = store.isAds
      ? Math.min(0.012, recoilOffsetRef.current.kickBack * 0.35)
      : Math.min(0.035, recoilOffsetRef.current.kickBack);

    // Set pure camera-local transform (zero world-space copy lag!)
    group.position.set(
      currentAdsPosRef.current.x + bobX,
      currentAdsPosRef.current.y + bobY + reloadDropY,
      currentAdsPosRef.current.z + safeKickBack
    );

    group.rotation.set(
      recoilOffsetRef.current.pitch + reloadTiltX,
      (store.isAds ? 0 : 0.06 * handSign) + recoilOffsetRef.current.yaw,
      store.isReloading ? 0.32 * handSign : slideTiltRef.current
    );

    if (flashMeshRef.current) {
      if (muzzleFlashRef.current > 0) {
        muzzleFlashRef.current -= dt;
        flashMeshRef.current.visible = true;
        flashMeshRef.current.rotation.z += dt * 25;
      } else {
        flashMeshRef.current.visible = false;
      }
    }
  });

  const canUseWeaponOnScooter = !ridingScooterId || selectedClass === 'lidl_scanner';
  const equippedWeaponSkin = useGameStore((s) => s.equippedWeaponSkin);

  return (
    <group ref={weaponGroupRef} visible={!isEliminated} scale={1.12}>
      {canUseWeaponOnScooter && (
        <WeaponModelGeometry
          weaponId={selectedClass}
          isAds={isAds}
          skinId={equippedWeaponSkin}
        />
      )}

      {/* Muzzle Flash Star (or Red Laser Scan Pulse for Lidl Scanner) */}
      <mesh
        ref={flashMeshRef}
        position={selectedClass === 'lidl_scanner' ? [0, 0.024, -0.35] : [0, 0.025, -0.62]}
        visible={false}
      >
        {selectedClass === 'lidl_scanner' ? (
          <>
            <boxGeometry args={[0.24, 0.008, 0.65]} />
            <meshBasicMaterial color="#ff1e1e" transparent opacity={0.92} />
          </>
        ) : (
          <>
            <coneGeometry args={[0.065, 0.18, 6]} />
            <meshBasicMaterial color="#ffbe3b" transparent opacity={0.88} />
          </>
        )}
      </mesh>

      {/* First-Person E-Scooter Handlebar & Digital Speedometer when riding an E-Scooter */}
      {ridingScooterId && (
        <group
          position={
            selectedClass === 'lidl_scanner' ? [-0.22, -0.26, -0.12] : [-0.21, -0.16, -0.05]
          }
        >
          {/* Horizontal Handlebar Tube */}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.56, 12]} />
            <meshStandardMaterial color="#1c2026" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Left & Right Rubber Grips */}
          <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.14, 12]} />
            <meshStandardMaterial color="#0050aa" roughness={0.7} />
          </mesh>
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.14, 12]} />
            <meshStandardMaterial color="#0050aa" roughness={0.7} />
          </mesh>
          {/* Center Digital LED Speedometer Display */}
          <mesh position={[0, 0.032, 0.02]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[0.085, 0.015, 0.11]} />
            <meshStandardMaterial
              color="#0b1322"
              emissive="#22c55e"
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

