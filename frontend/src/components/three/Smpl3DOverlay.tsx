import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { parseSmplAsset, SmplAsset } from '../../lib/smpl/types';
import { SmplPoser } from '../../lib/smpl/skinning';
import { STANDING_POSE, SQUAT_BOTTOM_POSE } from '../../lib/smpl/poses';
import { colors } from '../../theme/colors';

// Committed procedural placeholder by default (see frontend/scripts/generatePlaceholderBody.js).
// backend/scripts/convert_smpl.py overwrites this exact file with the real SMPL mesh once you
// have a licensed .pkl — same path, so nothing here needs to change when that happens.
const bodyModelJson = require('../../../assets/smpl/body_model.json');

const CYCLE_MS = 2200;

function lerpPose(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

interface Props extends ViewProps {
  /** 0-1, how visible the mesh is (results screen exposes a toggle for this). */
  opacity?: number;
}

/**
 * Renders a posed, animated placeholder body mesh (SMPL topology, procedural mesh until a real
 * SMPL .pkl is converted) — a genuinely 3D stand-in for the overlay the real backend pipeline
 * will eventually produce. Not spatially matched to the video; purely illustrative.
 */
export default function Smpl3DOverlay({ opacity = 0.85, style, ...rest }: Props) {
  const startedAt = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    startedAt.current = Date.now();
    const asset: SmplAsset = parseSmplAsset(bodyModelJson);
    const poser = new SmplPoser(asset);
    const positions = new Float32Array(asset.vertexCount * 3);

    const renderer = new Renderer({ gl, alpha: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      100
    );

    // Different SMPL-topology assets use different rest-pose coordinate conventions — the
    // committed placeholder is ground-relative (feet at y=0), real SMPL exports are centered near
    // the origin (pelvis around y=-0.2). Frame from the mesh's own bounds instead of assuming one.
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < asset.vertexCount; i++) {
      const y = asset.vertices[i * 3 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const centerY = (minY + maxY) / 2;
    const height = Math.max(maxY - minY, 0.5);
    // Side-on, matching how the app frames every recorded set.
    camera.position.set(height * 1.6, centerY, 0);
    camera.lookAt(0, centerY, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(2, 3, 2);
    scene.add(key);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(Array.from(asset.faces));

    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(colors.lime),
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const updatePose = () => {
      const elapsed = (Date.now() - (startedAt.current ?? Date.now())) % CYCLE_MS;
      const half = CYCLE_MS / 2;
      const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
      const eased = t * t * (3 - 2 * t); // smoothstep
      const pose = lerpPose(STANDING_POSE, SQUAT_BOTTOM_POSE, eased);
      poser.pose(pose, positions);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    let lastPoseUpdate = 0;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const now = Date.now();
      // Recompute the skinned mesh at ~12fps — plenty smooth for a slow squat loop, cheap on a phone.
      if (now - lastPoseUpdate > 80) {
        updatePose();
        lastPoseUpdate = now;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <View style={[styles.container, style]} {...rest} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
