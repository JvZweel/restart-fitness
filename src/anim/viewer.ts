import * as THREE from 'three';
import { Mannequin, PALETTE_DARK, PALETTE_LIGHT } from './mannequin';
import { ANIMS } from './poses';
import type { AnimSpec, Pose } from './types';
import type { Muscle } from '../domain/types';

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

const NEUTRAL: Pose = { lSh: [0, 7], rSh: [0, 7], lEl: 10, rEl: 10, lHip: [0, 3], rHip: [0, 3] };

type Num = number | undefined;
function lerpTuple(a: (Num)[] | undefined, b: (Num)[] | undefined, t: number): [number, number, number] | undefined {
  if (!a && !b) return undefined;
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = (a?.[i] ?? 0) + ((b?.[i] ?? 0) - (a?.[i] ?? 0)) * t;
  return out;
}
const lerpN = (a: Num, b: Num, t: number) => (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t;

type Pin = [number, number, number, number?];
function lerpPin(a: Pin | undefined, b: Pin | undefined, t: number): Pin | undefined {
  if (!a && !b) return undefined;
  const A: Pin = a ?? [b![0], b![1], b![2], 0];
  const B: Pin = b ?? [a![0], a![1], a![2], 0];
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, (A[3] ?? 1) + ((B[3] ?? 1) - (A[3] ?? 1)) * t];
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const ra = a.root ?? {};
  const rb = b.root ?? {};
  return {
    root: { x: lerpN(ra.x, rb.x, t), y: lerpN(ra.y ?? 1, rb.y ?? 1, t), z: lerpN(ra.z, rb.z, t), pitch: lerpN(ra.pitch, rb.pitch, t), roll: lerpN(ra.roll, rb.roll, t), yaw: lerpN(ra.yaw, rb.yaw, t) },
    spine: lerpTuple(a.spine, b.spine, t), chest: lerpTuple(a.chest, b.chest, t), neck: lerpN(a.neck, b.neck, t),
    lSh: lerpTuple(a.lSh, b.lSh, t), rSh: lerpTuple(a.rSh, b.rSh, t), lEl: lerpN(a.lEl, b.lEl, t), rEl: lerpN(a.rEl, b.rEl, t),
    lHip: lerpTuple(a.lHip, b.lHip, t), rHip: lerpTuple(a.rHip, b.rHip, t), lKn: lerpN(a.lKn, b.lKn, t), rKn: lerpN(a.rKn, b.rKn, t),
    lAnk: a.lAnk == null && b.lAnk == null ? undefined : lerpN(a.lAnk, b.lAnk, t),
    rAnk: a.rAnk == null && b.rAnk == null ? undefined : lerpN(a.rAnk, b.rAnk, t),
    lFoot: a.lFoot == null && b.lFoot == null ? undefined : lerpN(a.lFoot ?? b.lFoot, b.lFoot ?? a.lFoot, t),
    rFoot: a.rFoot == null && b.rFoot == null ? undefined : lerpN(a.rFoot ?? b.rFoot, b.rFoot ?? a.rFoot, t),
    pinL: lerpPin(a.pinL, b.pinL, t),
    pinR: lerpPin(a.pinR, b.pinR, t),
  };
}

interface Timeline { poses: Pose[]; segs: { from: number; to: number; start: number; move: number; hold: number }[]; total: number }

function timeline(spec: AnimSpec): Timeline {
  const poses: Pose[] = [];
  let prev: Pose = NEUTRAL;
  for (const f of spec.frames) {
    const merged: Pose = { ...prev, ...f.pose, root: { ...(prev.root ?? {}), ...(f.pose.root ?? {}) } };
    poses.push(merged);
    prev = merged;
  }
  const segs: Timeline['segs'] = [];
  let t = 0;
  spec.frames.forEach((f, i) => {
    const from = (i - 1 + poses.length) % poses.length;
    const move = f.move ?? 0.9;
    const hold = f.hold ?? 0.25;
    segs.push({ from, to: i, start: t, move, hold });
    t += move + hold;
  });
  return { poses, segs, total: t };
}

export function poseAt(tl: Timeline, time: number): Pose {
  if (tl.poses.length === 1) return tl.poses[0];
  const t = ((time % tl.total) + tl.total) % tl.total;
  for (const s of tl.segs) {
    if (t < s.start + s.move + s.hold) {
      const k = Math.min(1, (t - s.start) / s.move);
      return lerpPose(tl.poses[s.from], tl.poses[s.to], ease(k));
    }
  }
  return tl.poses[tl.poses.length - 1];
}

export interface Viewer {
  setAnim(id: string, primary: Muscle[], secondary?: Muscle[]): void;
  setDark(dark: boolean): void;
  /** Deterministic render at a fraction 0..1 of the loop (tests / thumbnails). */
  renderAt(fraction: number): void;
  /** Render keyframe i exactly (end of its move). */
  renderKey(i: number): void;
  setPlaying(on: boolean): void;
  /** Rotate the camera around the figure (keyboard orbit). */
  orbit(deg: number): void;
  dispose(): void;
}

export function createViewer(canvas: HTMLCanvasElement, opts: { dark: boolean; interactive?: boolean }): Viewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6670, 1.3);
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.2, 4.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  const rim = new THREE.DirectionalLight(0x9fe7dd, 1.1);
  rim.position.set(-3, 2.5, -2.5);
  scene.add(hemi, key, rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x8a949c, transparent: true, opacity: 0.22 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.215, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);

  const man = new Mannequin(opts.dark ? PALETTE_DARK : PALETTE_LIGHT);
  scene.add(man.group);

  let spec: AnimSpec | null = null;
  let tl: Timeline | null = null;
  let az = 35;
  let el = 12;
  const target = new THREE.Vector3(0, 0.9, 0);
  let dist = 4;
  let playing = true;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let disposed = false;

  const resize = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 300;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit();
    }
  };

  const placeCamera = () => {
    const a = THREE.MathUtils.degToRad(az);
    const e = THREE.MathUtils.degToRad(el);
    camera.position.set(target.x + dist * Math.sin(a) * Math.cos(e), target.y + dist * Math.sin(e), target.z + dist * Math.cos(a) * Math.cos(e));
    camera.lookAt(target);
  };

  /** Fit the camera to the union of the figure + props over the whole loop. */
  function fit() {
    if (!spec || !tl) return;
    const box = new THREE.Box3();
    for (let i = 0; i < 12; i++) {
      man.applyPose(poseAt(tl, (i / 12) * tl.total), spec);
      box.expandByObject(man.group);
    }
    const sphereB = box.getBoundingSphere(new THREE.Sphere());
    target.copy(sphereB.center);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fov = Math.min(vFov, hFov);
    dist = (sphereB.radius * 1.02) / Math.sin(fov / 2);
    placeCamera();
  }

  const draw = () => {
    if (!spec || !tl) return;
    man.applyPose(poseAt(tl, clock), spec);
    renderer.render(scene, camera);
  };

  const loop = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) clock += dt;
    resize();
    draw();
    if (playing) raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  // drag to orbit
  let dragX: number | null = null;
  const down = (e: PointerEvent) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (dragX == null) return; az -= (e.clientX - dragX) * 0.5; dragX = e.clientX; placeCamera(); if (!playing) draw(); };
  const up = () => { dragX = null; };
  if (opts.interactive !== false) {
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  return {
    setAnim(id, primary, secondary = []) {
      spec = ANIMS[id] ?? ANIMS['bw-squat'];
      tl = timeline(spec);
      man.setProps(spec);
      man.setMuscles(spec.muscles?.primary ?? primary, spec.muscles?.secondary ?? secondary);
      az = spec.view?.az ?? 35;
      el = spec.view?.el ?? 12;
      clock = 0;
      renderer.setSize(canvas.clientWidth || 300, canvas.clientHeight || 300, false);
      camera.aspect = (canvas.clientWidth || 300) / (canvas.clientHeight || 300);
      camera.updateProjectionMatrix();
      fit();
      draw();
      kick();
    },
    setDark(dark) {
      man.setPalette(dark ? PALETTE_DARK : PALETTE_LIGHT);
      ringMat.color.setHex(dark ? 0x56606a : 0x9aa4ac);
      floor.material.opacity = dark ? 0.35 : 0.18;
      draw();
    },
    renderAt(fraction) {
      if (!tl) return;
      playing = false;
      clock = fraction * tl.total;
      resize();
      draw();
    },
    renderKey(i) {
      if (!tl) return;
      const seg = tl.segs[i % tl.segs.length];
      playing = false;
      clock = seg.start + seg.move + 0.001;
      resize();
      draw();
    },
    setPlaying(on) { playing = on; if (on) kick(); },
    orbit(deg) { az -= deg; placeCamera(); if (!playing) { resize(); draw(); } },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
