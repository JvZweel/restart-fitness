import type { Exercise, Finisher, GuidedMove, Muscle, Pattern } from './types';

/** Curated dumbbell + adjustable-bench library. Every exercise has its own animation. */
export const EXERCISES: Exercise[] = [
  // ── Knee dominant ───────────────────────────────────────────
  { id: 'goblet-squat', name: 'Goblet Squat', pattern: 'knee', primary: ['quads', 'glutes'], secondary: ['adductors', 'abs'], load: 'goblet', repMin: 8, repMax: 12, startKg: 15, equipment: '1 dumbbell',
    cues: ['Hold the bell at your chest, elbows inside the knees', 'Sit down between your heels, chest tall', 'Drive up through the whole foot'], anim: 'goblet-squat' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', pattern: 'knee', primary: ['quads', 'glutes'], secondary: ['adductors'], load: 'pair', perSide: true, repMin: 8, repMax: 10, startKg: 7.5, equipment: '2 dumbbells + flat bench',
    cues: ['Rear foot laces-down on the bench', 'Drop the back knee straight down', 'Front knee tracks over the toes'], anim: 'bulgarian-split-squat' },
  { id: 'reverse-lunge', name: 'Reverse Lunge', pattern: 'knee', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'], load: 'pair', perSide: true, repMin: 8, repMax: 12, startKg: 7.5, equipment: '2 dumbbells',
    cues: ['Step back long, torso upright', 'Back knee kisses the floor softly', 'Push through the front heel to stand'], anim: 'reverse-lunge' },
  { id: 'step-up', name: 'Bench Step-Up', pattern: 'knee', primary: ['quads', 'glutes'], secondary: ['calves'], load: 'pair', perSide: true, repMin: 8, repMax: 12, startKg: 7.5, equipment: '2 dumbbells + flat bench',
    cues: ['Whole foot on the bench', 'Drive up with the top leg, not a push-off', 'Lower under control'], anim: 'step-up' },

  // ── Hip hinge ──────────────────────────────────────────────
  { id: 'db-rdl', name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'forearms'], load: 'pair', repMin: 10, repMax: 12, startKg: 15, equipment: '2 dumbbells',
    cues: ['Soft knees, push the hips back', 'Bells slide down close to the legs', 'Stop at a hamstring stretch, flat back'], anim: 'db-rdl' },
  { id: 'hip-thrust', name: 'Dumbbell Hip Thrust', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], load: 'single', repMin: 10, repMax: 15, startKg: 20, equipment: '1 dumbbell + flat bench',
    cues: ['Shoulder blades on the bench edge', 'Chin tucked, ribs down', 'Squeeze glutes to full hip extension'], anim: 'hip-thrust' },
  { id: 'sumo-deadlift', name: 'Dumbbell Sumo Deadlift', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['adductors', 'quads', 'lowerBack'], load: 'single', repMin: 8, repMax: 12, startKg: 22.5, equipment: '1 dumbbell',
    cues: ['Wide stance, toes slightly out', 'Long arms, bell between the heels', 'Stand tall by pushing the floor away'], anim: 'sumo-deadlift' },
  { id: 'single-leg-rdl', name: 'Single-Leg RDL', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['abs'], load: 'single', perSide: true, repMin: 8, repMax: 12, startKg: 10, equipment: '1 dumbbell',
    cues: ['Hips square to the floor', 'Back leg and torso move as one', 'Light fingertip support is fine'], anim: 'single-leg-rdl' },

  // ── Push ───────────────────────────────────────────────────
  { id: 'flat-db-press', name: 'Flat Dumbbell Press', pattern: 'push', primary: ['chest'], secondary: ['triceps', 'shoulders'], load: 'pair', repMin: 8, repMax: 12, startKg: 15, equipment: '2 dumbbells + flat bench',
    cues: ['Feet planted, shoulder blades pinned back', 'Elbows about 45° from the body', 'Press up and slightly in'], anim: 'flat-db-press' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', pattern: 'push', primary: ['chest', 'shoulders'], secondary: ['triceps'], load: 'pair', repMin: 8, repMax: 12, startKg: 12.5, equipment: '2 dumbbells + bench at 30–45°',
    cues: ['Bench at 30–45°', 'Lower to the upper chest', 'Wrists stacked over elbows'], anim: 'incline-db-press' },
  { id: 'seated-shoulder-press', name: 'Seated Shoulder Press', pattern: 'push', primary: ['shoulders'], secondary: ['triceps', 'traps'], load: 'pair', repMin: 8, repMax: 12, startKg: 10, equipment: '2 dumbbells + upright bench',
    cues: ['Back against the upright pad', 'Press up and slightly back', 'Ribs down, no big arch'], anim: 'seated-shoulder-press' },
  { id: 'decline-db-press', name: 'Decline Dumbbell Press', pattern: 'push', primary: ['chest'], secondary: ['triceps'], load: 'pair', repMin: 8, repMax: 12, startKg: 15, equipment: '2 dumbbells + decline bench',
    cues: ['Shallow decline is plenty', 'Lower to the lower chest', 'Lock the legs under the pad'], anim: 'decline-db-press' },
  { id: 'push-up', name: 'Push-Up', pattern: 'push', primary: ['chest'], secondary: ['triceps', 'shoulders', 'abs'], load: 'bodyweight', repMin: 6, repMax: 15, startKg: 0, equipment: 'Floor (hands on bench to make it easier)',
    cues: ['Body in one straight line', 'Hands under the shoulders', 'Chest to fist height, then press'], anim: 'push-up' },

  // ── Pull ───────────────────────────────────────────────────
  { id: 'one-arm-row', name: 'One-Arm Dumbbell Row', pattern: 'pull', primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts'], load: 'single', perSide: true, repMin: 10, repMax: 12, startKg: 17.5, equipment: '1 dumbbell + flat bench',
    cues: ['Hand and knee on the bench, flat back', 'Pull the elbow to the hip pocket', 'Full stretch at the bottom'], anim: 'one-arm-row' },
  { id: 'chest-supported-row', name: 'Chest-Supported Incline Row', pattern: 'pull', primary: ['upperBack', 'lats'], secondary: ['rearDelts', 'biceps'], load: 'pair', repMin: 10, repMax: 12, startKg: 12.5, equipment: '2 dumbbells + bench at 30–45°',
    cues: ['Chest stays glued to the pad', 'Drive elbows back and slightly out', 'Pause and squeeze the shoulder blades'], anim: 'chest-supported-row' },
  { id: 'db-pullover', name: 'Dumbbell Pullover', pattern: 'pull', primary: ['lats'], secondary: ['chest', 'triceps'], load: 'single', repMin: 10, repMax: 12, startKg: 12.5, equipment: '1 dumbbell + flat bench',
    cues: ['Soft, fixed elbows', 'Reach back until you feel the lats stretch', 'Pull back over the chest, ribs down'], anim: 'db-pullover' },
  { id: 'bent-over-row', name: 'Bent-Over Dumbbell Row', pattern: 'pull', primary: ['upperBack', 'lats'], secondary: ['rearDelts', 'biceps', 'lowerBack'], load: 'pair', repMin: 8, repMax: 12, startKg: 12.5, equipment: '2 dumbbells',
    cues: ['Hinge to about 45°, flat back', 'Row to the lower ribs', 'Control the lowering'], anim: 'bent-over-row' },
  { id: 'rear-delt-fly', name: 'Chest-Supported Rear Delt Fly', pattern: 'pull', primary: ['rearDelts', 'upperBack'], secondary: ['traps'], load: 'pair', repMin: 12, repMax: 15, startKg: 5, equipment: '2 light dumbbells + incline bench',
    cues: ['Light weight, slight elbow bend', 'Sweep the arms wide', 'Lead with the pinkies'], anim: 'rear-delt-fly' },

  // ── Arms ───────────────────────────────────────────────────
  { id: 'hammer-curl', name: 'Hammer Curl', pattern: 'biceps', primary: ['biceps', 'forearms'], secondary: [], load: 'pair', repMin: 10, repMax: 15, startKg: 7.5, equipment: '2 dumbbells',
    cues: ['Thumbs up, palms facing in', 'Elbows pinned to your sides', 'No swing, slow lowering'], anim: 'hammer-curl' },
  { id: 'incline-curl', name: 'Incline Dumbbell Curl', pattern: 'biceps', primary: ['biceps'], secondary: ['forearms'], load: 'pair', repMin: 10, repMax: 15, startKg: 5, equipment: '2 dumbbells + bench at 45–60°',
    cues: ['Arms hang straight down behind the body', 'Curl without the elbows drifting forward', 'Full stretch every rep'], anim: 'incline-curl' },
  { id: 'alt-curl', name: 'Alternating Dumbbell Curl', pattern: 'biceps', primary: ['biceps'], secondary: ['forearms'], load: 'pair', repMin: 10, repMax: 15, startKg: 7.5, equipment: '2 dumbbells',
    cues: ['Rotate the palm up as you curl', 'Upper arm stays still', 'Alternate sides, control down'], anim: 'alt-curl' },
  { id: 'overhead-triceps', name: 'Seated Overhead Triceps Extension', pattern: 'triceps', primary: ['triceps'], secondary: [], load: 'single', repMin: 10, repMax: 15, startKg: 10, equipment: '1 dumbbell + upright bench',
    cues: ['Hold one bell with both hands', 'Elbows point forward, close to the head', 'Lower behind the head, extend fully'], anim: 'overhead-triceps' },
  { id: 'skull-crusher', name: 'Dumbbell Skull Crusher', pattern: 'triceps', primary: ['triceps'], secondary: [], load: 'pair', repMin: 10, repMax: 15, startKg: 7.5, equipment: '2 dumbbells + flat bench',
    cues: ['Palms facing each other', 'Only the forearms move', 'Lower beside the head, not onto it'], anim: 'skull-crusher' },
  { id: 'close-grip-press', name: 'Close-Grip Dumbbell Press', pattern: 'triceps', primary: ['triceps'], secondary: ['chest'], load: 'pair', repMin: 10, repMax: 12, startKg: 12.5, equipment: '2 dumbbells + flat bench',
    cues: ['Bells touching, palms facing in', 'Elbows tucked to the ribs', 'Press to full lockout'], anim: 'close-grip-press' },

  // ── Core ───────────────────────────────────────────────────
  { id: 'dead-bug', name: 'Dead Bug', pattern: 'core', primary: ['abs'], secondary: ['hipFlexors'], load: 'bodyweight', perSide: true, repMin: 6, repMax: 10, startKg: 0, equipment: 'Floor',
    cues: ['Lower back pressed into the floor', 'Opposite arm and leg reach long', 'Exhale fully as you reach'], anim: 'dead-bug' },
  { id: 'side-plank', name: 'Side Plank', pattern: 'core', primary: ['obliques'], secondary: ['abs', 'glutes'], load: 'bodyweight', perSide: true, timed: true, repMin: 20, repMax: 40, startKg: 0, equipment: 'Floor',
    cues: ['Elbow under the shoulder', 'Hips high, body in one line', 'Breathe steadily'], anim: 'side-plank' },
  { id: 'reverse-crunch', name: 'Bench Reverse Crunch', pattern: 'core', primary: ['abs'], secondary: ['hipFlexors'], load: 'bodyweight', repMin: 8, repMax: 15, startKg: 0, equipment: 'Flat or decline bench',
    cues: ['Hold the bench behind your head', 'Curl the hips up off the bench', 'Lower slowly, no swinging'], anim: 'reverse-crunch' },
  { id: 'plank', name: 'Front Plank', pattern: 'core', primary: ['abs'], secondary: ['shoulders', 'glutes'], load: 'bodyweight', timed: true, repMin: 20, repMax: 45, startKg: 0, equipment: 'Floor',
    cues: ['Elbows under the shoulders', 'Squeeze glutes, tuck the ribs', 'Straight line head to heels'], anim: 'plank' },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) throw new Error(`Unknown exercise ${id}`);
  return ex;
}

/** Same-pattern alternatives (excluding the exercise itself). */
export function alternativesFor(id: string): Exercise[] {
  const ex = getExercise(id);
  return EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== id);
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  knee: 'Squat / lunge', hinge: 'Hip hinge', push: 'Push', pull: 'Pull', biceps: 'Biceps', triceps: 'Triceps', core: 'Core',
};

export const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest', shoulders: 'Shoulders', rearDelts: 'Rear delts', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Forearms',
  lats: 'Lats', upperBack: 'Upper back', traps: 'Traps', abs: 'Abs', obliques: 'Obliques', lowerBack: 'Lower back',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Adductors', calves: 'Calves', hipFlexors: 'Hip flexors',
};

/** Mobility warm-up (~6 min). Seconds are defaults; Settings can scale them. */
export const WARMUP: GuidedMove[] = [
  { id: 'march', name: 'Marching in Place', seconds: 60, cue: 'Easy pace, swing the arms, breathe through the nose', anim: 'march' },
  { id: 'arm-circles', name: 'Arm Circles', seconds: 40, cue: 'Big slow circles forwards, then backwards', anim: 'arm-circles' },
  { id: 'cat-cow', name: 'Cat–Cow', seconds: 40, cue: 'Round the spine up, then let the chest sink — move slowly', anim: 'cat-cow' },
  { id: 'worlds-greatest', name: "World's Greatest Stretch", seconds: 60, perSide: true, cue: 'Lunge, elbow to instep, then rotate the arm to the ceiling', anim: 'worlds-greatest' },
  { id: 'hip-hinge-drill', name: 'Bodyweight Good Morning', seconds: 40, cue: 'Hands on hips, push hips back with a flat back', anim: 'good-morning' },
  { id: 'bw-squat', name: 'Bodyweight Squat', seconds: 40, cue: 'Sit deep and slow, pause at the bottom', anim: 'bw-squat' },
  { id: 'scap-pushup', name: 'Wall Angel / Overhead Reach', seconds: 40, cue: 'Reach long overhead, then pull elbows down to the ribs', anim: 'wall-angel' },
];

/** Flexibility cool-down (~6 min) incl. a down-regulating breathing block for stress. */
export const COOLDOWN: GuidedMove[] = [
  { id: 'hip-flexor', name: 'Half-Kneeling Hip Flexor Stretch', seconds: 60, perSide: true, cue: 'Tuck the pelvis and squeeze the back glute', anim: 'hip-flexor-stretch' },
  { id: 'hamstring', name: 'Standing Hamstring Stretch', seconds: 40, cue: 'Heel on the bench, hinge forward with a long spine', anim: 'hamstring-stretch' },
  { id: 'figure-four', name: 'Figure-4 Glute Stretch', seconds: 60, perSide: true, cue: 'Ankle over knee, draw the leg in gently', anim: 'figure-four' },
  { id: 'childs-pose', name: "Child's Pose (Lat Reach)", seconds: 40, cue: 'Walk the hands forward, sink the hips back', anim: 'childs-pose' },
  { id: 'chest-opener', name: 'Chest Opener', seconds: 40, cue: 'Hands clasped behind, lift the chest, shoulders down', anim: 'chest-opener' },
  { id: 'breathing', name: 'Box Breathing', seconds: 60, cue: 'In 4 · hold 4 · out 4 · hold 4 — let the session settle', anim: 'breathing' },
];

export const FINISHERS: Finisher[] = [
  { id: 'thruster-intervals', name: 'Thruster Intervals', description: 'Light dumbbell thrusters. Smooth reps, nose breathing on the rest.', rounds: 6, workSec: 20, restSec: 40, moves: ['Dumbbell thruster (light)'], anim: 'thruster' },
  { id: 'farmer-march', name: 'Farmer March', description: 'Heavy dumbbells at your sides, march tall in place.', rounds: 5, workSec: 30, restSec: 30, moves: ['Farmer march (heavy)'], anim: 'farmer-march' },
  { id: 'incline-climbers', name: 'Incline Mountain Climbers', description: 'Hands on the bench, drive the knees at a steady rhythm.', rounds: 6, workSec: 20, restSec: 40, moves: ['Incline mountain climber'], anim: 'mountain-climber' },
];

export const FINISHER_BY_ID: Record<string, Finisher> = Object.fromEntries(FINISHERS.map((f) => [f.id, f]));

/** Muscles emphasised by each warm-up move, stretch and finisher (for the animation highlight). */
export const MOVE_MUSCLES: Record<string, Muscle[]> = {
  march: ['hipFlexors', 'quads'], 'arm-circles': ['shoulders'], 'cat-cow': ['lowerBack', 'abs'], 'worlds-greatest': ['hipFlexors', 'adductors', 'upperBack'],
  'hip-hinge-drill': ['hamstrings', 'glutes'], 'bw-squat': ['quads', 'glutes'], 'scap-pushup': ['shoulders', 'upperBack'],
  'hip-flexor': ['hipFlexors', 'quads'], hamstring: ['hamstrings'], 'figure-four': ['glutes'], 'childs-pose': ['lats', 'lowerBack'], 'chest-opener': ['chest', 'shoulders'], breathing: ['abs'],
  'thruster-intervals': ['quads', 'shoulders', 'glutes'], 'farmer-march': ['forearms', 'traps', 'abs'], 'incline-climbers': ['abs', 'hipFlexors', 'shoulders'],
};
