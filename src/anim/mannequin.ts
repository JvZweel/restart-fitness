import * as THREE from 'three';
import type { Muscle } from '../domain/types';
import type { AnimSpec, BenchKind, Pose } from './types';

const D = THREE.MathUtils.degToRad;

export interface Palette { body: number; muscle: number; primary: number; secondary: number; bench: number; frame: number; iron: number }
export const PALETTE_LIGHT: Palette = { body: 0xd5d9dd, muscle: 0xc3c8cd, primary: 0x0d9488, secondary: 0x7fd3c9, bench: 0x2c3237, frame: 0x8a939b, iron: 0x3b4248 };
export const PALETTE_DARK: Palette = { body: 0x9aa3ab, muscle: 0x89929b, primary: 0x2dd4bf, secondary: 0x2a8f86, bench: 0x1c2125, frame: 0x5d666e, iron: 0x2a3036 };

type JointName = 'root' | 'spine' | 'chest' | 'neck' | 'lSh' | 'rSh' | 'lEl' | 'rEl' | 'lHand' | 'rHand' | 'lHip' | 'rHip' | 'lKn' | 'rKn' | 'lAnk' | 'rAnk';

const sphere = new THREE.SphereGeometry(1, 28, 20);

function capsule(r: number, len: number): THREE.CapsuleGeometry {
  return new THREE.CapsuleGeometry(r, len, 8, 20);
}

/** Articulated low-poly mannequin with anatomical muscle patches and dumbbell / bench props. */
export class Mannequin {
  readonly group = new THREE.Group();
  readonly figure = new THREE.Group();
  readonly j = {} as Record<JointName, THREE.Object3D>;
  private bodyMat: THREE.MeshStandardMaterial;
  private muscleMat: THREE.MeshStandardMaterial;
  private primaryMat: THREE.MeshStandardMaterial;
  private secondaryMat: THREE.MeshStandardMaterial;
  private benchMat: THREE.MeshStandardMaterial;
  private frameMat: THREE.MeshStandardMaterial;
  private ironMat: THREE.MeshStandardMaterial;
  private muscles = new Map<Muscle, THREE.Mesh[]>();
  private feet: THREE.Object3D[] = [];
  private contacts: { o: THREE.Object3D; r: number }[] = [];
  private props = new THREE.Group();
  private bench: THREE.Group | null = null;
  private bells: THREE.Object3D[] = [];
  private tmp = new THREE.Vector3();

  constructor(pal: Palette) {
    const std = (c: number, rough = 0.62) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.02 });
    this.bodyMat = std(pal.body);
    this.muscleMat = std(pal.muscle, 0.55);
    this.primaryMat = std(pal.primary, 0.45);
    this.secondaryMat = std(pal.secondary, 0.5);
    this.benchMat = std(pal.bench, 0.75);
    this.frameMat = new THREE.MeshStandardMaterial({ color: pal.frame, roughness: 0.35, metalness: 0.6 });
    this.ironMat = new THREE.MeshStandardMaterial({ color: pal.iron, roughness: 0.4, metalness: 0.55 });
    this.build();
    this.group.add(this.figure, this.props);
  }

  setPalette(pal: Palette): void {
    this.bodyMat.color.setHex(pal.body);
    this.muscleMat.color.setHex(pal.muscle);
    this.primaryMat.color.setHex(pal.primary);
    this.secondaryMat.color.setHex(pal.secondary);
    this.benchMat.color.setHex(pal.bench);
    this.frameMat.color.setHex(pal.frame);
    this.ironMat.color.setHex(pal.iron);
  }

  private joint(name: JointName, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    o.rotation.order = 'XYZ';
    parent.add(o);
    this.j[name] = o;
    return o;
  }

  private mesh(geo: THREE.BufferGeometry, parent: THREE.Object3D, pos: [number, number, number], scale?: [number, number, number], mat = this.bodyMat): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  private patch(muscle: Muscle, parent: THREE.Object3D, pos: [number, number, number], scale: [number, number, number], rotZ = 0): void {
    const m = this.mesh(sphere, parent, pos, scale, this.muscleMat);
    m.rotation.z = rotZ;
    const list = this.muscles.get(muscle) ?? [];
    list.push(m);
    this.muscles.set(muscle, list);
  }

  private contact(parent: THREE.Object3D, pos: [number, number, number], r = 0): THREE.Object3D {
    const o = new THREE.Object3D();
    o.position.set(...pos);
    parent.add(o);
    this.contacts.push({ o, r });
    return o;
  }

  private build(): void {
    const root = this.joint('root', this.figure, 0, 1.0, 0);
    // pelvis
    this.mesh(sphere, root, [0, -0.01, 0], [0.165, 0.115, 0.115]);
    this.patch('glutes', root, [0.072, -0.045, -0.072], [0.082, 0.088, 0.06]);
    this.patch('glutes', root, [-0.072, -0.045, -0.072], [0.082, 0.088, 0.06]);
    this.patch('hipFlexors', root, [0.075, 0.0, 0.075], [0.05, 0.06, 0.04]);
    this.patch('hipFlexors', root, [-0.075, 0.0, 0.075], [0.05, 0.06, 0.04]);
    this.contact(root, [0, -0.06, -0.12]);
    this.contact(root, [0, -0.06, 0.1]);

    const spine = this.joint('spine', root, 0, 0.05, 0);
    this.mesh(sphere, spine, [0, 0.11, 0], [0.145, 0.14, 0.105]);
    this.patch('abs', spine, [0, 0.11, 0.075], [0.075, 0.125, 0.04]);
    this.patch('obliques', spine, [0.105, 0.1, 0.035], [0.04, 0.105, 0.065], -0.12);
    this.patch('obliques', spine, [-0.105, 0.1, 0.035], [0.04, 0.105, 0.065], 0.12);
    this.patch('lowerBack', spine, [0.04, 0.1, -0.07], [0.045, 0.11, 0.04]);
    this.patch('lowerBack', spine, [-0.04, 0.1, -0.07], [0.045, 0.11, 0.04]);
    this.contact(spine, [0, 0.12, -0.11]);
    this.contact(spine, [0, 0.12, 0.11]);

    const chest = this.joint('chest', spine, 0, 0.21, 0);
    this.mesh(sphere, chest, [0, 0.15, -0.005], [0.185, 0.185, 0.12]);
    this.patch('chest', chest, [0.08, 0.19, 0.075], [0.085, 0.072, 0.05]);
    this.patch('chest', chest, [-0.08, 0.19, 0.075], [0.085, 0.072, 0.05]);
    this.patch('abs', chest, [0, 0.05, 0.085], [0.07, 0.06, 0.035]);
    this.patch('upperBack', chest, [0, 0.17, -0.09], [0.1, 0.09, 0.045]);
    this.patch('lats', chest, [0.11, 0.08, -0.06], [0.06, 0.12, 0.05], 0.25);
    this.patch('lats', chest, [-0.11, 0.08, -0.06], [0.06, 0.12, 0.05], -0.25);
    this.patch('traps', chest, [0.075, 0.275, -0.035], [0.08, 0.045, 0.055], 0.35);
    this.patch('traps', chest, [-0.075, 0.275, -0.035], [0.08, 0.045, 0.055], -0.35);
    this.contact(chest, [0, 0.16, -0.125]);
    this.contact(chest, [0, 0.16, 0.13]);

    const neck = this.joint('neck', chest, 0, 0.3, 0);
    this.mesh(capsule(0.045, 0.06), neck, [0, 0.04, 0]);
    this.mesh(sphere, neck, [0, 0.16, 0.012], [0.098, 0.118, 0.108]);
    this.contact(neck, [0, 0.27, 0]);
    this.contact(neck, [0, 0.16, -0.11]);
    this.contact(neck, [0, 0.16, 0.12]);

    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      const sh = this.joint(`${side}Sh`, chest, 0.2 * sx, 0.245, -0.005);
      this.mesh(sphere, sh, [0, -0.005, 0], [0.06, 0.06, 0.06]);
      this.mesh(capsule(0.046, 0.2), sh, [0, -0.14, 0]);
      this.patch('shoulders', sh, [0.012 * sx, -0.035, 0.012], [0.068, 0.085, 0.066]);
      this.patch('rearDelts', sh, [0.008 * sx, -0.04, -0.03], [0.055, 0.075, 0.045]);
      this.patch('biceps', sh, [0, -0.15, 0.028], [0.04, 0.095, 0.036]);
      this.patch('triceps', sh, [0, -0.15, -0.03], [0.042, 0.1, 0.036]);
      const el = this.joint(`${side}El`, sh, 0, -0.29, 0);
      this.mesh(capsule(0.038, 0.2), el, [0, -0.12, 0]);
      this.patch('forearms', el, [0, -0.08, 0.004], [0.047, 0.09, 0.046]);
      this.contact(el, [0, 0, 0], 0.04);
      const hand = this.joint(`${side}Hand`, el, 0, -0.265, 0);
      this.mesh(sphere, hand, [0, -0.025, 0], [0.04, 0.055, 0.03]);
      this.contact(hand, [0, -0.03, 0], 0.03);

      const hip = this.joint(`${side}Hip`, root, 0.095 * sx, -0.06, 0);
      this.mesh(capsule(0.072, 0.32), hip, [0, -0.215, 0]);
      this.patch('quads', hip, [0.004 * sx, -0.21, 0.036], [0.068, 0.17, 0.056]);
      this.patch('hamstrings', hip, [0, -0.23, -0.036], [0.06, 0.16, 0.052]);
      this.patch('adductors', hip, [-0.03 * sx, -0.15, 0.002], [0.045, 0.12, 0.055]);
      const kn = this.joint(`${side}Kn`, hip, 0, -0.45, 0);
      this.mesh(sphere, kn, [0, 0, 0.01], [0.058, 0.058, 0.058]);
      this.mesh(capsule(0.05, 0.32), kn, [0, -0.215, 0]);
      this.patch('calves', kn, [0, -0.13, -0.03], [0.052, 0.11, 0.05]);
      this.contact(kn, [0, -0.02, 0.06]);
      const ank = this.joint(`${side}Ank`, kn, 0, -0.43, 0);
      const foot = this.mesh(capsule(0.04, 0.16), ank, [0, -0.04, 0.055]);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.05, 1, 0.8);
      const heel = this.contact(ank, [0, -0.072, -0.04]);
      const toe = this.contact(ank, [0, -0.072, 0.16]);
      this.feet.push(heel, toe);
    }
  }

  setMuscles(primary: Muscle[], secondary: Muscle[] = []): void {
    for (const [m, meshes] of this.muscles) {
      const mat = primary.includes(m) ? this.primaryMat : secondary.includes(m) ? this.secondaryMat : this.muscleMat;
      for (const mesh of meshes) mesh.material = mat;
    }
  }

  // ── Props ────────────────────────────────────────────────────
  private dumbbell(): THREE.Group {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 12), this.frameMat);
    handle.rotation.z = Math.PI / 2;
    g.add(handle);
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.075, 8), this.ironMat);
      head.rotation.z = Math.PI / 2;
      head.position.x = s * 0.112;
      head.castShadow = true;
      g.add(head);
    }
    return g;
  }

  setProps(spec: AnimSpec): void {
    for (const b of this.bells) b.parent?.remove(b);
    this.bells = [];
    if (this.bench) this.props.remove(this.bench);
    this.bench = null;
    if (spec.bench) {
      this.bench = this.makeBench(spec.bench.kind, spec.bench.angle ?? 0);
      this.bench.position.set(spec.bench.x ?? 0, 0, spec.bench.z ?? 0);
      this.bench.rotation.y = D(spec.bench.yaw ?? 0);
      this.props.add(this.bench);
    }
    const db = spec.dumbbells ?? 'none';
    const neutral = spec.grip === 'neutral';
    const inHand = (side: 'l' | 'r') => {
      const b = this.dumbbell();
      b.position.set(0, -0.03, 0);
      if (neutral) b.rotation.y = Math.PI / 2;
      this.j[`${side}Hand`].add(b);
      this.bells.push(b);
    };
    if (db === 'both' || db === 'l') inHand('l');
    if (db === 'both' || db === 'r') inHand('r');
    if (db === 'goblet') {
      const b = this.dumbbell();
      b.rotation.z = Math.PI / 2;
      b.position.set(0, 0.11, 0.2);
      this.j.chest.add(b);
      this.bells.push(b);
    }
    if (db === 'twoHand') {
      const b = this.dumbbell();
      b.rotation.z = Math.PI / 2;
      b.position.set(-0.1, -0.08, 0);
      this.j.lHand.add(b);
      this.bells.push(b);
    }
    if (db === 'hips') {
      const b = this.dumbbell();
      b.position.set(0, 0.05, 0.17);
      this.j.root.add(b);
      this.bells.push(b);
    }
  }

  private makeBench(kind: BenchKind, angleDeg: number): THREE.Group {
    const g = new THREE.Group();
    const H = 0.45;
    const box = (w: number, h: number, l: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    // seat (toward +z) and back pad hinged at z = 0
    box(0.29, 0.075, 0.42, this.benchMat, 0, H - 0.0375, 0.21);
    const back = new THREE.Group();
    back.position.set(0, H, -0.01);
    back.rotation.x = D(angleDeg);
    box(0.29, 0.075, 0.86, this.benchMat, 0, -0.0375, -0.43, back);
    g.add(back);
    // frame
    box(0.07, 0.04, 1.3, this.frameMat, 0, 0.02, -0.25);
    box(0.42, 0.04, 0.06, this.frameMat, 0, 0.02, 0.38);
    box(0.42, 0.04, 0.06, this.frameMat, 0, 0.02, -0.88);
    box(0.06, H - 0.08, 0.06, this.frameMat, 0, (H - 0.08) / 2 + 0.03, 0.3);
    box(0.06, H - 0.08, 0.06, this.frameMat, 0, (H - 0.08) / 2 + 0.03, -0.05);
    if (angleDeg > 5) {
      const len = 0.62 * Math.sin(D(angleDeg)) + 0.25;
      const strut = box(0.05, len, 0.05, this.frameMat, 0, 0, 0);
      const zTop = -0.55 * Math.cos(D(angleDeg));
      const yTop = H + 0.55 * Math.sin(D(angleDeg)) - 0.08;
      strut.position.set(0, (yTop + 0.04) / 2, (zTop - 0.6) / 2);
      strut.lookAt(0, yTop, zTop);
      strut.rotateX(Math.PI / 2);
      strut.scale.y = Math.hypot(yTop - 0.04, zTop + 0.6) / len;
    }
    if (kind === 'decline') {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 16), this.benchMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, H + 0.12, 0.46);
      g.add(roller);
    }
    return g;
  }

  // ── Posing ───────────────────────────────────────────────────
  applyPose(p: Pose, spec: AnimSpec): void {
    const j = this.j;
    const r = p.root ?? {};
    j.root.position.set(r.x ?? 0, r.y ?? 1.0, r.z ?? 0);
    j.root.rotation.set(D(r.pitch ?? 0), D(r.yaw ?? 0), D(r.roll ?? 0), 'YXZ');
    const tri = (o: THREE.Object3D, v: [number, number?, number?] | undefined, signX: number, side: number) => {
      const [a = 0, b = 0, c = 0] = v ?? [];
      o.rotation.set(D(a) * signX, D(c) * side, D(b) * side);
    };
    tri(j.spine, p.spine, 1, 1);
    tri(j.chest, p.chest, 1, 1);
    j.neck.rotation.set(D(p.neck ?? 0), 0, 0);
    tri(j.lSh, p.lSh, -1, 1);
    tri(j.rSh, p.rSh, -1, -1);
    j.lEl.rotation.set(-D(p.lEl ?? 0), 0, 0);
    j.rEl.rotation.set(-D(p.rEl ?? 0), 0, 0);
    tri(j.lHip, p.lHip, -1, 1);
    tri(j.rHip, p.rHip, -1, -1);
    j.lKn.rotation.set(D(p.lKn ?? 0), 0, 0);
    j.rKn.rotation.set(D(p.rKn ?? 0), 0, 0);
    this.setFeet(p);
    this.figure.updateMatrixWorld(true);
    const pinW = (pin: Pose['pinL']) => (pin ? pin[3] ?? 1 : 0);
    const pinnedL = pinW(p.pinL) > 0.5;
    const pinnedR = pinW(p.pinR) > 0.5;

    if (spec.ground === 'stand') {
      let minY = Infinity;
      this.feet.forEach((f, i) => {
        const side = i < 2 ? 'l' : 'r';
        if ((side === 'l' && pinnedL) || (side === 'r' && pinnedR)) return;
        minY = Math.min(minY, f.getWorldPosition(this.tmp).y);
      });
      j.root.position.y -= minY === Infinity ? 0 : minY;
      const anchor = spec.anchor ?? 'feet';
      if (anchor !== 'none') {
        const pts = anchor === 'feet' ? [j.lAnk, j.rAnk] : [j[`${anchor}Ank`]];
        let ax = 0;
        let az = 0;
        for (const o of pts) { o.getWorldPosition(this.tmp); ax += this.tmp.x; az += this.tmp.z; }
        j.root.position.x += (r.x ?? 0) - ax / pts.length;
        j.root.position.z += (r.z ?? 0) - az / pts.length;
      }
    } else if (spec.ground === 'floor') {
      this.setFeet(p);
      this.figure.updateMatrixWorld(true);
      let minY = Infinity;
      for (const c of this.contacts) minY = Math.min(minY, c.o.getWorldPosition(this.tmp).y - c.r);
      j.root.position.y -= minY;
    }
    this.figure.updateMatrixWorld(true);
    // Two-bone IK for pinned ankles (after the body is placed).
    for (const s of ['l', 'r'] as const) {
      const pin = s === 'l' ? p.pinL : p.pinR;
      const w = pinW(pin);
      if (!pin || w <= 0) continue;
      const hip = j[`${s}Hip`];
      const kn = j[`${s}Kn`];
      const target = j.root.worldToLocal(new THREE.Vector3(pin[0], pin[1], pin[2]));
      const vy = target.y - hip.position.y;
      const vz = target.z - hip.position.z;
      const L1 = 0.45;
      const L2 = 0.43;
      const d = Math.min(L1 + L2 - 0.002, Math.max(0.12, Math.hypot(vy, vz)));
      const phi = Math.atan2(vz, -vy);
      const alpha = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
      const interior = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
      hip.rotation.x += (-(phi + alpha) - hip.rotation.x) * w;
      kn.rotation.x += ((Math.PI - interior) - kn.rotation.x) * w;
    }
    this.setFeet(p);
    this.figure.updateMatrixWorld(true);
  }

  /** Ankles: world foot pitch, explicit local angle, or auto-flat against the floor. */
  private setFeet(p: Pose): void {
    const j = this.j;
    for (const s of ['l', 'r'] as const) {
      const ank = j[`${s}Ank`];
      const chain = j.root.rotation.x + j[`${s}Hip`].rotation.x + j[`${s}Kn`].rotation.x;
      const world = p[`${s}Foot`];
      const local = p[`${s}Ank`];
      if (world != null) ank.rotation.set(D(world) - chain, 0, 0);
      else if (local != null) ank.rotation.set(D(local), 0, 0);
      else ank.rotation.set(-chain, 0, 0);
    }
  }
}
