#!/usr/bin/env node
/**
 * Generates frontend/assets/smpl/body_model.smplmesh — a small procedural "articulated mannequin"
 * mesh (boxes between joints) using SMPL's standard 24-joint topology, so the 3D overlay pipeline
 * has something valid to load before a real SMPL .pkl has been converted (see
 * backend/scripts/convert_smpl.py, which overwrites this exact file with the real mesh).
 *
 * This mesh is 100% procedural — no SMPL data, geometry, or weights are used — so it's fine to
 * commit to git, unlike a real converted SMPL asset. (The `.smplmesh` extension, not `.json`, is
 * so Metro bundles it as a binary asset instead of inlining it into the JS bundle — see
 * frontend/metro.config.js and frontend/src/lib/smpl/bodyModel.ts. Content is still plain JSON.)
 *
 * Run: node scripts/generatePlaceholderBody.js
 */
const fs = require('fs');
const path = require('path');

// Same order/parents as frontend/src/lib/smpl/poses.ts — see that file for the joint names.
const PARENTS = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19, 20, 21];

const JOINTS = [
  [0, 1.0, 0], // 0 pelvis
  [0.09, 0.95, 0], // 1 left_hip
  [-0.09, 0.95, 0], // 2 right_hip
  [0, 1.15, 0], // 3 spine1
  [0.1, 0.5, 0], // 4 left_knee
  [-0.1, 0.5, 0], // 5 right_knee
  [0, 1.3, 0], // 6 spine2
  [0.1, 0.08, 0], // 7 left_ankle
  [-0.1, 0.08, 0], // 8 right_ankle
  [0, 1.42, 0], // 9 spine3
  [0.1, 0.02, 0.06], // 10 left_foot
  [-0.1, 0.02, 0.06], // 11 right_foot
  [0, 1.55, 0], // 12 neck
  [0.08, 1.5, 0], // 13 left_collar
  [-0.08, 1.5, 0], // 14 right_collar
  [0, 1.68, 0], // 15 head
  [0.18, 1.48, 0], // 16 left_shoulder
  [-0.18, 1.48, 0], // 17 right_shoulder
  [0.19, 1.2, 0], // 18 left_elbow
  [-0.19, 1.2, 0], // 19 right_elbow
  [0.2, 0.95, 0], // 20 left_wrist
  [-0.2, 0.95, 0], // 21 right_wrist
  [0.2, 0.88, 0], // 22 left_hand
  [-0.2, 0.88, 0], // 23 right_hand
];

const JOINT_COUNT = JOINTS.length;

// Per-bone half-width (meters) — thicker for torso/thighs, thinner for forearms etc.
const BONE_RADIUS = {
  1: 0.09,
  2: 0.09, // hips->pelvis (thigh top)
  3: 0.1,
  6: 0.11,
  9: 0.11, // spine
  4: 0.07,
  5: 0.07, // knees (thigh)
  7: 0.05,
  8: 0.05, // ankles (shin)
  10: 0.04,
  11: 0.04, // feet
  12: 0.06,
  15: 0.09, // neck/head
  13: 0.04,
  14: 0.04, // collars
  16: 0.05,
  17: 0.05, // shoulders (upper arm)
  18: 0.04,
  19: 0.04, // elbows (forearm)
  20: 0.03,
  21: 0.03, // wrists (hand)
  22: 0.03,
  23: 0.03,
};

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function length(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}
function normalize(a) {
  const l = length(a) || 1;
  return scale(a, 1 / l);
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

const vertices = [];
const faces = [];
const vertexJointOwner = []; // which joint each vertex is 100%-weighted to

function addBoxBetween(a, b, halfWidth, ownerJoint) {
  const dir = normalize(sub(b, a));
  const upGuess = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = normalize(cross(upGuess, dir));
  const up = normalize(cross(dir, right));

  const base = vertices.length / 3;
  for (const t of [0, 1]) {
    const center = t === 0 ? a : b;
    for (const sr of [-1, 1]) {
      for (const su of [-1, 1]) {
        const p = add(center, add(scale(right, sr * halfWidth), scale(up, su * halfWidth)));
        vertices.push(p[0], p[1], p[2]);
        vertexJointOwner.push(ownerJoint);
      }
    }
  }
  // 8 verts: 0..3 = t=0 (r-,u-)(r-,u+)(r+,u-)(r+,u+); 4..7 = t=1 same pattern
  const idx = (i) => base + i;
  const quads = [
    [0, 1, 3, 2], // t=0 end cap
    [4, 6, 7, 5], // t=1 end cap
    [0, 4, 5, 1], // right- side
    [2, 3, 7, 6], // right+ side
    [0, 2, 6, 4], // up- side
    [1, 5, 7, 3], // up+ side
  ];
  for (const [a2, b2, c2, d2] of quads) {
    faces.push(idx(a2), idx(b2), idx(c2));
    faces.push(idx(a2), idx(c2), idx(d2));
  }
}

for (let j = 1; j < JOINT_COUNT; j++) {
  const parent = PARENTS[j];
  const radius = BONE_RADIUS[j] ?? 0.05;
  addBoxBetween(JOINTS[parent], JOINTS[j], radius, j);
}
// A small head box above the head joint, owned by the head joint.
addBoxBetween(JOINTS[15], add(JOINTS[15], [0, 0.14, 0]), 0.09, 15);

const vertexCount = vertices.length / 3;
const weights = new Array(vertexCount * JOINT_COUNT).fill(0);
for (let v = 0; v < vertexCount; v++) {
  weights[v * JOINT_COUNT + vertexJointOwner[v]] = 1;
}

const joints = JOINTS.flat();

const payload = {
  vertexCount,
  jointCount: JOINT_COUNT,
  vertices,
  faces,
  weights,
  joints,
  parents: PARENTS,
};

const outPath = path.join(__dirname, '..', 'assets', 'smpl', 'body_model.smplmesh');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB) — ${vertexCount} vertices, ${JOINT_COUNT} joints`);
