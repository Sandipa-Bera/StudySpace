/**
 * gardenPlants.service.ts
 * ─────────────────────────────────────────────────────────────
 * Service layer for the multi-plant Focus Garden system.
 *
 * GROWTH MODEL:
 *   - Every 1800 seconds (30 min) of accumulated active focus earns a new plant.
 *   - Each plant's growth stage is derived from:
 *       stage = clamp(floor((totalFocusSeconds - plant.planted_at_seconds) / 1800), 0, MAX_STAGE)
 *   - Stage 0 = Seed, Stage 1 = Sprout, ..., Stage 5 = Flowering Plant (max).
 *   - The initial seed is "planted" at 0 seconds.
 *   - After every 1800s milestone, a new seed is planted at that milestone.
 *
 * DEDUPLICATION:
 *   The (user_id, planted_at_seconds) pair has a UNIQUE index in Supabase.
 *   So inserting the same plant twice (e.g. after a page refresh) is a no-op.
 *
 * TEST MODE:
 *   Set VITE_FOCUS_TEST_MODE=true to use 1-minute (60s) milestones.
 */

import { supabase } from '../lib/supabase';

// ─── Constants ───────────────────────────────────────────────

const TEST_MODE = import.meta.env.VITE_FOCUS_TEST_MODE === 'true';

/** Seconds of active focus per growth interval (30 min production, 1 min test) */
export const GARDEN_INTERVAL_SECONDS = TEST_MODE ? 60 : 1800;

/** Number of growth stages (0 = Seed → MAX_PLANT_STAGE = Flowering Plant) */
export const MAX_PLANT_STAGE = 5;

/** Total stages count */
export const TOTAL_PLANT_STAGES = MAX_PLANT_STAGE + 1; // 6 stages

export const IS_GARDEN_TEST_MODE = TEST_MODE;

// ─── Types ───────────────────────────────────────────────────

export interface GardenPlant {
  id: string;
  user_id: string;
  planted_at_seconds: number; // cumulative focus-seconds when planted
  species_variant: number;    // 0-4, for visual variety
  nickname: string | null;
  created_at: string;
}

export interface GardenPlantWithStage extends GardenPlant {
  /** Derived: 0=Seed, 1=Sprout, 2=SmallPlant, 3=YoungPlant, 4=MaturePlant, 5=FloweringPlant */
  stage: number;
  /** Seconds of focus since this plant was planted */
  focusSinceePlanted: number;
  /** Progress fraction [0,1] toward next stage */
  progressToNext: number;
  /** Seconds remaining until next stage (0 if max stage) */
  secondsToNext: number;
  /** True if plant is at max growth */
  isMaxStage: boolean;
}

export interface GardenStats {
  totalPlants: number;
  maturePlants: number;
  totalFocusSeconds: number;
  secondsToNextMilestone: number;
  nextMilestoneAt: number;
  progressToNextMilestone: number; // fraction 0-1
}

// ─── Stage Definitions ───────────────────────────────────────

export interface PlantStageDefinition {
  stage: number;
  name: string;
  emoji: string;
  description: string;
  celebrationMessage: string;
}

export const PLANT_STAGES: PlantStageDefinition[] = [
  {
    stage: 0,
    name: 'Seed',
    emoji: '🌰',
    description: 'A tiny seed full of potential.',
    celebrationMessage: 'A new seed has been planted in your garden! 🌰',
  },
  {
    stage: 1,
    name: 'Sprout',
    emoji: '🌱',
    description: 'A tiny sprout pokes through the soil.',
    celebrationMessage: 'Your seed sprouted! Keep focusing! 🌱',
  },
  {
    stage: 2,
    name: 'Small Plant',
    emoji: '🌿',
    description: 'Small leaves are forming beautifully.',
    celebrationMessage: 'Your plant is growing! Beautiful green leaves! 🌿',
  },
  {
    stage: 3,
    name: 'Young Plant',
    emoji: '🪴',
    description: 'A confident young plant stands tall.',
    celebrationMessage: "Your young plant stands strong! You're building momentum! 🪴",
  },
  {
    stage: 4,
    name: 'Mature Plant',
    emoji: '🌳',
    description: 'A full, mature plant radiating calm.',
    celebrationMessage: 'A mature plant has grown from your dedication! 🌳',
  },
  {
    stage: 5,
    name: 'Flowering Plant',
    emoji: '🌸',
    description: 'In full bloom — a testament to your focus.',
    celebrationMessage: "Your plant is in FULL BLOOM! Extraordinary focus! 🌸✨",
  },
];

// ─── Derived Stage Calculator ─────────────────────────────────

/**
 * Calculate a plant's current growth stage from:
 *  - totalFocusSeconds: user's total accumulated active focus
 *  - plant.planted_at_seconds: total focus when plant was created
 */
export function derivePlantStage(
  plant: GardenPlant,
  totalFocusSeconds: number
): GardenPlantWithStage {
  const focusSince = Math.max(0, totalFocusSeconds - plant.planted_at_seconds);
  const rawStage = Math.floor(focusSince / GARDEN_INTERVAL_SECONDS);
  const stage = Math.min(rawStage, MAX_PLANT_STAGE);
  const isMaxStage = stage >= MAX_PLANT_STAGE;

  const secondsIntoCurrentStage = focusSince - stage * GARDEN_INTERVAL_SECONDS;
  const progressToNext = isMaxStage
    ? 1
    : Math.min(1, secondsIntoCurrentStage / GARDEN_INTERVAL_SECONDS);
  const secondsToNext = isMaxStage
    ? 0
    : Math.max(0, GARDEN_INTERVAL_SECONDS - secondsIntoCurrentStage);

  return {
    ...plant,
    stage,
    focusSinceePlanted: focusSince,
    progressToNext,
    secondsToNext,
    isMaxStage,
  };
}

/**
 * Compute the set of milestone marks (in seconds) where plants should exist.
 * milestones: [0, INTERVAL, 2*INTERVAL, ...]
 * For totalFocusSeconds=3700 (INTERVAL=1800): [0, 1800, 3600]
 */
export function computeExpectedMilestones(totalFocusSeconds: number): number[] {
  const count = Math.floor(totalFocusSeconds / GARDEN_INTERVAL_SECONDS) + 1;
  return Array.from({ length: count }, (_, i) => i * GARDEN_INTERVAL_SECONDS);
}

/**
 * Calculate garden-level stats from plants + total focus time.
 */
export function computeGardenStats(
  plants: GardenPlantWithStage[],
  totalFocusSeconds: number
): GardenStats {
  const maturePlants = plants.filter((p) => p.isMaxStage).length;
  const nextMilestoneAt =
    (Math.floor(totalFocusSeconds / GARDEN_INTERVAL_SECONDS) + 1) *
    GARDEN_INTERVAL_SECONDS;
  const secondsToNextMilestone = Math.max(0, nextMilestoneAt - totalFocusSeconds);
  const progressToNextMilestone =
    (totalFocusSeconds % GARDEN_INTERVAL_SECONDS) / GARDEN_INTERVAL_SECONDS;

  return {
    totalPlants: plants.length,
    maturePlants,
    totalFocusSeconds,
    secondsToNextMilestone,
    nextMilestoneAt,
    progressToNextMilestone,
  };
}

// ─── Service ─────────────────────────────────────────────────

export const gardenPlantsService = {
  /**
   * Fetch all plants for a user, ordered by planted_at_seconds ASC.
   */
  async getPlants(userId: string): Promise<GardenPlant[]> {
    const { data, error } = await supabase
      .from('garden_plants')
      .select('*')
      .eq('user_id', userId)
      .order('planted_at_seconds', { ascending: true });

    if (error) {
      console.warn('Failed to fetch garden plants:', error);
      return [];
    }
    return (data ?? []) as GardenPlant[];
  },

  /**
   * Ensure all expected milestone plants exist for the user.
   * Idempotent: the UNIQUE index on (user_id, planted_at_seconds) means
   * duplicate inserts will fail gracefully via ON CONFLICT DO NOTHING.
   *
   * Returns array of newly created plants (empty if all already existed).
   */
  async syncMilestones(
    userId: string,
    totalFocusSeconds: number,
    existingPlants: GardenPlant[]
  ): Promise<GardenPlant[]> {
    const expectedMilestones = computeExpectedMilestones(totalFocusSeconds);
    const existingMilestones = new Set(existingPlants.map((p) => p.planted_at_seconds));

    const missedMilestones = expectedMilestones.filter(
      (m) => !existingMilestones.has(m)
    );

    if (missedMilestones.length === 0) return [];

    // Assign species variants deterministically for consistent visuals
    const rows = missedMilestones.map((milestone) => ({
      user_id: userId,
      planted_at_seconds: milestone,
      species_variant: milestone === 0 ? 0 : (Math.floor(milestone / GARDEN_INTERVAL_SECONDS) % 5),
    }));

    const { data, error } = await supabase
      .from('garden_plants')
      .upsert(rows, {
        onConflict: 'user_id,planted_at_seconds',
        ignoreDuplicates: true,
      })
      .select();

    if (error) {
      console.warn('Failed to sync garden milestone plants:', error);
      return [];
    }
    return (data ?? []) as GardenPlant[];
  },

  /**
   * Quick check: how many milestones have been reached?
   * Returns milestoneCount = floor(totalFocusSeconds / INTERVAL) + 1 (initial seed counts)
   */
  computeMilestoneCount(totalFocusSeconds: number): number {
    return Math.floor(totalFocusSeconds / GARDEN_INTERVAL_SECONDS) + 1;
  },
};
