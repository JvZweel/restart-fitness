import * as THREE from 'three';
import { Mannequin, PALETTE_DARK, PALETTE_LIGHT } from './mannequin';
import { buildTimeline, type Sample, type Timeline } from './motion';
import { ANIMS } from './poses';
import type { AnimSpec } from './types';
import type { Muscle } from '../domain/types';

export interface FrameInfo { phase: Sample['phase']; tension: number; t: number; total: number }

export interface Viewer {
  setAnim(id: string, primary: Muscle[], secondary?: Muscle[]): void;
  setDark(dark: boolean): void;
  /** Deterministic render at a fraction 0..1 of the loop (tests / thumbnails / paused state). */
  renderAt(fraction: number): void;
  /** Render keyframe i exactly (start of its hold). */
  renderKey(i: number): void;
  setPlaying(on: boolean): void;
  /** Rotate the camera around the figure (keyboard orbit). */
  orbit(deg: number): void;
  /** Faint dumbbell path trails. */
  setTrails(on: boolean): void;
  /** Turn auto-orbit and idle sway off/on when the OS reduced-motion preference changes. */
  setReducedMotion(on: boolean): void;
  /** Renderer cost of the last frame (draw calls, triangles, pixel ratio). */
  stats(): { calls: number; triangles: number; pixelRatio: number; geometries: number };
  dispose(): void;
}

export interface ViewerOptions {
  dark: boolean;
  interactive?: boolean;
  /** No auto-orbit and no idle sway (the exercise itself only plays when asked to). */
  reducedMotion?: boolean;
  trails?: boolean;
  onFrame?: (f: FrameInfo) => void;
}

const TRAIL_N = 120;
const MAX_PIXELS = 1.6e6;

function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createViewer(canvas: HTMLCanvasElement, opts: ViewerOptions): Viewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  let pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);

  // Studio lighting rig: key / fill / rim, turned with the camera so the figure always reads.
  const rig = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xf3f6f9, 0x56606a, 0.85);
  const key = new THREE.DirectionalLight(0xfff3e6, 2.5);
  key.position.set(2.0, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xe2ecf6, 0.6);
  fill.position.set(-3.2, 1.6, 2.2);
  const rim = new THREE.DirectionalLight(0xc8f3ec, 1.7);
  rim.position.set(-1.6, 3.0, -3.6);
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.7);
  rim2.position.set(2.8, 2.0, -2.8);
  rig.add(key, fill, rim, rim2);
  scene.add(hemi, rig, key.target);

  // Floor: soft studio disc, cast shadows, and contact shadows under the body and feet.
  const floorTex = radialTexture([[0, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  const floorMat = new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, color: 0xffffff });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), floorMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.001;
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.2, depthWrite: false });
  const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), shadowMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  const blobTex = radialTexture([[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]);
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const blob = (o: number) => {
    const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: o, color: 0x1a2328 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.001;
    m.renderOrder = 1;
    return m;
  };
  const bodyBlob = blob(0.22);
  const footBlobs = [blob(0.45), blob(0.45)];
  scene.add(disc, shadowFloor, bodyBlob, ...footBlobs);

  const man = new Mannequin(opts.dark ? PALETTE_DARK : PALETTE_LIGHT);
  scene.add(man.group);

  // Dumbbell path trails (a faint full path plus a brighter comet tail behind each bell).
  const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);
  let trails: { line: THREE.Line; alpha: THREE.BufferAttribute }[] = [];
  let trailsOn = opts.trails !== false;
  let trailColor = new THREE.Color(opts.dark ? 0x5eead4 : 0x0f766e);

  let spec: AnimSpec | null = null;
  let tl: Timeline | null = null;
  let baseAz = 35;
  let userAz = 0;
  let el = 12;
  let orbitAmp = 10;
  const target = new THREE.Vector3(0, 0.9, 0);
  let dist = 4;
  let playing = true;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let orbitClock = 0;
  let idleClock = 0;
  let lastDrag = -1e9;
  let azVel = 0;
  let disposed = false;
  let slowFrames = 0;
  let reduced = !!opts.reducedMotion;
  let lastSize = '';

  const applyPixelRatio = (w: number, h: number) => {
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    const pr = Math.max(1, Math.min(pixelRatio, cap));
    if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) renderer.setPixelRatio(pr);
  };

  const resize = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 300;
    applyPixelRatio(w, h);
    const key = `${w}x${h}@${renderer.getPixelRatio()}`;
    if (key !== lastSize) {
      lastSize = key;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit();
    }
  };

  const az = () => baseAz + userAz + (reduced ? 0 : orbitAmp * Math.sin((orbitClock / 18) * Math.PI * 2));
  const placeCamera = () => {
    const a = THREE.MathUtils.degToRad(az());
    const e = THREE.MathUtils.degToRad(el);
    camera.position.set(target.x + dist * Math.sin(a) * Math.cos(e), target.y + dist * Math.sin(e), target.z + dist * Math.cos(a) * Math.cos(e));
    camera.lookAt(target);
    rig.rotation.y = a - THREE.MathUtils.degToRad(35);
  };

  /** Frame the whole loop (figure + props) for the camera's azimuth range, tight but never cropped. */
  function fit() {
    if (!spec || !tl) return;
    const box = new THREE.Box3();
    for (let i = 0; i < 16; i++) {
      man.applyPose(tl.sample((i / 16) * tl.total).pose, spec);
      box.expandByObject(man.figure);
    }
    const figCenter = box.getCenter(new THREE.Vector3());
    box.union(new THREE.Box3().setFromObject(man.group));
    box.min.y = Math.min(box.min.y, 0);
    target.copy(box.getCenter(new THREE.Vector3()));
    target.y = THREE.MathUtils.lerp(target.y, figCenter.y, 0.25);
    const vT = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const hT = vT * camera.aspect;
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const e = THREE.MathUtils.degToRad(el);
    let need = 0;
    const amp = reduced ? 0 : orbitAmp;
    for (const da of [-amp, 0, amp]) {
      const a = THREE.MathUtils.degToRad(baseAz + userAz + da);
      const back = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
      const up = back.clone().cross(right);
      for (const c of corners) {
        const rel = c.clone().sub(target);
        const z = rel.dot(back);
        need = Math.max(need, Math.abs(rel.dot(right)) / hT + z, Math.abs(rel.dot(up)) / vT + z);
      }
    }
    dist = (need * 1.06) / (spec.view?.zoom ?? 1);
    // Tight shadow camera around the action.
    const r = Math.max(1.2, box.getSize(new THREE.Vector3()).length() * 0.6);
    const cam = key.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 0.5; cam.far = 12;
    cam.updateProjectionMatrix();
    key.target.position.set(target.x, 0.5, target.z);
    placeCamera();
  }

  function buildTrails() {
    for (const t of trails) { t.line.geometry.dispose(); trailGroup.remove(t.line); }
    trails = [];
    if (!spec || !tl || !spec.dumbbells || spec.dumbbells === 'none') return;
    const paths: THREE.Vector3[][] = [];
    for (let i = 0; i < TRAIL_N; i++) {
      man.applyPose(tl.sample((i / TRAIL_N) * tl.total).pose, spec);
      man.bellPositions().forEach((p, k) => { (paths[k] ??= []).push(p); });
    }
    for (const path of paths) {
      // Skip near-static paths.
      const span = new THREE.Box3().setFromPoints(path).getSize(new THREE.Vector3()).length();
      if (span < 0.08) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([...path, path[0]]);
      const alpha = new THREE.BufferAttribute(new Float32Array((TRAIL_N + 1) * 4), 4);
      geo.setAttribute('color', alpha);
      const line = new THREE.Line(geo, trailMat);
      line.renderOrder = 2;
      trailGroup.add(line);
      trails.push({ line, alpha });
    }
    trailGroup.visible = trailsOn;
  }

  function updateTrails() {
    if (!tl || !trails.length || !trailsOn) return;
    const c = (clock / tl.total) % 1;
    for (const t of trails) {
      const arr = t.alpha.array as Float32Array;
      for (let i = 0; i <= TRAIL_N; i++) {
        const p = (i % TRAIL_N) / TRAIL_N;
        const d = (((c - p) % 1) + 1) % 1;
        const a = d < 0.3 ? 0.07 + 0.45 * (1 - d / 0.3) ** 2 : 0.07;
        arr[i * 4] = trailColor.r; arr[i * 4 + 1] = trailColor.g; arr[i * 4 + 2] = trailColor.b; arr[i * 4 + 3] = a;
      }
      t.alpha.needsUpdate = true;
    }
  }

  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  function updateContactShadows() {
    const j = man.j;
    // Body blob under the pelvis/torso, stronger as the body nears the floor.
    const pelvis = j.root.getWorldPosition(tmpV);
    const chest = j.chest.getWorldPosition(tmpV2);
    const low = Math.min(pelvis.y, chest.y);
    const len = Math.hypot(pelvis.x - chest.x, pelvis.z - chest.z);
    bodyBlob.position.set((pelvis.x + chest.x) / 2, 0.001, (pelvis.z + chest.z) / 2);
    bodyBlob.rotation.z = -Math.atan2(chest.x - pelvis.x, chest.z - pelvis.z);
    bodyBlob.scale.set(0.55, 0.55 + len * 1.4, 1);
    (bodyBlob.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.32 - low * 0.18, 0.1, 0.34);
    (['lAnk', 'rAnk'] as const).forEach((n, i) => {
      const p = j[n].getWorldPosition(tmpV);
      const b = footBlobs[i];
      const h = Math.max(0, p.y - 0.075);
      const f = tmpV2.set(0, 0, 1).applyQuaternion(j[n].getWorldQuaternion(tmpQ));
      b.position.set(p.x + f.x * 0.05, 0.0015, p.z + f.z * 0.05);
      b.rotation.z = -Math.atan2(f.x, f.z);
      b.scale.set(0.16 + h * 0.3, 0.3 + h * 0.3, 1);
      (b.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.5 - h * 3, 0, 0.5);
    });
  }

  const draw = () => {
    if (!spec || !tl) return;
    const s = tl.sample(clock);
    const pose = s.pose;
    const idleOn = !reduced && spec.idle !== false;
    const it = idleClock;
    const free = spec.breath === 'free' || !spec.frames.some((f) => f.phase === 'ecc' || f.phase === 'con');
    const breathe = free ? 0.5 + 0.5 * Math.sin((it / 4.6) * Math.PI * 2) : s.breath;
    if (idleOn) {
      // Subtle life: micro sway of the thorax, soft gaze drift; the sternum lifts on the inhale.
      const ch = pose.chest ?? [0, 0, 0];
      pose.chest = [ch[0] - 1.2 * (breathe - 0.5), (ch[1] ?? 0) + 0.6 * Math.sin(it * 0.43), (ch[2] ?? 0) + 1.0 * Math.sin(it * 0.61)];
      pose.headYaw = (pose.headYaw ?? 0) + 3.5 * Math.sin(it * 0.31) + 1.5 * Math.sin(it * 0.77 + 1) - 1.5 * Math.sin(1);
      pose.neck = (pose.neck ?? 0) + 1.2 * Math.sin(it * 0.5 + 0.4) - 1.2 * Math.sin(0.4);
    }
    man.applyPose(pose, spec);
    man.setTension(s.tension);
    man.setBreath(breathe, s.tension);
    updateContactShadows();
    updateTrails();
    renderer.render(scene, camera);
    opts.onFrame?.({ phase: s.phase, tension: s.tension, t: clock, total: tl.total });
  };

  // Drag to orbit (horizontal for every pointer; vertical tilt for mouse/pen since touch scrolls the page).
  let dragX: number | null = null;
  let dragY = 0;
  let lastMoveT = 0;

  const loop = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      clock += dt;
      idleClock += dt;
      if (!reduced && now - lastDrag > 4000) orbitClock += dt;
      if (Math.abs(azVel) > 0.01 && dragX == null) { userAz += azVel; azVel *= 0.9; }
      // Adaptive resolution: step the pixel ratio down on sustained slow frames.
      slowFrames = dt > 1 / 40 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 45 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); slowFrames = 0; }
      placeCamera();
    }
    resize();
    draw();
    if (playing) raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  let dragId: number | null = null;
  const down = (e: PointerEvent) => {
    if (dragId != null) return;
    dragId = e.pointerId;
    dragX = e.clientX; dragY = e.clientY; azVel = 0; lastDrag = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  };
  const move = (e: PointerEvent) => {
    if (dragX == null || e.pointerId !== dragId) return;
    const dx = e.clientX - dragX;
    userAz -= dx * 0.45;
    if (e.pointerType !== 'touch') el = THREE.MathUtils.clamp(el + (e.clientY - dragY) * 0.25, 0, 48);
    const now = performance.now();
    azVel = reduced ? 0 : -dx * 0.45 * Math.min(1, 16 / Math.max(1, now - lastMoveT));
    lastMoveT = now;
    dragX = e.clientX;
    dragY = e.clientY;
    lastDrag = now;
    placeCamera();
    if (!playing) draw();
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    dragX = null; dragId = null; lastDrag = performance.now();
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  if (opts.interactive !== false) {
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
  }

  return {
    setAnim(id, primary, secondary = []) {
      spec = ANIMS[id] ?? ANIMS['bw-squat'];
      tl = buildTimeline(spec);
      man.setAnim(spec, tl);
      man.setMuscles(spec.muscles?.primary ?? primary, spec.muscles?.secondary ?? secondary);
      baseAz = spec.view?.az ?? 35;
      el = spec.view?.el ?? 12;
      orbitAmp = spec.view?.orbit ?? 10;
      userAz = 0;
      azVel = 0;
      clock = 0;
      orbitClock = 0;
      idleClock = 0;
      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || 300;
      applyPixelRatio(w, h);
      renderer.setSize(w, h, false);
      lastSize = `${w}x${h}@${renderer.getPixelRatio()}`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit();
      buildTrails();
      draw();
      kick();
    },
    setDark(dark) {
      man.setPalette(dark ? PALETTE_DARK : PALETTE_LIGHT);
      floorMat.color.setHex(dark ? 0x3a434a : 0xffffff);
      floorMat.opacity = dark ? 0.5 : 1;
      shadowMat.opacity = dark ? 0.38 : 0.2;
      hemi.intensity = dark ? 0.7 : 0.85;
      trailColor = new THREE.Color(dark ? 0x5eead4 : 0x0f766e);
      for (const b of [bodyBlob, ...footBlobs]) (b.material as THREE.MeshBasicMaterial).color.setHex(dark ? 0x000000 : 0x1a2328);
      draw();
    },
    renderAt(fraction) {
      if (!tl) return;
      playing = false;
      clock = fraction * tl.total;
      idleClock = 0;
      orbitClock = 0;
      placeCamera();
      resize();
      draw();
    },
    renderKey(i) {
      if (!tl) return;
      playing = false;
      clock = tl.keyTimes[i % tl.keyTimes.length] + 1e-3;
      resize();
      draw();
    },
    setPlaying(on) { playing = on; if (on) kick(); },
    orbit(deg) { userAz -= deg; lastDrag = performance.now(); placeCamera(); if (!playing) { resize(); draw(); } },
    setTrails(on) { trailsOn = on; trailGroup.visible = on; if (!playing) draw(); },
    setReducedMotion(on) {
      if (on === reduced) return;
      reduced = on;
      if (on) { azVel = 0; orbitClock = 0; }
      fit();
      if (!playing) draw();
    },
    stats() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, pixelRatio: renderer.getPixelRatio(), geometries: i.memory.geometries };
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      for (const t of trails) t.line.geometry.dispose();
      man.dispose();
      for (const m of [disc, shadowFloor] as THREE.Mesh[]) m.geometry.dispose();
      blobGeo.dispose();
      for (const m of [floorMat, shadowMat, trailMat, ...[bodyBlob, ...footBlobs].map((b) => b.material as THREE.Material)]) m.dispose();
      floorTex.dispose();
      blobTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
