// ════════════════════════════════════════════════════════════════════════════
//  CPR (Condr Performance Rating) — скрытый рейтинг игрока.
//  Чистые функции по спецификации CPL/CPL-Q. Никогда не показывается игроку.
// ════════════════════════════════════════════════════════════════════════════

/** Линейная интерполяция по таблице контрольных точек {x: y}, с клампом по краям. */
function interp(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** 2.1 Win Rate Score (winRate в процентах 0–100). */
export function winRateScore(winRatePct: number): number {
  return interp(winRatePct, [
    [40, 0], [45, 20], [50, 40], [55, 60], [60, 75], [65, 90], [70, 100],
  ]);
}

/** 2.2 Average Match Rating Score (avgRating, напр. 1.05). */
export function ratingScore(avgRating: number): number {
  return interp(avgRating, [
    [0.80, 0], [0.90, 25], [1.00, 50], [1.10, 70], [1.20, 85], [1.30, 100],
  ]);
}

/** 2.3 Activity Score (с насыщением) — ступенчатая шкала по числу матчей. */
export function activityScore(matches: number): number {
  if (matches >= 25) return 100;
  if (matches >= 20) return 95;
  if (matches >= 15) return 80;
  if (matches >= 10) return 60;
  if (matches >= 5) return 35;
  return 10; // 0–4
}

/** 3. Confidence Factor — доверие к выборке по числу матчей. */
export function confidenceFactor(matches: number): number {
  if (matches >= 25) return 1.0;
  if (matches >= 20) return 0.97;
  if (matches >= 15) return 0.9;
  if (matches >= 10) return 0.75;
  if (matches >= 5) return 0.6;
  return 0.4; // 1–4
}

export interface CprInput {
  winRatePct: number; // 0–100
  avgRating: number;  // напр. 1.05
  matches: number;
}

export interface CprResult {
  cpr: number;       // итоговый (с confidence)
  base: number;      // до confidence
  confidence: number;
  wrScore: number;
  ratingScore: number;
  activityScore: number;
}

/** 4. Итоговый CPR: base = WR*0.55 + Rating*0.30 + Activity*0.15, затем × confidence. */
export function computeCpr(input: CprInput): CprResult {
  const wr = winRateScore(input.winRatePct);
  const rt = ratingScore(input.avgRating);
  const act = activityScore(input.matches);
  const base = wr * 0.55 + rt * 0.30 + act * 0.15;
  const conf = confidenceFactor(input.matches);
  return {
    cpr: Math.round(base * conf * 100) / 100,
    base: Math.round(base * 100) / 100,
    confidence: conf,
    wrScore: Math.round(wr * 100) / 100,
    ratingScore: Math.round(rt * 100) / 100,
    activityScore: act,
  };
}

/** 7. Weekly Points за место в недельном топе (1-based rank). */
export function weeklyPointsForRank(rank: number): number {
  const table: Record<number, number> = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
  };
  return table[rank] ?? 0; // 11–20 и ниже → 0
}

/** Минимум матчей за неделю для участия в Weekly Leaderboard. */
export const WEEKLY_MIN_MATCHES = 10;
