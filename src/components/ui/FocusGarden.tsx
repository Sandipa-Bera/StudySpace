/**
 * FocusGarden.tsx
 * ─────────────────────────────────────────────────────────
 * Multi-plant Focus Garden UI.
 *
 * GROWTH SYSTEM:
 *   - Every 30 min (GARDEN_INTERVAL_SECONDS) of active focus earns a new plant.
 *   - Each plant grows independently based on focus time since it was planted.
 *   - Stages: Seed → Sprout → Small Plant → Young Plant → Mature Plant → Flowering Plant
 *   - Plants and milestones are persisted to Supabase `garden_plants` table.
 *   - In TEST MODE (VITE_FOCUS_TEST_MODE=true), interval is 1 minute for easy testing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sprout, TreePine, Calendar, Flame, Clock, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  gardenPlantsService,
  derivePlantStage,
  computeGardenStats,
  PLANT_STAGES,
  GARDEN_INTERVAL_SECONDS,
  IS_GARDEN_TEST_MODE,
  type GardenPlant,
  type GardenPlantWithStage,
  type GardenStats,
} from '../../services/gardenPlants.service';
import { formatFocusTime, type FocusStats } from '../../services/focusSessions.service';
import { useAuth } from '../../hooks/useAuth';

// ─── Plant Slot Component ─────────────────────────────────────

const STAGE_CSS: Record<number, string> = {
  0: 'fg2-plant-seed',
  1: 'fg2-plant-sprout',
  2: 'fg2-plant-small',
  3: 'fg2-plant-young',
  4: 'fg2-plant-mature',
  5: 'fg2-plant-flowering',
};

// Variant emojis for each stage so different species look different
const STAGE_EMOJIS: Record<number, string[]> = {
  0: ['🌰', '🫘', '⚪', '🟤', '🟡'],
  1: ['🌱', '🌱', '🌿', '🌱', '🌾'],
  2: ['🌿', '🍃', '🌿', '🫛', '🌿'],
  3: ['🪴', '🎋', '🪴', '🌵', '🪴'],
  4: ['🌳', '🌲', '🌴', '🌳', '🎄'],
  5: ['🌸', '🌺', '🌻', '🌹', '🌼'],
};

function PlantSlot({
  plant,
  onClick,
  isSelected,
}: {
  plant: GardenPlantWithStage;
  onClick: () => void;
  isSelected: boolean;
}) {
  const stageDef = PLANT_STAGES[plant.stage];
  const emoji = STAGE_EMOJIS[plant.stage]?.[plant.species_variant] ?? stageDef.emoji;
  const stageClass = STAGE_CSS[plant.stage] ?? 'fg2-plant-seed';

  return (
    <button
      className={`fg2-plant-slot ${stageClass} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={`${stageDef.name} — click for details`}
      aria-label={`${stageDef.name}, stage ${plant.stage + 1} of 6`}
    >
      <span className="fg2-plant-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="fg2-plant-stage-dot">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`fg2-stage-pip ${i <= plant.stage ? 'filled' : ''}`}
          />
        ))}
      </span>
    </button>
  );
}

// ─── Plant Detail Popover ────────────────────────────────────

function PlantDetail({
  plant,
  onClose,
}: {
  plant: GardenPlantWithStage;
  onClose: () => void;
}) {
  const stageDef = PLANT_STAGES[plant.stage];
  const nextStage = plant.isMaxStage ? null : PLANT_STAGES[plant.stage + 1];
  const emoji = STAGE_EMOJIS[plant.stage]?.[plant.species_variant] ?? stageDef.emoji;

  return (
    <div className="fg2-plant-detail-card" role="dialog" aria-label="Plant details">
      <button className="fg2-plant-detail-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="fg2-plant-detail-emoji">{emoji}</div>
      <h3 className="fg2-plant-detail-name">{stageDef.name}</h3>
      <p className="fg2-plant-detail-desc">{stageDef.description}</p>

      <div className="fg2-plant-detail-stages">
        {PLANT_STAGES.map((s, i) => (
          <div
            key={i}
            className={`fg2-stage-dot-lg ${i <= plant.stage ? 'reached' : ''} ${i === plant.stage ? 'current' : ''}`}
            title={s.name}
          >
            {STAGE_EMOJIS[i]?.[0] ?? s.emoji}
          </div>
        ))}
      </div>

      {!plant.isMaxStage && nextStage && (
        <div className="fg2-plant-detail-progress">
          <div className="fg2-plant-detail-progress-bar">
            <div
              className="fg2-plant-detail-progress-fill"
              style={{ width: `${plant.progressToNext * 100}%` }}
            />
          </div>
          <div className="fg2-plant-detail-progress-label">
            {formatFocusTime(plant.secondsToNext)} until → {nextStage.name}
          </div>
        </div>
      )}

      {plant.isMaxStage && (
        <div className="fg2-plant-max-badge">🏆 Fully Bloomed!</div>
      )}
    </div>
  );
}

// ─── Progress Bar to next milestone ────────────────────────

function NextMilestoneBar({ stats }: { stats: GardenStats }) {
  const pct = Math.round(stats.progressToNextMilestone * 100);
  const remainingMin = Math.ceil(stats.secondsToNextMilestone / 60);

  return (
    <div className="fg2-milestone-bar-wrap">
      <div className="fg2-milestone-bar-header">
        <span className="fg2-milestone-bar-label">
          🌱 Next seed in{' '}
          <strong>
            {IS_GARDEN_TEST_MODE
              ? `${Math.ceil(stats.secondsToNextMilestone)}s (test)`
              : `${remainingMin}m of focus`}
          </strong>
        </span>
        <span className="fg2-milestone-bar-pct">{pct}%</span>
      </div>
      <div className="fg2-milestone-progress-track">
        <div
          className="fg2-milestone-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Celebration Overlay ──────────────────────────────────────

function MilestoneCelebration({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fg2-celebration-overlay" onClick={onDismiss}>
      <div className="fg2-celebration-card" onClick={(e) => e.stopPropagation()}>
        <div className="fg2-celebration-confetti" aria-hidden="true">
          {['🌸', '✨', '🌱', '⭐', '🌿', '💫'].map((e, i) => (
            <span key={i} className="fg2-confetti-piece" style={{ '--i': i } as React.CSSProperties}>
              {e}
            </span>
          ))}
        </div>
        <p className="fg2-celebration-message">{message}</p>
        <button className="fg2-celebration-btn" onClick={onDismiss}>
          🎉 Wonderful!
        </button>
      </div>
    </div>
  );
}

// ─── Garden Grid with pagination ─────────────────────────────

const PLANTS_PER_PAGE = 24;

function GardenGrid({
  plants,
  selectedId,
  onSelectPlant,
}: {
  plants: GardenPlantWithStage[];
  selectedId: string | null;
  onSelectPlant: (plant: GardenPlantWithStage) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(plants.length / PLANTS_PER_PAGE);
  const pagePlants = plants.slice(page * PLANTS_PER_PAGE, (page + 1) * PLANTS_PER_PAGE);

  // Reverse so newest plants show first
  const displayPlants = [...pagePlants].reverse();

  return (
    <div className="fg2-garden-grid-wrap">
      {totalPages > 1 && (
        <div className="fg2-pagination">
          <button
            className="fg2-page-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="fg2-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="fg2-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="fg2-garden-grid" role="list" aria-label="Your garden plants">
        {displayPlants.map((plant) => (
          <PlantSlot
            key={plant.id}
            plant={plant}
            isSelected={selectedId === plant.id}
            onClick={() => onSelectPlant(plant)}
          />
        ))}
      </div>

      {plants.length === 0 && (
        <div className="fg2-empty-garden">
          <span className="fg2-empty-emoji">🌰</span>
          <p className="fg2-empty-title">Your garden is waiting</p>
          <p className="fg2-empty-desc">
            Complete your first{' '}
            {IS_GARDEN_TEST_MODE ? '1-minute (test)' : '30-minute'} focus session to plant
            your first seed!
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function GardenSkeleton() {
  return (
    <div className="fg2-skeleton-wrap">
      <div className="fg-skeleton fg2-skeleton-bar" />
      <div className="fg2-skeleton-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="fg-skeleton fg2-skeleton-plant" />
        ))}
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`fg-stat-card${accent ? ' accent' : ''}`}>
      <div className="fg-stat-icon">{icon}</div>
      <div className="fg-stat-body">
        <div className="fg-stat-value">{value}</div>
        <div className="fg-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface FocusGardenProps {
  stats: FocusStats | null;
  loading: boolean;
  justCompleted?: boolean;
  onJustCompletedDismiss?: () => void;
  prevTotalSeconds?: number;
}

export function FocusGarden({
  stats,
  loading,
  justCompleted = false,
  onJustCompletedDismiss,
  prevTotalSeconds = 0,
}: FocusGardenProps) {
  const { user } = useAuth();

  const [plants, setPlants] = useState<GardenPlantWithStage[]>([]);
  const [gardenStats, setGardenStats] = useState<GardenStats | null>(null);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<GardenPlantWithStage | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  const prevSecondsRef = useRef(prevTotalSeconds);
  const rawPlantsRef = useRef<GardenPlant[]>([]);

  // ─── Load & Sync Plants ────────────────────────────────────
  const loadAndSyncPlants = useCallback(
    async (totalFocusSeconds: number, celebrate: boolean) => {
      if (!user) return;
      setLoadingPlants(true);

      try {
        // 1. Fetch existing plants from Supabase
        const existingPlants = await gardenPlantsService.getPlants(user.id);
        rawPlantsRef.current = existingPlants;

        // 2. Sync any missing milestone plants (idempotent upsert)
        const newlyCreated = await gardenPlantsService.syncMilestones(
          user.id,
          totalFocusSeconds,
          existingPlants
        );

        // 3. Merge
        const allRaw: GardenPlant[] = [
          ...existingPlants,
          ...newlyCreated.filter((n) => !existingPlants.find((e) => e.id === n.id)),
        ].sort((a, b) => a.planted_at_seconds - b.planted_at_seconds);

        rawPlantsRef.current = allRaw;

        // 4. Derive growth stages
        const withStages = allRaw.map((p) => derivePlantStage(p, totalFocusSeconds));
        setPlants(withStages);
        setGardenStats(computeGardenStats(withStages, totalFocusSeconds));

        // 5. Celebration if we just earned new plants
        if (celebrate && newlyCreated.length > 0) {
          const msg =
            newlyCreated.length === 1
              ? `🌱 30 minutes of focus! A new seed has been planted in your garden!`
              : `🌱 ${newlyCreated.length} new seeds planted! Keep up the incredible focus!`;
          setCelebrationMessage(msg);
        }
      } catch (err) {
        console.warn('Failed to load/sync garden plants:', err);
      } finally {
        setLoadingPlants(false);
      }
    },
    [user]
  );

  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !stats) return;
    const total = stats.total_seconds;
    loadAndSyncPlants(total, false);
  }, [user, stats, loadAndSyncPlants]);

  // ─── Sync after session completed ─────────────────────────
  useEffect(() => {
    if (!justCompleted || !stats || !user) return;

    const prevTotal = prevSecondsRef.current;
    const newTotal = stats.total_seconds;
    prevSecondsRef.current = newTotal;

    if (newTotal > prevTotal) {
      // Re-derive stage for existing plants + sync any new ones
      const updated = rawPlantsRef.current.map((p) => derivePlantStage(p, newTotal));
      setPlants(updated);
      setGardenStats(computeGardenStats(updated, newTotal));

      // Check if new milestones were crossed
      loadAndSyncPlants(newTotal, true);
    }
  }, [justCompleted, stats, user, loadAndSyncPlants]);

  // ─── Update displayed stages whenever stats change ─────────
  useEffect(() => {
    if (!stats || rawPlantsRef.current.length === 0) return;
    const total = stats.total_seconds;
    const updated = rawPlantsRef.current.map((p) => derivePlantStage(p, total));
    setPlants(updated);
    setGardenStats(computeGardenStats(updated, total));
  }, [stats]);

  const totalMinutes = stats ? Math.floor(stats.total_seconds / 60) : 0;
  const isLoading = loading || loadingPlants;

  return (
    <section className="fg2-section">
      {/* ── Header ── */}
      <div className="fg-header">
        <div className="fg-header-icon">
          <TreePine size={20} />
        </div>
        <div>
          <h2 className="fg-title">Focus Garden</h2>
          <p className="fg-subtitle">
            {IS_GARDEN_TEST_MODE
              ? '🧪 Test Mode: 1-minute milestones'
              : 'A new seed every 30 minutes of focus'}
          </p>
        </div>
      </div>

      {isLoading && <GardenSkeleton />}

      {!isLoading && (
        <>
          {/* ── Stats Row ── */}
          <div className="fg-stats-grid">
            <StatCard
              icon={<Clock size={16} />}
              label="Today"
              value={formatFocusTime(stats?.today_seconds ?? 0)}
            />
            <StatCard
              icon={<Sprout size={16} />}
              label="Total Focus"
              value={formatFocusTime(stats?.total_seconds ?? 0)}
            />
            <StatCard
              icon={<TreePine size={16} />}
              label="Total Plants"
              value={String(gardenStats?.totalPlants ?? 0)}
              accent={(gardenStats?.totalPlants ?? 0) > 0}
            />
            <StatCard
              icon={<Target size={16} />}
              label="Fully Bloomed"
              value={String(gardenStats?.maturePlants ?? 0)}
            />
            <StatCard
              icon={<Flame size={16} />}
              label="Streak"
              value={`${stats?.current_streak ?? 0}d`}
              accent={(stats?.current_streak ?? 0) > 0}
            />
          </div>

          {/* ── Next milestone progress bar ── */}
          {gardenStats && (
            <NextMilestoneBar stats={gardenStats} />
          )}

          {/* ── Stage legend ── */}
          <div className="fg2-legend">
            {[0, 1, 2, 3, 4, 5].map((stage) => {
              const def = PLANT_STAGES[stage];
              const emoji = STAGE_EMOJIS[stage]?.[0] ?? def.emoji;
              return (
                <div key={stage} className="fg2-legend-item" title={def.description}>
                  <span className="fg2-legend-emoji">{emoji}</span>
                  <span className="fg2-legend-label">{def.name}</span>
                </div>
              );
            })}
          </div>

          {/* ── Garden Grid ── */}
          <div className="fg2-garden-wrap">
            <div className="fg2-garden-soil">
              <GardenGrid
                plants={plants}
                selectedId={selectedPlant?.id ?? null}
                onSelectPlant={(p) =>
                  setSelectedPlant(selectedPlant?.id === p.id ? null : p)
                }
              />
            </div>

            {/* Plant detail panel */}
            {selectedPlant && (
              <PlantDetail
                plant={selectedPlant}
                onClose={() => setSelectedPlant(null)}
              />
            )}
          </div>

          {/* ── Growth guide ── */}
          <div className="fg2-guide">
            <span className="fg2-guide-icon">💡</span>
            <p className="fg2-guide-text">
              Each{' '}
              <strong>
                {IS_GARDEN_TEST_MODE ? '1 minute' : '30 minutes'}
              </strong>{' '}
              of active focus earns a new seed. Seeds grow one stage per{' '}
              <strong>
                {IS_GARDEN_TEST_MODE ? 'minute' : '30 minutes'}
              </strong>{' '}
              of focus after they're planted. Break time and paused time don't count.
            </p>
          </div>
        </>
      )}

      {/* ── Celebration Overlay ── */}
      {celebrationMessage && (
        <MilestoneCelebration
          message={celebrationMessage}
          onDismiss={() => {
            setCelebrationMessage(null);
            onJustCompletedDismiss?.();
          }}
        />
      )}
    </section>
  );
}
