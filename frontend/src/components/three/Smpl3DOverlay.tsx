import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View, ViewProps } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import type { VideoPlayer } from 'expo-video';
import { createSmplScene, lerpPose, smoothstep } from '../../lib/smpl/scene';
import { STANDING_POSE, SQUAT_BOTTOM_POSE } from '../../lib/smpl/poses';
import { SmplPose } from '../../lib/smpl/types';
import { coverFitPoint, stableAnklePx } from '../../lib/smpl/align';
import type { ApiPoseFrame } from '../../services/apiGateway';
import { colors } from '../../theme/colors';

// Committed procedural placeholder by default (see frontend/scripts/generatePlaceholderBody.js).
// backend/scripts/convert_smpl.py overwrites this exact file with the real SMPL mesh once you
// have a licensed .pkl — same path, so nothing here needs to change when that happens.
const bodyModelJson = require('../../../assets/smpl/body_model.json');

const CYCLE_MS = 2200;
// How long to stay hidden waiting for the one-time screen-offset solve before giving up and
// showing at the (unaligned) default position anyway — covers the case where user landmarks never
// arrive at all (rather than hiding forever), while still being short enough that "wait a bit
// longer" doesn't itself feel like a stall.
const ALIGNMENT_TIMEOUT_MS = 1500;

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
   * poseSequence and player are all present, the whole preview is shifted (via a plain RN
   * translateX/Y, not any 3D projection) so it sits over the user's feet instead of dead-center. */
  userPoseFrames?: ApiPoseFrame[] | null;
  userVideoWidth?: number;
  userVideoHeight?: number;
}

/**
 * Small ambient preview sitting in the corner of the results video. When the user's own landmarks
 * are available, the whole preview is nudged — once, via a plain 2D screen-space translateX/Y, not
 * re-solved every frame — so the model's feet line up with theirs instead of sitting dead-center
 * (anchored on feet rather than hip since the feet stay planted for the whole rep, unlike the hip
 * which moves through a squat — anchoring there only lined up at whatever instant it was solved
 * on). This is deliberately
 * NOT a 3D perspective-projection placement: an earlier version solved the 3D world position that
 * would *project* to the right pixel, using the camera's FOV/aspect — mathematically sound, but it
 * went through several rounds of subtle bugs (stale viewport dimensions, projection edge cases)
 * that were hard to diagnose without a device in hand. Plain 2D translation has no camera math to
 * get wrong: whatever pixel offset is computed is exactly the pixel offset applied.
 *
 * The mesh's own motion (from the reference's ROMP-derived translation, root-relative to its own
 * first frame) still plays on top of that fixed screen position in 3D, clamped so a bad per-frame
 * pose-pipeline estimate can't fling it off-screen. Re-solving the screen offset every frame
 * instead of once would make the preview visibly chase the user's (often slightly jittery) landmark
 * detections, and would hide any real difference in how far/fast the two move — exactly the signal
 * a form comparison should surface, not erase. The whole preview stays invisible (not just
 * unaligned) until that one-time solve completes, so it never shows at the wrong spot and then
 * visibly snaps once the real offset is known — it only ever appears already in place. Falls back
 * to showing at the default position after ALIGNMENT_TIMEOUT_MS if user landmarks never arrive at
 * all, or immediately when there's no pose sequence at all (placeholder loop — nothing to align to).
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
  const [screenOffset, setScreenOffset] = useState({ x: 0, y: 0 });
  // Stays hidden (not just unaligned) until the one-time screen-offset solve has actually run —
  // otherwise the mesh briefly renders at its unaligned default position and then visibly snaps
  // once the real offset resolves, which reads as "teleporting" onto the person.
  const [ready, setReady] = useState(false);
  // Temporary, visible on-screen instead of only in console.log — two rounds of "still off"
  // reports without a device to test against means guessing a third fix isn't productive; this
  // gets real numbers back instead. Remove once a report confirms which value is wrong.
  const [debugText, setDebugText] = useState<string | null>(null);

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
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    // Front-facing, not the side-on angle a fixed ambient preview used before real pose data
    // existed — matches how the reference video itself was actually filmed.
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    const referenceDepth = bounds.height * 2.2;
    const defaultPosition = new THREE.Vector3(0, -bounds.centerY, -referenceDepth);
    // Where the feet sit, in world units, once defaultPosition's vertical recentering is applied:
    // recentering puts the rest-pose bounding box's vertical *center* at world Y=0, so its bottom
    // (the feet) ends up at exactly -height/2. Needed below to line up the model's feet with the
    // user's feet — anchoring on bounding-box center (i.e. treating that as "the hip") was only an
    // approximation of hip height, and left the model consistently a bit high relative to the feet.
    const groundWorldY = -bounds.height / 2;
    const fovRad = (camera.fov * Math.PI) / 180;
    // Hard bound on how far the reference's own relative motion can push it from center. Real
    // exercise motion (verified against an actual squat clip) stays well inside this; it exists so
    // that any one bad per-frame estimate from the pose pipeline (occlusion, motion blur, a
    // regression outlier) can't fling the mesh out of view.
    const MAX_RELATIVE_MOTION = bounds.height * 0.5;

    let screenOffsetResolved = false;

    const updatePose = (viewportW: number, viewportH: number, viewportStable: boolean) => {
      const { poseSequence, translations, fps, userPoseFrames, userVideoWidth, userVideoHeight } = liveData.current;

      let pose: SmplPose;

      if (poseSequence && poseSequence.length > 0) {
        const player = liveData.current.player;
        const duration = player?.duration || 0;
        const fraction = player && duration > 0 ? Math.min(1, Math.max(0, player.currentTime / duration)) : 0;
        const refIdx = Math.min(poseSequence.length - 1, Math.floor(fraction * poseSequence.length));
        pose = poseSequence[refIdx];
        const t = translations?.[refIdx];
        const relativeMotion = new THREE.Vector3((t?.[0] ?? 0) as number, (t?.[1] ?? 0) as number, (t?.[2] ?? 0) as number);
        if (relativeMotion.length() > MAX_RELATIVE_MOTION) relativeMotion.setLength(MAX_RELATIVE_MOTION);

        if (!screenOffsetResolved) {
          if (viewportStable && userPoseFrames && userPoseFrames.length > 0 && userVideoWidth && userVideoHeight) {
            const ankle = stableAnklePx(userPoseFrames);
            if (ankle) {
              const ankleOnScreen = coverFitPoint(ankle, userVideoWidth, userVideoHeight, viewportW, viewportH);
              // Where the model's own feet land on screen in its default (unshifted) render, so the
              // offset below lines up feet-to-feet instead of assuming they sit at the vertical
              // center of the preview.
              const pixelsPerWorldUnit = viewportH / (2 * referenceDepth * Math.tan(fovRad / 2));
              const groundScreenY = viewportH / 2 - groundWorldY * pixelsPerWorldUnit;
              screenOffsetResolved = true;
              // viewportW/H (from gl.drawingBufferWidth/Height) are physical pixels — this device
              // renders at 2x, so the canvas backing store is twice the CSS size. RN's translateX/Y
              // style values are in logical/CSS pixels, so the offset must be scaled back down or it
              // ends up roughly double what it should be (verified: pushed the mesh entirely outside
              // the clipped preview box, which read as "disappeared"/wildly off-center).
              const dpr = PixelRatio.get();
              const resolvedOffset = {
                x: (ankleOnScreen.x - viewportW / 2) / dpr,
                y: (ankleOnScreen.y - groundScreenY) / dpr,
              };
              // Temporary — two rounds of "still off" reports without a device to test against
              // means further guessing isn't productive. Remove once a real report confirms which
              // of these numbers is the one that's wrong.
              const debugInfo = {
                ankleRaw: ankle,
                userVideoWidth,
                userVideoHeight,
                viewportW,
                viewportH,
                dpr,
                ankleOnScreen,
                groundScreenY,
                referenceDepth,
                boundsHeight: bounds.height,
                resolvedOffset,
              };
              console.log('[Smpl3DOverlay] anchor resolved', debugInfo);
              setDebugText(
                `vid ${userVideoWidth}x${userVideoHeight} view ${viewportW.toFixed(0)}x${viewportH.toFixed(0)} dpr${dpr}\n` +
                  `ankleSrc ${ankle.x.toFixed(0)},${ankle.y.toFixed(0)} ankleScr ${ankleOnScreen.x.toFixed(0)},${ankleOnScreen.y.toFixed(0)}\n` +
                  `groundScr ${groundScreenY.toFixed(0)} offset ${resolvedOffset.x.toFixed(0)},${resolvedOffset.y.toFixed(0)}`
              );
              setScreenOffset(resolvedOffset);
              setReady(true);
            }
          }
          // Give up waiting and show at the default (unaligned) position rather than staying
          // hidden forever if landmarks never show up at all.
          if (!screenOffsetResolved && Date.now() - (startedAt.current ?? Date.now()) > ALIGNMENT_TIMEOUT_MS) {
            screenOffsetResolved = true;
            setReady(true);
          }
        }

        group.position.copy(defaultPosition).add(relativeMotion);
        group.scale.setScalar(1);
      } else {
        // No pose sequence at all (placeholder loop) — nothing to align to, so show immediately.
        if (!screenOffsetResolved) {
          screenOffsetResolved = true;
          setReady(true);
        }
        const elapsed = (Date.now() - (startedAt.current ?? Date.now())) % CYCLE_MS;
        const half = CYCLE_MS / 2;
        const t = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
        pose = lerpPose(STANDING_POSE, SQUAT_BOTTOM_POSE, smoothstep(t));
        group.scale.setScalar(1);
        group.position.copy(defaultPosition);
      }

      group.rotation.y = extraYRotation.current;
      poser.pose(pose, positions);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    let lastPoseUpdate = 0;
    let lastViewportW = 0;
    let lastViewportH = 0;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);

      // Re-measured every frame rather than trusting the size captured once at GL-context-creation
      // time — RN layout can still be settling at that instant, and the one-time screen-offset
      // solve above needs a real width/height to produce a meaningful pixel offset.
      const viewportW = gl.drawingBufferWidth;
      const viewportH = gl.drawingBufferHeight;
      const viewportChanged = viewportW !== lastViewportW || viewportH !== lastViewportH;
      if (viewportChanged) {
        renderer.setSize(viewportW, viewportH);
        camera.aspect = viewportW / viewportH;
        camera.updateProjectionMatrix();
        lastViewportW = viewportW;
        lastViewportH = viewportH;
      }
      const viewportStable = !viewportChanged && viewportW > 0 && viewportH > 0;

      const now = Date.now();
      // Recompute the skinned mesh at ~12fps — plenty smooth for a slow squat loop, cheap on a phone.
      if (now - lastPoseUpdate > 80) {
        updatePose(viewportW, viewportH, viewportStable);
        lastPoseUpdate = now;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <View style={styles.container} {...rest} pointerEvents="none">
      <View
        style={[
          styles.container,
          style,
          { opacity: ready ? 1 : 0, transform: [{ translateX: screenOffset.x }, { translateY: screenOffset.y }] },
        ]}
        pointerEvents="none"
      >
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>
      {/* Temporary diagnostic overlay — see debugText above for why. Always visible (unaffected by
       * the mesh's own opacity/transform) so it can be read/screenshotted regardless of whether
       * alignment resolved. Remove alongside debugText once no longer needed. */}
      {debugText && (
        <View style={styles.debugBox} pointerEvents="none">
          <Text style={styles.debugText}>{debugText}</Text>
        </View>
      )}
    </View>
  );
});

export default Smpl3DOverlay;

const styles = StyleSheet.create({
  container: { flex: 1 },
  debugBox: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.75)', padding: 4 },
  debugText: { color: '#0f0', fontSize: 8, fontFamily: 'Courier' },
});
