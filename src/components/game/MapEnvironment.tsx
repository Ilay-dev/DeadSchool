import { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import {
  isDecorativeMeshExcludedFromCollider,
  clampPbrMaterialValues,
  type SpawnPoint,
} from '../../game/rules';

export interface ParsedMeshSegment {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  isBorder: boolean;
  includeCollider: boolean;
}

const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _worldScale = new THREE.Vector3();
const _euler = new THREE.Euler();

export function MapEnvironment({
  mapUrl = './assets/map.glb',
}: {
  mapUrl?: string;
}) {
  const { scene } = useGLTF(mapUrl);
  const registerSpawnPoints = useGameStore((s) => s.registerSpawnPoints);
  const [segments, setSegments] = useState<ParsedMeshSegment[]>([]);

  useEffect(() => {
    if (!scene) return;

    scene.updateMatrixWorld(true);

    const discoveredSpawns: SpawnPoint[] = [];
    const parsedMeshes: ParsedMeshSegment[] = [];

    scene.traverse((child: THREE.Object3D) => {
      const nodeName = child.name || '';

      // 2A. Automatic Spawn-Point Parsing (Spawn_01_Main_Plaza_South ... Spawn_08_Overpass_Bridge)
      if (nodeName.startsWith('Spawn_')) {
        child.getWorldPosition(_worldPos);
        child.getWorldQuaternion(_worldQuat);
        _euler.setFromQuaternion(_worldQuat, 'YXZ');

        discoveredSpawns.push({
          name: nodeName,
          position: [_worldPos.x, _worldPos.y, _worldPos.z],
          rotationY: _euler.y,
        });

        // Ensure spawn empties never leave visible meshes in the game world
        child.visible = false;
        return;
      }

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const isBorder = nodeName.toLowerCase() === 'border';

        // 2B. Border mesh as invisible wall
        if (isBorder) {
          mesh.visible = false;
        }

        // 3B.3 PBR Material Standardization (roughness >= 0.35, metalness <= 0.8, shadows enabled)
        const standardizeMaterial = (mat: THREE.Material) => {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (stdMat && stdMat.isMeshStandardMaterial) {
            const clamped = clampPbrMaterialValues(stdMat.roughness, stdMat.metalness);
            stdMat.roughness = clamped.roughness;
            stdMat.metalness = clamped.metalness;
            stdMat.envMapIntensity = 0.65;
            stdMat.needsUpdate = true;
          }
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(standardizeMaterial);
        } else if (mesh.material) {
          standardizeMaterial(mesh.material);
        }

        mesh.castShadow = !isBorder;
        mesh.receiveShadow = !isBorder;

        mesh.getWorldPosition(_worldPos);
        mesh.getWorldQuaternion(_worldQuat);
        mesh.getWorldScale(_worldScale);

        const includeCollider =
          isBorder || !isDecorativeMeshExcludedFromCollider(nodeName);

        parsedMeshes.push({
          id: `${nodeName}_${mesh.uuid}`,
          name: nodeName,
          geometry: mesh.geometry,
          material: mesh.material,
          position: [_worldPos.x, _worldPos.y, _worldPos.z],
          quaternion: [_worldQuat.x, _worldQuat.y, _worldQuat.z, _worldQuat.w],
          scale: [_worldScale.x, _worldScale.y, _worldScale.z],
          isBorder,
          includeCollider,
        });
      }
    });

    if (discoveredSpawns.length > 0) {
      if (!discoveredSpawns.some((s) => s.name === 'Spawn_09_Lidl_Supermarket')) {
        discoveredSpawns.push({
          name: 'Spawn_09_Lidl_Supermarket',
          position: [-86, 0.15, -6],
          rotationY: -Math.PI * 0.5,
        });
      }
      discoveredSpawns.sort((a, b) => a.name.localeCompare(b.name));
      registerSpawnPoints(discoveredSpawns);
    }

    setSegments(parsedMeshes);
  }, [scene, registerSpawnPoints]);

  return (
    <group name="TimberCampusMapRoot">
      {segments.map((seg) => {
        if (seg.isBorder) {
          // 2B. Invisible border wall with fixed trimesh Rapier physics collider & raycast blocker
          return (
            <RigidBody
              key={seg.id}
              type="fixed"
              colliders="trimesh"
              position={seg.position}
              quaternion={seg.quaternion}
              scale={seg.scale}
            >
              <mesh
                geometry={seg.geometry}
                visible={false}
                userData={{ isEnvironment: true, isBorder: true, nodeName: seg.name }}
              >
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </RigidBody>
          );
        }

        if (seg.includeCollider) {
          // 2C. Walkable floors, stairs, walls, ramps with fixed trimesh Rapier collider
          return (
            <RigidBody
              key={seg.id}
              type="fixed"
              colliders="trimesh"
              position={seg.position}
              quaternion={seg.quaternion}
              scale={seg.scale}
              friction={0.2}
            >
              <mesh
                name={seg.name}
                geometry={seg.geometry}
                material={seg.material}
                castShadow
                receiveShadow
                userData={{ isEnvironment: true, nodeName: seg.name }}
              />
            </RigidBody>
          );
        }

        // Decorative foliage / small meshes rendered with shadows but excluded from trimesh physics
        return (
          <mesh
            key={seg.id}
            name={seg.name}
            geometry={seg.geometry}
            material={seg.material}
            position={seg.position}
            quaternion={seg.quaternion}
            scale={seg.scale}
            castShadow
            receiveShadow
            userData={{ isEnvironment: false, isDecorative: true, nodeName: seg.name }}
          />
        );
      })}
    </group>
  );
}

useGLTF.preload('./assets/map.glb');
