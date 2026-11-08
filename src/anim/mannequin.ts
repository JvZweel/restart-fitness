import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Muscle } from '../domain/types';
import type { PoseExt } from './motion';
import type { Timeline } from './motion';
import type { AnimSpec, BenchKind, Limb, Pose } from './types';

const D = THREE.MathUtils.degToRad;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export interface Palette { body: number; primary: number; secondary: number; glow: number; bench: number; frame: number; iron: number; steel: number }
export const PALETTE_LIGHT: Palette = { body: 0xd4d8dc, primary: 0x6fbdb3, secondary: 0xb2d6d1, glow: 0x0fb5a3, bench: 0x2b3136, frame: 0x6f7880, iron: 0x33393f, steel: 0xb9c0c6 };
export const PALETTE_DARK: Palette = { body: 0x8e979f, primary: 0x34b3a4, secondary: 0x5f9a94, glow: 0x2dd4bf, bench: 0x1b2024, frame: 0x4c555d, iron: 0x262b30, steel: 0x8d969d };

type JointName = 'root' | 'spine' | 'spine2' | 'chest' | 'neck' | 'head' | 'lClav' | 'rClav' | 'lSh' | 'rSh' | 'lEl' | 'rEl' | 'lHand' | 'rHand'
  | 'lHip' | 'rHip' | 'lKn' | 'rKn' | 'lAnk' | 'rAnk';

/** Segment lengths (m). */
export const BONES = { thigh: 0.45, shin: 0.43, upperArm: 0.29, forearm: 0.265, ankleH: 0.075 };

// ── Geometry helpers ─────────────────────────────────────────────
/** Smooth rotationally symmetric segment hanging along -Y from the joint. ctrl = [u (0..1 along L), radius]. */
function limbGeo(L: number, ctrl: [number, number][], radial = 16): THREE.BufferGeometry {
  const rt = ctrl[0][1];
  const rb = ctrl[ctrl.length - 1][1];
  const pts = [V(0, rt * 0.92).setZ(0), V(rt * 0.7, rt * 0.62), ...ctrl.map(([u, r]) => V(r, -u * L)), V(rb * 0.7, -L - rb * 0.62), V(0, -L - rb * 0.92)];
  const curve = new THREE.SplineCurve(pts.map((p) => new THREE.Vector2(p.x, p.y)));
  const prof = curve.getPoints(Math.max(14, ctrl.length * 3)).reverse();
  prof[0].x = 0;
  prof[prof.length - 1].x = 0;
  for (const p of prof) p.x = Math.max(0, p.x);
  return new THREE.LatheGeometry(prof, radial);
}

/** Lathe from explicit (radius, y) profile points, top to bottom. */
function profileGeo(pts: [number, number][], radial = 20, div = 22): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  const prof = curve.getPoints(div).reverse();
  prof[0].x = 0;
  prof[prof.length - 1].x = 0;
  for (const p of prof) p.x = Math.max(0, p.x);
  return new THREE.LatheGeometry(prof, radial);
}

const SPHERE = new THREE.SphereGeometry(1, 18, 12);
const mtx = (pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) =>
  new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale));

interface Contact { o: THREE.Object3D; r: number; torso: boolean }

export interface Probe {
  joints: Record<string, THREE.Vector3>;
  minY: number;
  /** Which contact is lowest (debugging). */
  minAt: string;
  bells: THREE.Vector3[];
  plantError: Partial<Record<Limb, number>>;
  benchPenetration: number;
  gripError: number;
  /** Approximate centre of mass (segment-mass weighted, dumbbells included). */
  com: THREE.Vector3;
  /** Floor support area of the standing feet (heel/toe points on the floor). */
  support: THREE.Vector3[];
}

/** Segment masses (fraction of body mass) between joint pairs, after Dempster. */
const SEGMENTS: [string, string, number][] = [
  ['root', 'spine', 0.142], ['spine', 'chest', 0.139], ['chest', 'neck', 0.216], ['neck', 'headTop', 0.081],
  ['lSh', 'lEl', 0.028], ['rSh', 'rEl', 0.028], ['lEl', 'lHand', 0.016], ['rEl', 'rHand', 0.016], ['lHand', 'lHand', 0.006], ['rHand', 'rHand', 0.006],
  ['lHip', 'lKn', 0.1], ['rHip', 'rKn', 0.1], ['lKn', 'lAnk', 0.0465], ['rKn', 'rAnk', 0.0465], ['lAnk', 'lAnk', 0.0145], ['rAnk', 'rAnk', 0.0145],
];

/**
 * Sculpted studio mannequin: tapered lathe segments with deltoid, pectoral, gluteal and calf
 * forms, clavicles and a two-segment spine; dumbbells gripped in wrapped fists; padded bench.
 * Posing is forward kinematics plus two-bone IK for pinned/planted feet and hands.
 */
export class Mannequin {
  readonly group = new THREE.Group();
  readonly figure = new THREE.Group();
  readonly j = {} as Record<JointName, THREE.Object3D>;
  private mats: Record<'body' | 'primary' | 'secondary' | 'bench' | 'frame' | 'iron' | 'steel', THREE.MeshStandardMaterial>;
  private muscles = new Map<Muscle, THREE.Mesh[]>();
  private parts = new Map<THREE.Object3D, THREE.BufferGeometry[]>();
  private feet: THREE.Object3D[] = [];
  private contacts: Contact[] = [];
  private props = new THREE.Group();
  private bench: THREE.Group | null = null;
  private benchBack: THREE.Object3D | null = null;
  private benchSeat: THREE.Object3D | null = null;
  private bells: THREE.Object3D[] = [];
  private freeBell: THREE.Object3D | null = null;
  private grips: Record<'l' | 'r', THREE.Group> = {} as Record<'l' | 'r', THREE.Group>;
  private openHands: Record<'l' | 'r', THREE.Object3D> = {} as Record<'l' | 'r', THREE.Object3D>;
  private chestShape = new THREE.Group();
  private bellyShape = new THREE.Group();
  private plants = new Map<Limb, THREE.Vector3>();
  private floorOffset: number | null = null;
  private handTargets: Partial<Record<'l' | 'r', THREE.Vector3>> = {};
  private lastPose: Pose | null = null;
  private tmp = V();
  private tmp2 = V();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  /** Scratch objects for the per-frame IK and foot solve (no allocations in the hot path). */
  private scratch = {
    a: V(), b: V(), c: V(), t: V(), pole: V(), cands: [V(), V(), V()],
    q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(), fkUpper: new THREE.Quaternion(),
    euler: new THREE.Euler(),
  };

  constructor(pal: Palette) {
    const std = (c: number, rough: number, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    this.mats = {
      body: std(pal.body, 0.6),
      primary: std(pal.primary, 0.5),
      secondary: std(pal.secondary, 0.55),
      bench: std(pal.bench, 0.82),
      frame: std(pal.frame, 0.42, 0.55),
      iron: new THREE.MeshStandardMaterial({ color: pal.iron, roughness: 0.62, metalness: 0.1, flatShading: true }),
      steel: std(pal.steel, 0.3, 0.85),
    };
    this.mats.primary.emissive.setHex(pal.glow);
    this.mats.secondary.emissive.setHex(pal.glow);
    this.mats.primary.emissiveIntensity = 0.25;
    this.mats.secondary.emissiveIntensity = 0.06;
    this.build();
    this.group.add(this.figure, this.props);
  }

  setPalette(pal: Palette): void {
    const m = this.mats;
    m.body.color.setHex(pal.body);
    m.primary.color.setHex(pal.primary);
    m.secondary.color.setHex(pal.secondary);
    m.primary.emissive.setHex(pal.glow);
    m.secondary.emissive.setHex(pal.glow);
    m.bench.color.setHex(pal.bench);
    m.frame.color.setHex(pal.frame);
    m.iron.color.setHex(pal.iron);
    m.steel.color.setHex(pal.steel);
  }

  /** Muscle glow follows the movement: brighter under tension. */
  setTension(t: number): void {
    this.mats.primary.emissiveIntensity = 0.05 + 0.6 * t * t;
    this.mats.secondary.emissiveIntensity = 0.02 + 0.1 * t;
  }

  /** Breathing: ribcage expands on the inhale; the belly braces under load. */
  setBreath(b: number, brace = 0): void {
    this.chestShape.scale.set(1 + 0.014 * b, 1 + 0.006 * b, 1 + 0.03 * b);
    this.bellyShape.scale.set(1 + 0.01 * brace, 1, 1 + 0.02 * b - 0.012 * brace);
  }

  // ── Build ─────────────────────────────────────────────────────
  private joint(name: JointName, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    o.rotation.order = 'XYZ';
    parent.add(o);
    this.j[name] = o;
    return o;
  }

  /** Static body geometry merged per joint into one mesh (few draw calls). */
  private part(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Matrix4): void {
    const g = geo.clone().applyMatrix4(m);
    const list = this.parts.get(parent) ?? [];
    list.push(g);
    this.parts.set(parent, list);
  }

  private patch(muscle: Muscle, parent: THREE.Object3D, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]): THREE.Mesh {
    const m = new THREE.Mesh(SPHERE, this.mats.body);
    m.position.set(...pos);
    m.scale.set(scale[0] * 0.95, scale[1] * 0.97, scale[2] * 0.95);
    m.rotation.set(...rot);
    parent.add(m);
    const list = this.muscles.get(muscle) ?? [];
    list.push(m);
    this.muscles.set(muscle, list);
    return m;
  }

  private contact(parent: THREE.Object3D, pos: [number, number, number], r = 0, torso = false): THREE.Object3D {
    const o = new THREE.Object3D();
    o.position.set(...pos);
    parent.add(o);
    this.contacts.push({ o, r, torso });
    return o;
  }

  private build(): void {
    const root = this.joint('root', this.figure, 0, 1.0, 0);
    // Pelvis: a broad bowl, iliac crest to hip sockets.
    this.part(root, profileGeo([[0.0, 0.095], [0.128, 0.08], [0.152, 0.03], [0.158, -0.03], [0.13, -0.09], [0.06, -0.12], [0.0, -0.125]]), mtx([0, 0, -0.005], [1, 1, 0.74]));
    this.patch('glutes', root, [0.066, -0.035, -0.068], [0.085, 0.095, 0.068], [0.15, 0, -0.12]);
    this.patch('glutes', root, [-0.066, -0.035, -0.068], [0.085, 0.095, 0.068], [0.15, 0, 0.12]);
    this.patch('hipFlexors', root, [0.075, 0.0, 0.07], [0.045, 0.06, 0.035], [0, 0, 0.3]);
    this.patch('hipFlexors', root, [-0.075, 0.0, 0.07], [0.045, 0.06, 0.035], [0, 0, -0.3]);
    this.contact(root, [0, -0.06, -0.125], 0, true);
    this.contact(root, [0.07, -0.08, -0.12], 0, true);
    this.contact(root, [-0.07, -0.08, -0.12], 0, true);
    this.contact(root, [0, -0.04, 0.1], 0, true);

    // Lumbar + lower thoracic segments.
    const spine = this.joint('spine', root, 0, 0.05, 0);
    spine.add(this.bellyShape);
    this.part(spine, profileGeo([[0, 0.17], [0.12, 0.15], [0.128, 0.08], [0.14, 0.0], [0.13, -0.05], [0, -0.06]]), mtx([0, 0, -0.004], [1, 1, 0.7]));
    this.patch('abs', this.bellyShape, [0, 0.13, 0.072], [0.066, 0.15, 0.03]);
    this.patch('obliques', this.bellyShape, [0.1, 0.07, 0.03], [0.04, 0.09, 0.06], [0, 0, -0.12]);
    this.patch('obliques', this.bellyShape, [-0.1, 0.07, 0.03], [0.04, 0.09, 0.06], [0, 0, 0.12]);
    this.patch('lowerBack', spine, [0.038, 0.08, -0.068], [0.04, 0.1, 0.035]);
    this.patch('lowerBack', spine, [-0.038, 0.08, -0.068], [0.04, 0.1, 0.035]);
    this.contact(spine, [0, 0.1, -0.098], 0, true);
    this.contact(spine, [0, 0.1, 0.1], 0, true);
    const spine2 = this.joint('spine2', spine, 0, 0.11, 0);
    this.part(spine2, profileGeo([[0, 0.14], [0.13, 0.12], [0.138, 0.05], [0.13, -0.02], [0, -0.05]]), mtx([0, 0, -0.004], [1, 1, 0.7]));
    this.contact(spine2, [0, 0.05, -0.1], 0, true);

    // Ribcage (scaled by the breath), pecs, lats, traps, shoulder blades.
    const chest = this.joint('chest', spine2, 0, 0.1, 0);
    chest.add(this.chestShape);
    this.part(this.chestShape, profileGeo([[0, 0.335], [0.06, 0.33], [0.12, 0.305], [0.168, 0.25], [0.178, 0.17], [0.162, 0.07], [0.14, 0.0], [0.0, -0.03]], 24), mtx([0, 0, -0.01], [1, 1, 0.66]));
    this.patch('chest', this.chestShape, [0.072, 0.2, 0.082], [0.088, 0.062, 0.042], [0.25, 0, -0.18]);
    this.patch('chest', this.chestShape, [-0.072, 0.2, 0.082], [0.088, 0.062, 0.042], [0.25, 0, 0.18]);
    this.patch('upperBack', this.chestShape, [0.06, 0.19, -0.088], [0.065, 0.085, 0.036], [0, 0, 0.15]);
    this.patch('upperBack', this.chestShape, [-0.06, 0.19, -0.088], [0.065, 0.085, 0.036], [0, 0, -0.15]);
    this.patch('lats', this.chestShape, [0.12, 0.1, -0.05], [0.055, 0.13, 0.05], [0, 0, 0.28]);
    this.patch('lats', this.chestShape, [-0.12, 0.1, -0.05], [0.055, 0.13, 0.05], [0, 0, -0.28]);
    this.patch('traps', chest, [0.07, 0.3, -0.03], [0.085, 0.04, 0.055], [0, 0, 0.42]);
    this.patch('traps', chest, [-0.07, 0.3, -0.03], [0.085, 0.04, 0.055], [0, 0, -0.42]);
    this.contact(chest, [0, 0.17, -0.122], 0, true);
    this.contact(chest, [0.07, 0.2, -0.115], 0, true);
    this.contact(chest, [-0.07, 0.2, -0.115], 0, true);
    this.contact(chest, [0, 0.18, 0.13], 0, true);

    // Neck and head (faceless, egg-shaped skull with jaw taper).
    const neck = this.joint('neck', chest, 0, 0.3, 0.0);
    this.part(neck, limbGeo(0.1, [[0, 0.052], [0.5, 0.046], [1, 0.044]], 16), mtx([0, 0.1, 0.008]));
    const head = this.joint('head', neck, 0, 0.09, 0.012);
    this.part(head, profileGeo([[0, 0.185], [0.06, 0.178], [0.092, 0.145], [0.1, 0.095], [0.094, 0.045], [0.074, 0.005], [0.04, -0.015], [0, -0.02]], 22), mtx([0, 0, 0.008], [0.86, 1, 1]));
    this.part(head, SPHERE, mtx([0, 0.035, 0.05], [0.06, 0.05, 0.05]));
    this.contact(head, [0, 0.19, 0], 0, true);
    this.contact(head, [0, 0.09, -0.098], 0, true);
    this.contact(head, [0, 0.09, 0.108], 0, true);

    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      // Clavicle from the sternum to the shoulder.
      const clav = this.joint(`${side}Clav`, chest, 0.025 * sx, 0.255, 0.04);
      const clavLen = Math.hypot(0.175, 0.045);
      this.part(clav, limbGeo(clavLen, [[0, 0.016], [0.5, 0.014], [1, 0.018]], 10), mtx([0, 0, 0], [1, 1, 1], [Math.atan2(0.045, 0.175) * -1, 0, (Math.PI / 2) * sx]));
      const sh = this.joint(`${side}Sh`, clav, 0.175 * sx, -0.01, -0.045);
      this.part(sh, limbGeo(BONES.upperArm, [[0, 0.05], [0.18, 0.052], [0.45, 0.048], [0.7, 0.043], [1, 0.039]]), mtx([0, 0, 0], [0.95, 1, 1]));
      this.patch('shoulders', sh, [0.016 * sx, -0.03, 0.018], [0.064, 0.082, 0.058], [0.15, 0, 0.12 * sx]);
      this.patch('rearDelts', sh, [0.014 * sx, -0.035, -0.024], [0.058, 0.076, 0.05], [-0.15, 0, 0.12 * sx]);
      this.patch('biceps', sh, [0, -0.14, 0.024], [0.037, 0.086, 0.035]);
      this.patch('triceps', sh, [0.004 * sx, -0.12, -0.026], [0.04, 0.1, 0.035]);
      const el = this.joint(`${side}El`, sh, 0, -BONES.upperArm, 0);
      this.part(el, SPHERE, mtx([0, 0, -0.004], [0.04, 0.04, 0.04]));
      this.part(el, limbGeo(BONES.forearm, [[0, 0.04], [0.18, 0.044], [0.5, 0.036], [0.85, 0.028], [1, 0.026]]), mtx([0, 0, 0], [1.08, 1, 0.86]));
      this.patch('forearms', el, [0.006 * sx, -0.07, 0.006], [0.045, 0.085, 0.04]);
      this.contact(el, [0, 0, 0], 0.04);
      const hand = this.joint(`${side}Hand`, el, 0, -BONES.forearm, 0);
      this.contact(hand, [0, -0.05, 0], 0.02);
      this.buildHands(side, hand, sx);

      // Legs.
      const hip = this.joint(`${side}Hip`, root, 0.095 * sx, -0.06, 0);
      this.part(hip, limbGeo(BONES.thigh, [[0, 0.084], [0.15, 0.083], [0.42, 0.075], [0.75, 0.062], [0.94, 0.051], [1, 0.05]], 20), mtx([0, -0.005, 0], [1, 1, 1.02]));
      this.patch('quads', hip, [0.012 * sx, -0.2, 0.034], [0.066, 0.17, 0.052], [0.05, 0, 0]);
      this.patch('quads', hip, [-0.022 * sx, -0.36, 0.034], [0.04, 0.07, 0.04]);
      this.patch('hamstrings', hip, [0, -0.22, -0.036], [0.058, 0.165, 0.05]);
      this.patch('adductors', hip, [-0.034 * sx, -0.13, 0.004], [0.044, 0.12, 0.054]);
      const kn = this.joint(`${side}Kn`, hip, 0, -BONES.thigh, 0);
      this.part(kn, SPHERE, mtx([0, 0, 0.004], [0.053, 0.055, 0.055]));
      this.part(kn, SPHERE, mtx([0, 0.005, 0.045], [0.032, 0.036, 0.018]));
      this.part(kn, limbGeo(BONES.shin, [[0, 0.05], [0.25, 0.046], [0.6, 0.037], [0.88, 0.03], [1, 0.03]]), mtx([0, 0, 0.004], [1, 1, 1]));
      this.patch('calves', kn, [0.018 * sx, -0.12, -0.032], [0.034, 0.1, 0.04]);
      this.patch('calves', kn, [-0.014 * sx, -0.13, -0.03], [0.032, 0.095, 0.038]);
      this.contact(kn, [0, -0.01, 0.06], 0);
      const ank = this.joint(`${side}Ank`, kn, 0, -BONES.shin, 0);
      this.part(ank, SPHERE, mtx([0, -0.005, 0], [0.032, 0.034, 0.034]));
      // Foot: heel, arch and tapered forefoot, flat sole at y = -0.075.
      const footGeo = limbGeo(0.19, [[0, 0.036], [0.3, 0.042], [0.62, 0.046], [0.88, 0.038], [1, 0.03]], 16);
      this.part(ank, footGeo, mtx([0.004 * sx, -0.052, -0.045], [0.9, 1, 0.55], [-Math.PI / 2, 0, 0]));
      this.part(ank, SPHERE, mtx([0.002 * sx, -0.035, 0.035], [0.038, 0.034, 0.07], [-0.35, 0, 0]));
      const heel = this.contact(ank, [0, -BONES.ankleH, -0.05]);
      const toe = this.contact(ank, [0, -BONES.ankleH, 0.16]);
      this.feet.push(heel, toe);
    }

    // Merge static parts per joint.
    for (const [parent, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.mats.body);
      mesh.castShadow = true;
      parent.add(mesh);
    }
    this.parts.clear();
  }

  /** Open hand (relaxed / planted) and a fist wrapped around a dumbbell handle (grip group). */
  private buildHands(side: 'l' | 'r', hand: THREE.Object3D, sx: number): void {
    const open = new THREE.Group();
    const add = (g: THREE.BufferGeometry, m: THREE.Matrix4, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(g, this.mats.body);
      mesh.applyMatrix4(m);
      parent.add(mesh);
    };
    // Palm faces medially (-x for the left hand); fingers continue down the forearm line.
    add(SPHERE, mtx([0, -0.045, 0], [0.019, 0.048, 0.04]), open);
    add(limbGeo(0.07, [[0, 0.016], [0.6, 0.015], [1, 0.012]], 10), mtx([-0.004 * sx, -0.075, 0], [1, 1, 2.3]), open);
    add(limbGeo(0.045, [[0, 0.011], [1, 0.009]], 8), mtx([-0.012 * sx, -0.035, 0.032], [1, 1, 1], [0.5, 0, 0.35 * sx]), open);
    hand.add(open);
    this.openHands[side] = open;

    // Grip frame: handle along local z at y = -0.075; rotated about y for supinated/pronated grips.
    const grip = new THREE.Group();
    grip.position.set(0, -0.075, 0);
    const fist = new THREE.Group();
    add(SPHERE, mtx([0.004 * sx, 0.03, 0], [0.022, 0.045, 0.042]), fist);
    const wrap = new THREE.TorusGeometry(0.022, 0.0165, 8, 18, Math.PI * 1.45);
    add(wrap, mtx([0, 0, 0], [1, 1, 2.5], [0, 0, sx > 0 ? Math.PI * 0.78 : Math.PI * 0.77 + Math.PI]), fist);
    add(limbGeo(0.04, [[0, 0.012], [1, 0.01]], 8), mtx([-0.022 * sx, 0.02, 0.034], [1, 1, 1], [1.2, 0, 0]), fist);
    grip.add(fist);
    hand.add(grip);
    this.grips[side] = grip;
  }

  /** Free GPU resources (geometries incl. shared ones are re-uploaded if another viewer uses them). */
  dispose(): void {
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    for (const g of [SPHERE, Mannequin.bellGeo?.head, Mannequin.bellGeo?.handle, Mannequin.bellGeo?.collar]) g?.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
  }

  setMuscles(primary: Muscle[], secondary: Muscle[] = []): void {
    for (const [m, meshes] of this.muscles) {
      const mat = primary.includes(m) ? this.mats.primary : secondary.includes(m) ? this.mats.secondary : this.mats.body;
      for (const mesh of meshes) mesh.material = mat;
    }
  }

  // ── Props ─────────────────────────────────────────────────────
  private static bellGeo: { head: THREE.BufferGeometry; handle: THREE.BufferGeometry; collar: THREE.BufferGeometry } | null = null;

  /** Hex rubber dumbbell, handle along local z. */
  private dumbbell(): THREE.Group {
    if (!Mannequin.bellGeo) {
      const head = new THREE.LatheGeometry([[0, -0.036], [0.05, -0.036], [0.058, -0.03], [0.06, 0.03], [0.052, 0.036], [0, 0.036]].map(([r, y]) => new THREE.Vector2(r, y)), 6);
      Mannequin.bellGeo = { head, handle: new THREE.CylinderGeometry(0.0145, 0.0145, 0.15, 12), collar: new THREE.CylinderGeometry(0.024, 0.024, 0.012, 14) };
    }
    const G = Mannequin.bellGeo;
    const g = new THREE.Group();
    const handle = new THREE.Mesh(G.handle, this.mats.steel);
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(G.head, this.mats.iron);
      head.rotation.x = Math.PI / 2;
      head.position.z = s * 0.108;
      head.castShadow = true;
      g.add(head);
      const collar = new THREE.Mesh(G.collar, this.mats.steel);
      collar.rotation.x = Math.PI / 2;
      collar.position.z = s * 0.068;
      g.add(collar);
    }
    return g;
  }

  /** Configure props and the planted limbs for an animation. */
  setAnim(spec: AnimSpec, tl: Timeline): void {
    this.setProps(spec);
    this.plants.clear();
    this.floorOffset = null;
    const plant = spec.plant ?? [];
    if (plant.length) {
      const ref = tl.sample(tl.keyTimes[spec.plantFrame ?? 0] ?? 0).pose;
      this.applyPose(ref, spec, true);
      if (spec.ground === 'floor') this.floorOffset = this.j.root.position.y - (ref.root?.y ?? 1);
      for (const l of plant) {
        const o = l === 'lh' ? this.j.lHand : l === 'rh' ? this.j.rHand : l === 'lf' ? this.j.lAnk : this.j.rAnk;
        this.plants.set(l, o.getWorldPosition(V()));
      }
    }
  }

  private setProps(spec: AnimSpec): void {
    for (const b of this.bells) b.parent?.remove(b);
    this.bells = [];
    this.freeBell = null;
    if (this.bench) {
      this.props.remove(this.bench);
      this.bench.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    }
    this.bench = null;
    this.benchBack = null;
    this.benchSeat = null;
    if (spec.bench) {
      this.bench = this.makeBench(spec.bench.kind, spec.bench.angle ?? 0);
      this.bench.position.set(spec.bench.x ?? 0, 0, spec.bench.z ?? 0);
      this.bench.rotation.y = D(spec.bench.yaw ?? 0);
      this.props.add(this.bench);
    }
    const db = spec.dumbbells ?? 'none';
    const grip = spec.grip ?? 'pronated';
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      const holds = db === 'both' || db === side;
      this.grips[side].visible = holds;
      this.openHands[side].visible = !holds;
      this.grips[side].rotation.y = grip === 'neutral' ? 0 : grip === 'supinated' ? D(90) * sx : D(-90) * sx;
      if (holds) {
        const b = this.dumbbell();
        this.grips[side].add(b);
        this.bells.push(b);
      }
    }
    if (db === 'goblet' || db === 'twoHand' || db === 'hips') {
      const b = this.dumbbell();
      this.figure.add(b);
      this.bells.push(b);
      this.freeBell = b;
    }
  }

  private makeBench(kind: BenchKind, angleDeg: number): THREE.Group {
    const g = new THREE.Group();
    const H = 0.45;
    const T = 0.075;
    const pad = (w: number, len: number) => {
      const s = new THREE.Shape();
      const r = 0.026;
      const x0 = -w / 2;
      const y0 = -T;
      s.moveTo(x0 + r, y0);
      s.lineTo(x0 + w - r, y0);
      s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      s.lineTo(x0 + w, y0 + T - r);
      s.quadraticCurveTo(x0 + w, y0 + T, x0 + w - r, y0 + T);
      s.lineTo(x0 + r, y0 + T);
      s.quadraticCurveTo(x0, y0 + T, x0, y0 + T - r);
      s.lineTo(x0, y0 + r);
      s.quadraticCurveTo(x0, y0, x0 + r, y0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: len - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.008, bevelSegments: 3, curveSegments: 4 });
      geo.translate(0, 0, 0.015);
      const m = new THREE.Mesh(geo, this.mats.bench);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const box = (w: number, h: number, l: number, x: number, y: number, z: number, mat = this.mats.frame, parent: THREE.Object3D = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // Seat toward +z, back pad hinged at z = 0; pad top surfaces at y = H.
    const seat = new THREE.Group();
    seat.position.set(0, H, 0.0);
    const sp = pad(0.3, 0.42);
    seat.add(sp);
    g.add(seat);
    this.benchSeat = seat;
    const back = new THREE.Group();
    back.position.set(0, H, -0.012);
    back.rotation.x = D(angleDeg);
    const bp = pad(0.3, 0.88);
    bp.position.z = -0.88;
    back.add(bp);
    g.add(back);
    this.benchBack = back;
    // Steel frame: spine rail, cross feet with rubber caps, posts.
    box(0.07, 0.05, 1.32, 0, 0.065, -0.26);
    for (const z of [0.38, -0.9]) {
      box(0.46, 0.045, 0.07, 0, 0.0225 + 0.012, z);
      for (const x of [-0.21, 0.21]) box(0.06, 0.024, 0.08, x, 0.012, z, this.mats.iron);
    }
    box(0.055, H - 0.15, 0.055, 0, (H - 0.15) / 2 + 0.08, 0.26);
    box(0.055, H - 0.15, 0.055, 0, (H - 0.15) / 2 + 0.08, -0.05);
    box(0.2, 0.03, 0.3, 0, H - T - 0.03, 0.2);
    if (angleDeg > 5) {
      const zTop = -0.5 * Math.cos(D(angleDeg));
      const yTop = H + 0.5 * Math.sin(D(angleDeg)) - T - 0.02;
      const a = V(0, 0.09, -0.62);
      const b = V(0, yTop, zTop);
      const strut = box(0.045, a.distanceTo(b), 0.045, 0, 0, 0);
      strut.position.copy(a).add(b).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    }
    if (kind === 'decline' || angleDeg < -5) {
      const roller = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 6, 14), this.mats.bench);
      roller.rotation.z = Math.PI / 2;
      // Leg rollers at the raised front end: shins hook under them.
      roller.position.set(0, H - 0.1, 0.62);
      roller.castShadow = true;
      g.add(roller);
      box(0.04, 0.42, 0.04, 0, 0.21, 0.62);
      box(0.04, 0.04, 0.26, 0, 0.065, 0.5);
    }
    return g;
  }

  // ── Posing ────────────────────────────────────────────────────
  applyPose(p: PoseExt | Pose, spec: AnimSpec, noPlants = false): void {
    const pe = p as PoseExt;
    this.lastPose = p;
    const j = this.j;
    const r = p.root ?? {};
    j.root.position.set(r.x ?? 0, r.y ?? 1.0, r.z ?? 0);
    j.root.rotation.set(D(r.pitch ?? 0), D(r.yaw ?? 0), D(r.roll ?? 0), 'YXZ');
    const tri = (o: THREE.Object3D, v: [number, number?, number?] | undefined, signX: number, side: number, k = 1) => {
      const [a = 0, b = 0, c = 0] = v ?? [];
      o.rotation.set(D(a) * signX * k, D(c) * side * k, D(b) * side * k);
    };
    tri(j.spine, p.spine, 1, 1, 0.55);
    tri(j.spine2, p.spine, 1, 1, 0.45);
    tri(j.chest, p.chest, 1, 1);
    j.neck.rotation.set(D(p.neck ?? 0) * 0.45, D(p.headYaw ?? 0) * 0.4, 0);
    j.head.rotation.set(D(p.neck ?? 0) * 0.55, D(p.headYaw ?? 0) * 0.6, 0);
    tri(j.lSh, p.lSh, -1, 1);
    tri(j.rSh, p.rSh, -1, -1);
    j.lEl.rotation.set(-D(p.lEl ?? 0), 0, 0);
    j.rEl.rotation.set(-D(p.rEl ?? 0), 0, 0);
    j.lHand.rotation.set(0, 0, -D(p.lWr ?? 0));
    j.rHand.rotation.set(0, 0, D(p.rWr ?? 0));
    tri(j.lHip, p.lHip, -1, 1);
    tri(j.rHip, p.rHip, -1, -1);
    j.lKn.rotation.set(D(p.lKn ?? 0), 0, 0);
    j.rKn.rotation.set(D(p.rKn ?? 0), 0, 0);
    this.setClavicles(p);
    this.figure.updateMatrixWorld(true);
    this.setFeet(pe);
    this.figure.updateMatrixWorld(true);

    const pinW = (pin: Pose['pinL']) => (pin ? pin[3] ?? 1 : 0);
    // Standing moves keep grounding from FK; planted feet only receive the small IK correction.
    const fixedFeet = spec.ground !== 'stand';
    const pinnedL = pinW(p.pinL) > 0.5 || (fixedFeet && this.plants.has('lf'));
    const pinnedR = pinW(p.pinR) > 0.5 || (fixedFeet && this.plants.has('rf'));
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
      if (this.floorOffset != null && !noPlants) j.root.position.y += this.floorOffset;
      else {
        let minY = Infinity;
        for (const c of this.contacts) minY = Math.min(minY, c.o.getWorldPosition(this.tmp).y - c.r);
        for (const f of this.feet) minY = Math.min(minY, f.getWorldPosition(this.tmp).y);
        j.root.position.y -= minY;
      }
    }
    this.figure.updateMatrixWorld(true);

    // Legs: explicit pins, then planted feet.
    for (const s of ['l', 'r'] as const) {
      const pin = s === 'l' ? p.pinL : p.pinR;
      const planted = noPlants ? undefined : this.plants.get(`${s}f`);
      if (planted) this.solve(j[`${s}Hip`], j[`${s}Kn`], j[`${s}Ank`], planted, 1, 1);
      else if (pin && pinW(pin) > 0) this.solve(j[`${s}Hip`], j[`${s}Kn`], j[`${s}Ank`], this.tmp2.set(pin[0], pin[1], pin[2]).clone(), pinW(pin), 1);
    }
    // Two-hand / goblet / hip dumbbell targets.
    this.handTargets = {};
    this.placeFreeBell(spec);
    for (const s of ['l', 'r'] as const) {
      const pin = s === 'l' ? p.pinLH : p.pinRH;
      const planted = noPlants ? undefined : this.plants.get(`${s}h`);
      const target = this.handTargets[s] ?? planted;
      if (target) this.solve(j[`${s}Sh`], j[`${s}El`], j[`${s}Hand`], target, 1, -1);
      else if (pin && pinW(pin) > 0) this.solve(j[`${s}Sh`], j[`${s}El`], j[`${s}Hand`], V(pin[0], pin[1], pin[2]), pinW(pin), -1);
    }
    this.setFeet(pe);
    this.figure.updateMatrixWorld(true);
    if (!noPlants) this.flattenHands(spec);
    this.restHands(spec);
    this.placeFreeBellAfter(spec);
    this.figure.updateMatrixWorld(true);
  }

  /** Scapulohumeral rhythm: the clavicle elevates as the arm rises past ~60°. */
  private setClavicles(p: Pose): void {
    for (const s of ['l', 'r'] as const) {
      const sx = s === 'l' ? 1 : -1;
      const sh = this.j[`${s}Sh`];
      // Arm elevation relative to the torso from the shoulder rotation.
      this.tmp.set(0, -1, 0).applyEuler(sh.rotation);
      const elev = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, -this.tmp.y))));
      const fwd = Math.max(0, this.tmp.z);
      const c = p[`${s}Clav`];
      const e = 0.2 * Math.max(0, elev - 60) + (c?.[0] ?? 0);
      const pr = 10 * fwd + (c?.[1] ?? 0);
      this.j[`${s}Clav`].rotation.set(0, -D(pr) * sx, D(e) * sx);
    }
  }

  /** Foot orientation: world pitch with the heading of the leg (or a local ankle angle blend). */
  private setFeet(p: PoseExt): void {
    const S = this.scratch;
    for (const s of ['l', 'r'] as const) {
      const ank = this.j[`${s}Ank`];
      this.j[`${s}Kn`].getWorldQuaternion(this.q);
      this.j.root.getWorldQuaternion(this.q2);
      S.cands[0].set(0, 0, 1).applyQuaternion(this.q);
      S.cands[1].set(0, 0, 1).applyQuaternion(this.q2);
      S.cands[2].set(0, 1, 0).applyQuaternion(this.q2);
      S.euler.set(D(p[`${s}Foot`] ?? 0), this.heading(S.cands), 0, 'YXZ');
      const local = this.q.invert().multiply(S.q1.setFromEuler(S.euler));
      const w = p[`${s}AnkW`] ?? (p[`${s}Ank`] != null ? 1 : 0);
      if (w > 0) local.slerp(S.q2.setFromEuler(S.euler.set(D(p[`${s}Ank`] ?? 0), 0, 0, 'XYZ')), w);
      ank.quaternion.copy(local);
      ank.updateMatrixWorld(true);
    }
  }

  /** Yaw (rad) of the first candidate direction that is not too vertical. */
  private heading(cands: THREE.Vector3[]): number {
    for (const c of cands) {
      const len = Math.hypot(c.x, c.z);
      if (len > 0.35) return Math.atan2(c.x, c.z);
    }
    return 0;
  }

  /**
   * Two-bone IK: bend the hinge (knee/elbow) to the right length, swing the upper bone onto the
   * target, then twist about the shoulder/hip → target axis so the joint keeps its FK bend direction.
   * hinge: +1 knee (bends backward, points forward), -1 elbow (points backward).
   */
  private solve(upper: THREE.Object3D, mid: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, w: number, hinge: 1 | -1): void {
    const S = this.scratch;
    const a = upper.getWorldPosition(S.a);
    const b = mid.getWorldPosition(S.b);
    const c = end.getWorldPosition(S.c);
    const L1 = a.distanceTo(b);
    const L2 = b.distanceTo(c);
    S.fkUpper.copy(upper.quaternion);
    const fkMid = mid.rotation.x;
    const poleDir = S.pole.set(0, 0, hinge).applyQuaternion(upper.getWorldQuaternion(S.q1));
    const dist = a.distanceTo(target);
    if (dist < 1e-6 || L1 < 1e-6 || L2 < 1e-6) return;
    const d = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-3, dist));
    const interior = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
    mid.rotation.x = hinge * (Math.PI - interior);
    upper.updateMatrixWorld(true);
    // Swing the chain onto the target.
    const c1 = end.getWorldPosition(S.c).sub(a);
    const t1 = S.t.copy(target).sub(a).normalize();
    if (c1.lengthSq() < 1e-12) return;
    c1.normalize();
    const parentInv = upper.parent!.getWorldQuaternion(S.q2).invert();
    S.q3.setFromUnitVectors(c1, t1).multiply(upper.getWorldQuaternion(S.q1));
    upper.quaternion.copy(parentInv).multiply(S.q3);
    upper.updateMatrixWorld(true);
    // Twist about the root → target axis so the knee/elbow keeps its FK bend direction.
    const cur = S.b.set(0, 0, hinge).applyQuaternion(upper.getWorldQuaternion(S.q1));
    const pc = cur.addScaledVector(t1, -cur.dot(t1));
    const pp = poleDir.addScaledVector(t1, -poleDir.dot(t1));
    if (pc.lengthSq() > 1e-6 && pp.lengthSq() > 1e-6) {
      pc.normalize();
      pp.normalize();
      const ang = Math.atan2(S.c.copy(pc).cross(pp).dot(t1), pc.dot(pp));
      S.q3.setFromAxisAngle(t1, ang).multiply(upper.getWorldQuaternion(S.q1));
      upper.quaternion.copy(parentInv).multiply(S.q3);
    }
    if (w < 1) {
      upper.quaternion.copy(S.fkUpper.slerp(upper.quaternion, w));
      mid.rotation.x = fkMid + (mid.rotation.x - fkMid) * w;
    }
    upper.updateMatrixWorld(true);
  }

  /** Planted hands lie palm-down with the fingers pointing along the body's heading. */
  private flattenHands(spec: AnimSpec): void {
    if (spec.flatHands === false) return;
    for (const s of ['l', 'r'] as const) {
      const pin = s === 'l' ? this.lastPose?.pinLH : this.lastPose?.pinRH;
      if (!this.plants.has(`${s}h`) && !(pin && (pin[3] ?? 1) > 0.5)) continue;
      const hand = this.j[`${s}Hand`];
      const sx = s === 'l' ? 1 : -1;
      const rq = this.j.root.getWorldQuaternion(new THREE.Quaternion());
      const yaw = this.heading([V(0, 1, 0).applyQuaternion(rq), V(0, 0, 1).applyQuaternion(rq)]) + D(12) * sx;
      const h = V(Math.sin(yaw), 0, Math.cos(yaw));
      const down = V(0, -1, 0);
      const mw = new THREE.Matrix4().makeBasis(h, down, h.clone().cross(down));
      const fl = V(0, -1, 0);
      const nl = V(-sx, 0, 0);
      const ml = new THREE.Matrix4().makeBasis(fl, nl, fl.clone().cross(nl));
      const desired = new THREE.Quaternion().setFromRotationMatrix(mw.multiply(ml.transpose()));
      const parent = hand.parent!.getWorldQuaternion(new THREE.Quaternion());
      hand.quaternion.copy(parent.invert().multiply(desired));
      hand.updateMatrixWorld(true);
    }
  }

  /** Hands resting on the body (hips, belly, chest): palm against the body, fingers forward or across. */
  private restHands(spec: AnimSpec): void {
    if (!spec.handsAt) return;
    for (const s of ['l', 'r'] as const) {
      const h = spec.handsAt[s];
      if (!h) continue;
      const sx = s === 'l' ? 1 : -1;
      const bone = this.j[h.bone];
      const bq = bone.getWorldQuaternion(new THREE.Quaternion());
      const hand = this.j[`${s}Hand`];
      const target = bone.localToWorld(V(...h.at));
      const axis = bone.localToWorld(V(0, h.at[1], 0));
      const n = axis.sub(target);
      if (n.lengthSq() < 1e-8) n.set(0, 0, -1).applyQuaternion(bq);
      n.normalize();
      const side = Math.abs(h.at[0]) > Math.abs(h.at[2]);
      const pref = side ? V(0, 0, 1).applyQuaternion(bq) : V(-Math.sign(h.at[0] || sx), 0.4, 0).applyQuaternion(bq);
      const f = pref.sub(n.clone().multiplyScalar(pref.dot(n)));
      if (f.lengthSq() < 1e-8) f.set(0, 1, 0).applyQuaternion(bq).addScaledVector(n, -n.y);
      f.normalize();
      const mw = new THREE.Matrix4().makeBasis(f, n, f.clone().cross(n));
      const fl = V(0, -1, 0);
      const nl = V(-sx, 0, 0);
      const ml = new THREE.Matrix4().makeBasis(fl, nl, fl.clone().cross(nl));
      const desired = new THREE.Quaternion().setFromRotationMatrix(mw.multiply(ml.transpose()));
      hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
      hand.updateMatrixWorld(true);
    }
  }

  /** Goblet / two-hand / hip dumbbell: compute where the hands must go before arm IK. */
  private placeFreeBell(spec: AnimSpec): void {
    if (spec.handsAt) {
      for (const s of ['l', 'r'] as const) {
        const h = spec.handsAt[s];
        if (h) this.handTargets[s] = this.j[h.bone].localToWorld(V(...h.at));
      }
    }
    const b = this.freeBell;
    if (!b) return;
    const db = spec.dumbbells;
    if (db === 'goblet') {
      // Vertical bell held at the sternum; palms cup the top head.
      const ch = this.j.chest;
      for (const s of ['l', 'r'] as const) this.handTargets[s] = ch.localToWorld(V(s === 'l' ? 0.06 : -0.06, 0.13, 0.185));
    } else if (db === 'hips') {
      for (const s of ['l', 'r'] as const) this.handTargets[s] = this.j.root.localToWorld(V(s === 'l' ? 0.11 : -0.11, 0.07, 0.15));
    } else if (db === 'twoHand') {
      // Both hands together on the top head: meet at the midpoint of the FK hands.
      const l = this.j.lHand.getWorldPosition(V());
      const r = this.j.rHand.getWorldPosition(V());
      const mid = l.clone().add(r).multiplyScalar(0.5);
      const lat = V(1, 0, 0).applyQuaternion(this.j.chest.getWorldQuaternion(new THREE.Quaternion()));
      this.handTargets.l = mid.clone().addScaledVector(lat, 0.042);
      this.handTargets.r = mid.clone().addScaledVector(lat, -0.042);
    }
  }

  private placeFreeBellAfter(spec: AnimSpec): void {
    const b = this.freeBell;
    if (!b) return;
    const db = spec.dumbbells;
    const chq = this.j.chest.getWorldQuaternion(new THREE.Quaternion());
    if (db === 'goblet') {
      const ch = this.j.chest;
      b.position.copy(ch.localToWorld(V(0, 0.16, 0.215)));
      // Handle vertical in the chest frame (z axis of the bell → chest up).
      b.quaternion.copy(chq).multiply(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(0, 1, 0)));
    } else if (db === 'hips') {
      b.position.copy(this.j.root.localToWorld(V(0, 0.06, 0.16)));
      b.quaternion.copy(this.j.root.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(1, 0, 0)));
    } else if (db === 'twoHand') {
      const l = this.j.lHand.localToWorld(V(0, -0.07, 0));
      const r = this.j.rHand.localToWorld(V(0, -0.07, 0));
      const grip = l.clone().add(r).multiplyScalar(0.5);
      // Hands cradle the top plate; the handle hangs along the forearms toward the elbows, blended with gravity.
      const el = this.j.lEl.getWorldPosition(V()).add(this.j.rEl.getWorldPosition(V())).multiplyScalar(0.5);
      const dir = el.sub(grip).normalize().add(V(0, -0.8, 0)).normalize();
      b.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
      b.position.copy(grip).addScaledVector(dir, 0.1);
    }
    b.updateMatrixWorld(true);
  }

  // ── Probing (tests / framing / trails) ───────────────────────
  /** World positions of the dumbbell centres. */
  bellPositions(): THREE.Vector3[] {
    return this.bells.map((b) => b.getWorldPosition(V()));
  }

  probe(): Probe {
    const joints: Record<string, THREE.Vector3> = {};
    for (const [k, o] of Object.entries(this.j)) joints[k] = o.getWorldPosition(V());
    joints.headTop = this.j.head.localToWorld(V(0, 0.19, 0));
    let minY = Infinity;
    let minAt = '';
    for (const c of [...this.contacts, ...this.feet.map((o) => ({ o, r: 0 }))]) {
      const y = c.o.getWorldPosition(this.tmp).y - c.r;
      if (y < minY) { minY = y; minAt = `${c.o.parent?.name}@${c.o.position.toArray().map((n) => n.toFixed(2)).join(',')}`; }
    }
    const bells = this.bellPositions();
    const plantError: Partial<Record<Limb, number>> = {};
    for (const [l, target] of this.plants) {
      const o = l === 'lh' ? this.j.lHand : l === 'rh' ? this.j.rHand : l === 'lf' ? this.j.lAnk : this.j.rAnk;
      plantError[l] = o.getWorldPosition(this.tmp).distanceTo(target);
    }
    let gripError = 0;
    for (const s of ['l', 'r'] as const) {
      const t = this.handTargets[s];
      if (t) gripError = Math.max(gripError, this.j[`${s}Hand`].getWorldPosition(this.tmp).distanceTo(t));
    }
    let benchPenetration = 0;
    if (this.bench && this.benchBack && this.benchSeat) {
      for (const c of this.contacts) {
        if (!c.torso) continue;
        const w = c.o.getWorldPosition(V());
        for (const [padG, len] of [[this.benchSeat, 0.42], [this.benchBack, 0.88]] as const) {
          const l = padG.worldToLocal(w.clone());
          const zIn = padG === this.benchSeat ? l.z > 0.02 && l.z < len - 0.02 : l.z < -0.02 && l.z > -len + 0.02;
          if (Math.abs(l.x) < 0.13 && zIn && l.y < 0 && l.y > -0.075) benchPenetration = Math.max(benchPenetration, -l.y);
        }
      }
    }
    const com = V();
    let mass = 0;
    for (const [a, b, m] of SEGMENTS) { com.addScaledVector(joints[a].clone().add(joints[b]).multiplyScalar(0.5), m); mass += m; }
    for (const b of bells) { com.addScaledVector(b, 0.05); mass += 0.05; }
    com.divideScalar(mass);
    const support = this.feet.map((f) => f.getWorldPosition(V())).filter((v) => v.y < 0.03);
    return { joints, minY, minAt, bells, plantError, benchPenetration, gripError, com, support };
  }
}
