import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { createSmplScene, lerpPose, smoothstep } from '../../lib/smpl/scene';
import { STANDING_POSE, SQUAT_BOTTOM_POSE } from '../../lib/smpl/poses';
import { SmplPose } from '../../lib/smpl/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

const bodyModelJson = require('../../../assets/smpl/body_model.json');

const CYCLE_MS = 2200;
const MIN_ELEVATION = -1.3;
const MAX_ELEVATION = 1.3;

function touchDistance(touches: GestureResponderEvent['nativeEvent']['touches']): number {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export interface SmplViewerProps {
  /**
   * A real per-frame pose sequence (e.g. from the 4D-Humans Colab notebook), each frame a flat
   * jointCount*3 axis-angle array. When absent, loops a placeholder stand/squat animation instead.
   */
  poseSequence?: SmplPose[] | null;
  /** Per-frame root translation (meters, ROMP's weak-perspective camera space), same length and
   * indexing as poseSequence. Optional — omitted for the placeholder loop, which never moves. */
  translations?: [number, number, number][] | null;
  fps?: number;
}

/**
 * Full free-orbit 3D viewer — one-finger drag to rotate, pinch to zoom. Same SMPL-topology mesh
 * as the ambient results-screen overlay, just with real camera controls and (once available) a
 * real per-frame pose sequence instead of the placeholder loop.
 */
export default function SmplViewer({ poseSequence, translations, fps = 30 }: SmplViewerProps) {
  const startedAt = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // expo-gl calls onContextCreate exactly once, when the GL context is created — never again on
  // re-renders. Its render loop must read pose data through a ref kept up to date every render,
  // not by closing over these props directly, or a pose sequence that arrives after first mount
  // (e.g. fetched async) would never be seen by the already-running loop.
  const liveData = useRef({ poseSequence, translations, fps });
  liveData.current = { poseSequence, translations, fps };

  const azimuth = useRef(Math.PI / 2); // start side-on
  const elevation = useRef(0.15);
  const distanceScale = useRef(1);
  const pinchStart = useRef<number | null>(null);
  const distanceScaleAtPinchStart = useRef(1);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // PanResponder's handlers only ever run from real touch events, never during render — the refs
  // they close over are read/written exactly the way the lint rule's own docs call out as safe
  // ("accessed outside of render, such as in event handlers"). The rule's static analysis can't
  // see that these closures are deferred, so it flags the whole `create()` call regardless.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          pinchStart.current = touchDistance(evt.nativeEvent.touches);
          distanceScaleAtPinchStart.current = distanceScale.current;
        }
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (pinchStart.current === null) {
            pinchStart.current = touchDistance(touches);
            distanceScaleAtPinchStart.current = distanceScale.current;
            return;
          }
          const ratio = pinchStart.current / Math.max(touchDistance(touches), 1);
          distanceScale.current = Math.min(3, Math.max(0.4, distanceScaleAtPinchStart.current * ratio));
          return;
        }
        pinchStart.current = null;
        azimuth.current -= gesture.dx * 0.006;
        elevation.current = Math.min(
          MAX_ELEVATION,
          Math.max(MIN_ELEVATION, elevation.current + gesture.dy * 0.006)
        );
      },
      onPanResponderRelease: () => {
        pinchStart.current = null;
      },
    })
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    startedAt.current = Date.now();
    const { poser, scene, mesh, geometry, positions, bounds } = createSmplScene(bodyModelJson, colors.lime, 1);

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x0b0d10, 1);

    const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    const baseDistance = bounds.height * 1.7;

    // Root translation of the current frame, applied to the whole mesh — the camera orbits
    // around this point too, so a real (ROMP-derived) sequence stays framed as the person moves,
    // e.g. sinking into a squat, instead of drifting out of view.
    const root = new THREE.Vector3(0, 0, 0);

    const updateCamera = () => {
      const r = baseDistance * distanceScale.current;
      const el = elevation.current;
      const az = azimuth.current;
      camera.position.set(
        root.x + r * Math.cos(el) * Math.sin(az),
        bounds.centerY + root.y + r * Math.sin(el),
        root.z + r * Math.cos(el) * Math.cos(az)
      );
      camera.lookAt(root.x, bounds.centerY + root.y, root.z);
    };

    const updatePose = () => {
      const { poseSequence, translations, fps } = liveData.current;
      if (poseSequence && poseSequence.length > 0) {
        const elapsed = (Date.now() - (startedAt.current ?? Date.now())) / 1000;
        const frameIndex = Math.floor(elapsed * (fps ?? 30)) % poseSequence.length;
        poser.pose(poseSequence[frameIndex], positions);
        const t = translations?.[frameIndex];
        root.set(t?.[0] ?? 0, t?.[1] ?? 0, t?.[2] ?? 0);
        mesh.position.copy(root);
      } else {
        const elapsed = (Date.now() - (startedAt.current ?? Date.now())) % CYCLE_MS;
        const half = CYCLE_MS / 2;
        const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
        poser.pose(lerpPose(STANDING_POSE, SQUAT_BOTTOM_POSE, smoothstep(t)), positions);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    let lastPoseUpdate = 0;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const now = Date.now();
      if (now - lastPoseUpdate > 80) {
        updatePose();
        lastPoseUpdate = now;
      }
      updateCamera();
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Drag to rotate · pinch to zoom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hint: { position: 'absolute', bottom: 24, alignSelf: 'center' },
  hintText: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
});
