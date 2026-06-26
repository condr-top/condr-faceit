export interface EloRank {
  level: number
  label: string
  /** min ELO for this rank (inclusive) */
  min: number
  /** max ELO for this rank (inclusive), Infinity for the top rank */
  max: number
  /** primary accent color */
  color: string
  /** subtle background tint */
  bg: string
}

/**
 * CONDR ELO rank table.
 * Challenger (Top 1,000) is handled separately via leaderboard position;
 * here we expose Level 10 as 2001+.
 */
// Цветовые группы ранга (рамка значков + тема профиля):
//  1     — серый
//  2-3   — зелёный
//  4-7   — жёлтый
//  8-10  — красный
const GREY = '#9CA3AF', GREY_BG = 'rgba(156,163,175,0.16)'
const GREEN = '#22C55E', GREEN_BG = 'rgba(34,197,94,0.16)'
const YELLOW = '#EAB308', YELLOW_BG = 'rgba(234,179,8,0.16)'
const RED = '#EF4444', RED_BG = 'rgba(239,68,68,0.16)'

export const ELO_RANKS: EloRank[] = [
  { level: 1,  label: 'Level 1',  min: 100,  max: 500,  color: GREY,   bg: GREY_BG   },
  { level: 2,  label: 'Level 2',  min: 501,  max: 750,  color: GREEN,  bg: GREEN_BG  },
  { level: 3,  label: 'Level 3',  min: 751,  max: 900,  color: GREEN,  bg: GREEN_BG  },
  { level: 4,  label: 'Level 4',  min: 901,  max: 1050, color: YELLOW, bg: YELLOW_BG },
  { level: 5,  label: 'Level 5',  min: 1051, max: 1200, color: YELLOW, bg: YELLOW_BG },
  { level: 6,  label: 'Level 6',  min: 1201, max: 1350, color: YELLOW, bg: YELLOW_BG },
  { level: 7,  label: 'Level 7',  min: 1351, max: 1530, color: YELLOW, bg: YELLOW_BG },
  { level: 8,  label: 'Level 8',  min: 1531, max: 1750, color: RED,    bg: RED_BG    },
  { level: 9,  label: 'Level 9',  min: 1751, max: 2000, color: RED,    bg: RED_BG    },
  { level: 10, label: 'Level 10', min: 2001, max: Infinity, color: RED, bg: RED_BG   },
]

/** Challenger требует ОДНОВРЕМЕННО: топ-5 глобального рейтинга И 2000+ ELO. */
export const CHALLENGER_MIN_ELO = 2000
export const CHALLENGER_TOP_N = 5
export function qualifiesChallenger(elo: number, globalRank: number | null | undefined): boolean {
  return globalRank != null && globalRank <= CHALLENGER_TOP_N && elo >= CHALLENGER_MIN_ELO
}

export const CHALLENGER_RANK: EloRank = {
  level: 11,
  label: 'Challenger',
  min: 2001,
  max: Infinity,
  color: '#E8092E',
  bg: 'rgba(232,9,46,0.15)',
}

export function getEloRank(elo: number): EloRank {
  for (let i = ELO_RANKS.length - 1; i >= 0; i--) {
    if (elo >= ELO_RANKS[i].min) return ELO_RANKS[i]
  }
  return ELO_RANKS[0]
}

/** Percentage progress within the current rank tier (0–1). */
export function getRankProgress(elo: number): number {
  const rank = getEloRank(elo)
  if (rank.max === Infinity) return 1
  return Math.min(1, (elo - rank.min) / (rank.max - rank.min + 1))
}
