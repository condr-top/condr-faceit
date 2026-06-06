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
export const ELO_RANKS: EloRank[] = [
  { level: 1,  label: 'Level 1',  min: 100,  max: 500,  color: '#4B5563', bg: 'rgba(75,85,99,0.18)'    },
  { level: 2,  label: 'Level 2',  min: 501,  max: 750,  color: '#16A34A', bg: 'rgba(22,163,74,0.18)'   },
  { level: 3,  label: 'Level 3',  min: 751,  max: 900,  color: '#22C55E', bg: 'rgba(34,197,94,0.18)'   },
  { level: 4,  label: 'Level 4',  min: 901,  max: 1050, color: '#EAB308', bg: 'rgba(234,179,8,0.18)'   },
  { level: 5,  label: 'Level 5',  min: 1051, max: 1200, color: '#84CC16', bg: 'rgba(132,204,22,0.18)'  },
  { level: 6,  label: 'Level 6',  min: 1201, max: 1350, color: '#FACC15', bg: 'rgba(250,204,21,0.18)'  },
  { level: 7,  label: 'Level 7',  min: 1351, max: 1530, color: '#F59E0B', bg: 'rgba(245,158,11,0.18)'  },
  { level: 8,  label: 'Level 8',  min: 1531, max: 1750, color: '#F97316', bg: 'rgba(249,115,22,0.18)'  },
  { level: 9,  label: 'Level 9',  min: 1751, max: 2000, color: '#EF4444', bg: 'rgba(239,68,68,0.18)'   },
  { level: 10, label: 'Level 10', min: 2001, max: Infinity, color: '#B91C1C', bg: 'rgba(185,28,28,0.18)' },
]

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
