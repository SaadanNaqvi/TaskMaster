import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { createSmplScene, lerpPose, smoothstep } from '../../lib/smpl/scene';
import { STANDING_POSE, SQUAT_BOTTOM_POSE } from '../../lib/smpl/poses';
import { colors } from '../../theme/colors';

// Committed procedural placeholder by default (see frontend/scripts/generatePlaceholderBody.js).
// backend/scripts/convert_smpl.py overwrites this exact file with the real SMPL mesh once you
// have a licensed .pkl — same path, so nothing here needs to change when that happens.
const bodyModelJson = require('../../../assets/smpl/body_model.json');

const CYCLE_MS = 2200;

interface Props extends ViewProps {
  /** 0-1, how visible the mesh is (results screen exposes a toggle for this). */
  opacity?: number;
}

/**
 * Small ambient preview — posed, animated placeholder body mesh, fixed camera, no interaction.
 * Sits in the corner of the results video. For the full free-orbit viewer, see SmplViewer.
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
    const { poser, scene, geometry, positions, bounds } = createSmplScene(bodyModelJson, colors.lime, opacity);

    const renderer = new Renderer({ gl, alpha: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    // Side-on, matching how the app frames every recorded set.
    camera.position.set(bounds.height * 1.6, bounds.centerY, 0);
    camera.lookAt(0, bounds.centerY, 0);

    const updatePose = () => {
      const elapsed = (Date.now() - (startedAt.current ?? Date.now())) % CYCLE_MS;
      const half = CYCLE_MS / 2;
      const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
      const pose = lerpPose(STANDING_POSE, SQUAT_BOTTOM_POSE, smoothstep(t));
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
