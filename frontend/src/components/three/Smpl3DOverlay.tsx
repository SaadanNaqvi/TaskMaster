import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import type { VideoPlayer } from 'expo-video';
import { createSmplScene, lerpPose, smoothstep } from '../../lib/smpl/scene';
import { STANDING_POSE, SQUAT_BOTTOM_POSE } from '../../lib/smpl/poses';
import { SmplPose } from '../../lib/smpl/types';
import { coverFitPoint, hipPx, solveScreenPosition } from '../../lib/smpl/align';
import type { ApiPoseFrame } from '../../services/apiGateway';
import { colors } from '../../theme/colors';

// Committed procedural placeholder by default (see frontend/scripts/generatePlaceholderBody.js).
// backend/scripts/convert_smpl.py overwrites this exact file with the real SMPL mesh once you
// have a licensed .pkl — same path, so nothing here needs to change when that happens.
const bodyModelJson = require('../../../assets/smpl/body_model.json');

const CYCLE_MS = 2200;

export interface Smpl3DOverlayHandle {
  /** Rotates the mesh around its own vertical axis by `deltaRadians`, relative to its current
   * rotation. Driven by the results screen's own touch handler (not this component's own — it
   * sits on top of tap-to-play/pause, and disambiguating tap-vs-drag on the same touch target only
   * needs to happen in one place), so a plain ref call is simpler than this component owning a
   * second, competing gesture responder. */
  rotateBy: (deltaRadians: number) => void;
}

interface Props extends ViewProps {
  /** 0-1, how visible the mesh is (results screen exposes a toggle for this). */
  opacity?: number;
  /** A real per-reference pose sequence (backend/pose/video_to_smpl_pose.py's ROMP output). When
   * absent, loops the placeholder stand/squat animation instead. */
  poseSequence?: SmplPose[] | null;
  translations?: [number, number, number][] | null;
  fps?: number;
  /** The results screen's video player — read (not controlled) here, purely to sync which moment
   * of the reference's motion to show. */
  player?: VideoPlayer | null;
  /** The user's own MediaPipe landmarks (pixel space, matching userVideoWidth/Height) — when this,
   * poseSequence and player are all present, the mesh is anchored to the user's hip and scaled to
   * their torso length every frame instead of using the reference's own (uncalibrated) translation. */
  userPoseFrames?: ApiPoseFrame[] | null;
  userVideoWidth?: number;
  userVideoHeight?: number;
}

/**
 * Small ambient preview sitting in the corner of the results video. When a reference pose sequence,
 * the user's own landmarks, and the video player are all available, it's anchored to the user's hip
 * and scaled to their torso length every frame — real screen-space overlap, not just a floating
 * mesh (see lib/smpl/align.ts for why this is 2D compositing, not true 3D spatial alignment). Falls
 * back to the reference's own (uncalibrated) translation, or a placeholder loop, as data is missing.
 * Non-interactive itself — see Smpl3DOverlayHandle.rotateBy for why.
 */
const Smpl3DOverlay = forwardRef<Smpl3DOverlayHandle, Props>(function Smpl3DOverlay(
  { opacity = 0.85, poseSequence, translations, fps = 30, player, userPoseFrames, userVideoWidth, userVideoHeight, style, ...rest },
  ref
) {
  const startedAt = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const extraYRotation = useRef(0);
  const groupRef = useRef<THREE.Group | null>(null);

  useImperativeHandle(ref, () => ({
    rotateBy: (deltaRadians: number) => {
      extraYRotation.current += deltaRadians;
      if (groupRef.current) groupRef.current.rotation.y = extraYRotation.current;
    },
  }));

  // expo-gl only calls onContextCreate once, when the GL context is first created — it does NOT
  // re-invoke it on re-renders. The render loop set up inside it must read data through a ref kept
  // current every render, not by closing over these props directly, since most of them arrive
  // asynchronously (fetches in the results screen) after that first mount.
  const liveData = useRef({ poseSequence, translations, fps, player, userPoseFrames, userVideoWidth, userVideoHeight });
  liveData.current = { poseSequence, translations, fps, player, userPoseFrames, userVideoWidth, userVideoHeight };

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    startedAt.current = Date.now();
    const { poser, scene, group, geometry, positions, bounds } = createSmplScene(bodyModelJson, colors.lime, opacity);
    groupRef.current = group;

    const renderer = new Renderer({ gl, alpha: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const viewportW = gl.drawingBufferWidth;
    const viewportH = gl.drawingBufferHeight;
    const camera = new THREE.PerspectiveCamera(35, viewportW / viewportH, 0.1, 100);
    // Front-facing — screen-space alignment below assumes a camera looking straight down -Z, not
    // the side-on angle a fixed ambient preview used before real alignment existed.
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    const referenceDepth = bounds.height * 2.2;

    const updatePose = () => {
      const { poseSequence, translations, fps, player, userPoseFrames, userVideoWidth, userVideoHeight } =
        liveData.current;

      let pose: SmplPose;
      let aligned = false;

      if (poseSequence && poseSequence.length > 0 && player && userPoseFrames && userPoseFrames.length > 0) {
        const duration = player.duration || 0;
        const fraction = duration > 0 ? Math.min(1, Math.max(0, player.currentTime / duration)) : 0;
        const userIdx = Math.min(userPoseFrames.length - 1, Math.floor(fraction * userPoseFrames.length));
        const refIdx = Math.min(poseSequence.length - 1, Math.floor(fraction * poseSequence.length));
        const landmarks = userPoseFrames[userIdx]?.landmarks;
        const hip = landmarks && hipPx(landmarks);
        pose = poseSequence[refIdx];

        if (hip && userVideoWidth && userVideoHeight) {
          const hipOnScreen = coverFitPoint(hip, userVideoWidth, userVideoHeight, viewportW, viewportH);
          const position = solveScreenPosition({
            camera,
            poser,
            pose,
            viewportW,
            viewportH,
            targetHipPx: hipOnScreen,
            referenceDepth,
          });
          group.scale.setScalar(1);
          group.position.copy(position);
          aligned = true;
        }

        if (!aligned) {
          const t = translations?.[refIdx];
          group.scale.setScalar(1);
          group.position.set(
            (t?.[0] ?? 0) as number,
            (t?.[1] ?? 0) - bounds.centerY,
            -referenceDepth + ((t?.[2] ?? 0) as number)
          );
        }
      } else {
        const elapsed = (Date.now() - (startedAt.current ?? Date.now())) % CYCLE_MS;
        const half = CYCLE_MS / 2;
        const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
        pose = lerpPose(STANDING_POSE, SQUAT_BOTTOM_POSE, smoothstep(t));
        group.scale.setScalar(1);
        group.position.set(0, -bounds.centerY, -referenceDepth);
      }

      group.rotation.y = extraYRotation.current;
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
});

export default Smpl3DOverlay;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
