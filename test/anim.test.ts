import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ANIMS } from '../src/anim/poses';
import { buildTimeline, flattenPose, CHANNELS } from '../src/anim/motion';
import { Mannequin, PALETTE_LIGHT } from '../src/anim/mannequin';
import type { AnimSpec } from '../src/anim/types';
import { COOLDOWN, EXERCISES, FINISHERS, WARMUP } from '../src/domain/exercises';

const IDS = Object.keys(ANIMS);

describe('animation registry', () => {
  it('has an animation for every exercise, warm-up move, stretch and finisher', () => {
    const used = new Set([...EXERCISES.map((e) => e.anim), ...WARMUP.map((m) => m.anim), ...COOLDOWN.map((m) => m.anim), ...FINISHERS.map((f) => f.anim)]);
    for (const id of used) expect(ANIMS[id], id).toBeDefined();
    expect(IDS.length).toBeGreaterThanOrEqual(43);
  });

  it('labels the tempo of every lift (eccentric and concentric) and gives tension to every keyframe', () => {
    for (const id of IDS) {
      const s = ANIMS[id];
      for (const f of s.frames) expect(f.tension, `${id} tension`).toBeTypeOf('number');
      if (s.dumbbells && s.dumbbells !== 'none' && s.breath !== 'free') {
        const phases = s.frames.map((f) => f.phase);
        expect(phases, `${id} has an eccentric`).toContain('ecc');
        expect(phases, `${id} has a concentric`).toContain('con');
      }
    }
  });
});

const two: AnimSpec = {
  ground: 'stand',
  frames: [
    { pose: { lKn: 0 }, hold: 0.5, move: 1, phase: 'con', tension: 0.2 },
    { pose: { lKn: 100 }, hold: 0.3, move: 2, phase: 'ecc', tension: 1 },
  ],
};
const ch = (name: string) => CHANNELS.indexOf(name);

describe('timeline (monotone cubic splines)', () => {
  const tl = buildTimeline(two);

  it('starts on the first keyframe and loops seamlessly', () => {
    expect(tl.total).toBeCloseTo(0.5 + 2 + 0.3 + 1);
    expect(tl.sample(0).values[ch('lKn')]).toBeCloseTo(0);
    const a = tl.sample(0).values;
    const b = tl.sample(tl.total - 1e-6).values;
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i]), CHANNELS[i]).toBeLessThan(1e-3);
  });

  it('holds still during a pause and never overshoots the keyframes', () => {
    expect(tl.sample(0.2).values[ch('lKn')]).toBeCloseTo(0);
    expect(tl.sample(0.5 + 2 + 0.15).values[ch('lKn')]).toBeCloseTo(100);
    for (let t = 0; t < tl.total; t += 0.01) {
      const v = tl.sample(t).values[ch('lKn')];
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('eases in and out (zero speed at pauses, smooth velocity)', () => {
    const v = (t: number) => tl.sample(t).values[ch('lKn')];
    const start = 0.5;
    expect(Math.abs(v(start + 0.01) - v(start))).toBeLessThan(0.1);
    const mid = 0.5 + 1;
    expect(Math.abs(v(mid + 0.01) - v(mid))).toBeGreaterThan(0.5);
  });

  it('reports the phase and interpolates tension', () => {
    expect(tl.sample(1).phase).toBe('ecc');
    expect(tl.sample(0.2).phase).toBe('hold');
    expect(tl.sample(tl.total - 0.5).phase).toBe('con');
    expect(tl.sample(0).tension).toBeCloseTo(0.2);
    expect(tl.sample(0.5 + 2 + 0.1).tension).toBeCloseTo(1);
  });

  it('flows through keyframes without stopping when there is no hold', () => {
    const circle = buildTimeline(ANIMS['arm-circles']);
    const f = (t: number) => circle.sample(t).values[ch('lSh0')] + circle.sample(t).values[ch('lSh1')];
    const k1 = circle.keyTimes[1];
    expect(Math.abs(f(k1 + 0.03) - f(k1 - 0.03))).toBeGreaterThan(0.5);
  });

  it('round-trips a pose through its channels', () => {
    const v = flattenPose({ lSh: [10, 20, 30], root: { pitch: 45 } });
    expect(v[ch('lSh0')]).toBe(10);
    expect(v[ch('lSh2')]).toBe(30);
    expect(v[ch('rootY')]).toBe(1);
    expect(v[ch('rootPitch')]).toBe(45);
  });
});

/** Run the rig through the whole loop at 60 fps. */
function run(id: string, fps = 60) {
  const spec = ANIMS[id];
  const man = new Mannequin(PALETTE_LIGHT);
  const tl = buildTimeline(spec);
  man.setAnim(spec, tl);
  const frames: ReturnType<Mannequin['probe']>[] = [];
  for (let t = 0; t < tl.total; t += 1 / fps) {
    man.applyPose(tl.sample(t).pose, spec);
    frames.push(man.probe());
  }
  return { spec, frames, man };
}

describe.each(IDS)('rig: %s', (id) => {
  const { spec, frames } = run(id);

  it('stays finite and above the floor', () => {
    for (const f of frames) {
      for (const [name, p] of Object.entries(f.joints)) {
        expect(Number.isFinite(p.x + p.y + p.z), name).toBe(true);
      }
      expect(f.minY, `lowest body point ${f.minAt}`).toBeGreaterThan(-0.015);
      for (const b of f.bells) expect(b.y, 'dumbbell above the floor').toBeGreaterThan(0.04);
    }
  });

  it('moves without popping (no joint jumps more than 4.5 cm in one 60 fps frame)', () => {
    let worst = 0;
    let at = '';
    for (let i = 1; i < frames.length; i++) {
      for (const name of Object.keys(frames[i].joints)) {
        const d = frames[i].joints[name].distanceTo(frames[i - 1].joints[name]);
        if (d > worst) { worst = d; at = `${name}@${i}`; }
      }
    }
    expect(worst, at).toBeLessThan(0.045);
  });

  it('keeps planted feet and hands on their marks', () => {
    for (const f of frames) for (const [limb, err] of Object.entries(f.plantError)) expect(err, limb).toBeLessThan(0.012);
  });

  if (spec.ground === 'stand' && (spec.anchor ?? 'feet') !== 'none') {
    it('keeps the standing foot planted (no sliding, flat on the floor)', () => {
      const side = spec.anchor === 'r' ? 'rAnk' : 'lAnk';
      const p0 = frames[0].joints[side];
      for (const f of frames) {
        const p = f.joints[side];
        expect(Math.hypot(p.x - p0.x, p.z - p0.z), 'slide').toBeLessThan(0.02);
      }
    });
  }

  if (spec.ground === 'stand' && (spec.anchor ?? 'feet') === 'feet') {
    it('stays balanced: centre of mass over the feet', () => {
      for (const f of frames) {
        if (f.support.length < 2) continue;
        const zs = f.support.map((p) => p.z);
        const xs = f.support.map((p) => p.x);
        expect(f.com.z, 'COM front/back').toBeGreaterThan(Math.min(...zs) - 0.03);
        expect(f.com.z, 'COM front/back').toBeLessThan(Math.max(...zs) + 0.03);
        expect(f.com.x, 'COM side').toBeGreaterThan(Math.min(...xs) - 0.05);
        expect(f.com.x, 'COM side').toBeLessThan(Math.max(...xs) + 0.05);
      }
    });
  }

  if (spec.bench) {
    it('does not sink into the bench pad', () => {
      for (const f of frames) expect(f.benchPenetration, 'bench penetration').toBeLessThan(0.03);
    });
  }

  if (spec.dumbbells && spec.dumbbells !== 'none') {
    it('holds the dumbbells in the hands', () => {
      for (const f of frames) expect(f.gripError, 'grip').toBeLessThan(0.03);
    });
  }
});

describe('two-bone IK', () => {
  it('reaches a reachable target and bends the knee forward', () => {
    const man = new Mannequin(PALETTE_LIGHT);
    const spec: AnimSpec = { ground: 'fixed', frames: [{ pose: {}, tension: 0 }] };
    man.setAnim(spec, buildTimeline(spec));
    man.applyPose({ root: { y: 0.8 }, lHip: [30, 5], pinL: [0.12, 0.08, 0.15, 1] }, spec);
    const p = man.probe();
    expect(p.joints.lAnk.distanceTo(new THREE.Vector3(0.12, 0.08, 0.15))).toBeLessThan(0.005);
    expect(p.joints.lKn.z).toBeGreaterThan(p.joints.lAnk.z - 0.05);
  });
});
