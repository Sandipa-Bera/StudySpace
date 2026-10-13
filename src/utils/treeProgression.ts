/**
 * treeProgression.ts
 * ─────────────────────────────────────────────────────────
 * Centralized, deterministic tree growth logic.
 *
 * ALL tree-state decisions go through getTreeStage().
 * Never compute tree state in UI components directly.
 *
 * Test mode: set VITE_FOCUS_TEST_MODE=true in .env.local
 * to use 1-minute increments for development testing.
 */

// ─── Stage Definitions ────────────────────────────────────

export interface TreeStageDefinition {
  stage: number;
  name: string;
  emoji: string;
  description: string;
  requiredMinutes: number;  // minutes needed to REACH this stage
  milestoneMessage: string; // shown when this stage is newly reached
}

// ─── Test Mode Detection ─────────────────────────────────
// Set VITE_FOCUS_TEST_MODE=true in .env.local to enable
const TEST_MODE = import.meta.env.VITE_FOCUS_TEST_MODE === 'true';

/**
 * PRODUCTION progression (hours of focus):
 *   0m → Seed, 30m → Sprout, 1h → Small Plant, 2h → Young Tree...
 *
 * TEST MODE progression (minutes of focus):
 *   0m → Seed, 1m → Sprout, 2m → Small Plant, 5m → Young Tree...
 */
export const TREE_STAGES: TreeStageDefinition[] = TEST_MODE
  ? [
      // ─── TEST MODE: 1-minute increments for easy testing ───
      {
        stage: 0,
        name: 'Seed',
        emoji: '🌰',
        description: 'Plant your first seed of focus.',
        requiredMinutes: 0,
        milestoneMessage: '🌰 Your seed is planted — start focusing!',
      },
      {
        stage: 1,
        name: 'Sprout',
        emoji: '🌱',
        description: 'A tiny sprout pokes through.',
        requiredMinutes: 1,
        milestoneMessage: '🌱 Your sprout emerged! Keep going!',
      },
      {
        stage: 2,
        name: 'Small Plant',
        emoji: '🌿',
        description: 'Leaves are starting to form.',
        requiredMinutes: 2,
        milestoneMessage: '🌿 Your plant is growing beautifully!',
      },
      {
        stage: 3,
        name: 'Young Tree',
        emoji: '🌳',
        description: 'A young tree stands strong.',
        requiredMinutes: 5,
        milestoneMessage: "🌳 A young tree rises — you're building a habit!",
      },
      {
        stage: 4,
        name: 'Growing Tree',
        emoji: '🌲',
        description: 'Your tree is reaching for the sky.',
        requiredMinutes: 10,
        milestoneMessage: '🌲 Your tree is growing tall!',
      },
      {
        stage: 5,
        name: 'Mature Tree',
        emoji: '🌳',
        description: 'A full, mature tree full of wisdom.',
        requiredMinutes: 15,
        milestoneMessage: '🌳 Your tree has matured — incredible!',
      },
      {
        stage: 6,
        name: 'First Fruit',
        emoji: '🍎',
        description: 'The first fruits of your labor appear.',
        requiredMinutes: 20,
        milestoneMessage: '🍎 Your first fruit bloomed!',
      },
      {
        stage: 7,
        name: 'Thriving Tree',
        emoji: '🌸',
        description: 'Your tree blossoms in full glory.',
        requiredMinutes: 30,
        milestoneMessage: '🌸 Your tree is thriving!',
      },
      {
        stage: 8,
        name: 'Ancient Tree',
        emoji: '🌳✨',
        description: 'A legendary tree that will stand forever.',
        requiredMinutes: 50,
        milestoneMessage: "✨ You've grown an Ancient Tree!",
      },
    ]
  : [
      // ─── PRODUCTION progression (real hours) ─────────────
      {
        stage: 0,
        name: 'Seed',
        emoji: '🌰',
        description: 'Plant your first seed of focus.',
        requiredMinutes: 0,
        milestoneMessage: '🌰 Your seed is planted — start focusing!',
      },
      {
        stage: 1,
        name: 'Sprout',
        emoji: '🌱',
        description: 'A tiny sprout pokes through.',
        requiredMinutes: 30,
        milestoneMessage: '🌱 Your sprout emerged! Keep going!',
      },
      {
        stage: 2,
        name: 'Small Plant',
        emoji: '🌿',
        description: 'Leaves are starting to form.',
        requiredMinutes: 60,
        milestoneMessage: '🌿 Your plant is growing beautifully!',
      },
      {
        stage: 3,
        name: 'Young Tree',
        emoji: '🌳',
        description: 'A young tree stands strong.',
        requiredMinutes: 120,
        milestoneMessage: "🌳 A young tree rises — you're building a habit!",
      },
      {
        stage: 4,
        name: 'Growing Tree',
        emoji: '🌲',
        description: 'Your tree is reaching for the sky.',
        requiredMinutes: 300,
        milestoneMessage: '🌲 Your tree is growing tall with your dedication!',
      },
      {
        stage: 5,
        name: 'Mature Tree',
        emoji: '🌳',
        description: 'A full, mature tree full of wisdom.',
        requiredMinutes: 480,
        milestoneMessage: '🌳 Your tree has matured — incredible focus!',
      },
      {
        stage: 6,
        name: 'First Fruit',
        emoji: '🍎',
        description: 'The first fruits of your labor appear.',
        requiredMinutes: 600,
        milestoneMessage: '🍎 Your first fruit bloomed — 10 hours of focus!',
      },
      {
        stage: 7,
        name: 'Thriving Tree',
        emoji: '🌸',
        description: 'Your tree blossoms in full glory.',
        requiredMinutes: 1200,
        milestoneMessage: '🌸 Your tree is thriving — an extraordinary achievement!',
      },
      {
        stage: 8,
        name: 'Ancient Tree',
        emoji: '🌳✨',
        description: 'A legendary tree that will stand forever.',
        requiredMinutes: 3000,
        milestoneMessage: "✨ You've grown an Ancient Tree — legendary focus!",
      },
    ];

export const IS_TEST_MODE = TEST_MODE;

// ─── Output Type ──────────────────────────────────────────

export interface TreeStage {
  stage: number;
  name: string;
  emoji: string;
  description: string;
  requiredMinutes: number;
  currentMinutes: number;
  nextStageMinutes: number;
  remainingToNext: number;
  progressToNext: number;
  isMaxStage: boolean;
  milestoneMessage: string;
}

// ─── Main function ────────────────────────────────────────

/**
 * Deterministically calculate the tree state from total focus minutes.
 * Same input always produces same output — safe to call on every render.
 */
export function getTreeStage(totalFocusMinutes: number): TreeStage {
  const minutes = Math.max(0, Math.floor(totalFocusMinutes));

  // Find the highest stage the user has reached
  let currentStageDef = TREE_STAGES[0];
  for (const stageDef of TREE_STAGES) {
    if (minutes >= stageDef.requiredMinutes) {
      currentStageDef = stageDef;
    } else {
      break;
    }
  }

  const currentIdx = TREE_STAGES.indexOf(currentStageDef);
  const isMaxStage = currentIdx === TREE_STAGES.length - 1;
  const nextStageDef = isMaxStage ? null : TREE_STAGES[currentIdx + 1];

  const nextStageMinutes = nextStageDef?.requiredMinutes ?? 0;
  const remainingToNext = nextStageDef
    ? Math.max(0, nextStageDef.requiredMinutes - minutes)
    : 0;

  let progressToNext = 1;
  if (!isMaxStage && nextStageDef) {
    const stageSpan = nextStageDef.requiredMinutes - currentStageDef.requiredMinutes;
    const minutesIntoStage = minutes - currentStageDef.requiredMinutes;
    progressToNext = stageSpan > 0 ? Math.min(1, minutesIntoStage / stageSpan) : 1;
  }

  return {
    stage: currentStageDef.stage,
    name: currentStageDef.name,
    emoji: currentStageDef.emoji,
    description: currentStageDef.description,
    requiredMinutes: currentStageDef.requiredMinutes,
    currentMinutes: minutes,
    nextStageMinutes,
    remainingToNext,
    progressToNext,
    isMaxStage,
    milestoneMessage: currentStageDef.milestoneMessage,
  };
}

/**
 * Check if total focus time crossed a stage boundary.
 * Returns the newly reached stage definition, or null.
 */
export function checkMilestoneReached(
  prevMinutes: number,
  newMinutes: number
): TreeStageDefinition | null {
  if (newMinutes <= prevMinutes) return null;
  const prevStage = getTreeStage(prevMinutes);
  const newStage = getTreeStage(newMinutes);
  if (newStage.stage > prevStage.stage) {
    return TREE_STAGES[newStage.stage];
  }
  return null;
}
