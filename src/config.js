const RANK_ORDER = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master',
  'grandmaster',
  'challenger'
];

const DIVISION_ORDER = ['iv', 'iii', 'ii', 'i'];

const GAME_TYPES = {
  ranked: ['Ranked Solo', 'Ranked Flex'],
  normal: ['Normal', 'Draft Pick', 'Blind Pick', 'Quickplay'],
  aram: ['ARAM'],
  all: null // No filter
};

function getRankValue(tier, division = 'i') {
  if (!tier) return -1;

  const tierIndex = RANK_ORDER.indexOf(tier.toLowerCase());
  if (tierIndex === -1) return -1;

  // Master+ has no divisions
  if (tierIndex >= 7) {
    return tierIndex * 4 + 3;
  }

  const divIndex = division ? DIVISION_ORDER.indexOf(division.toLowerCase()) : 0;
  return tierIndex * 4 + (divIndex >= 0 ? divIndex : 0);
}

function isRankInRange(rank, minRank, maxRank) {
  if (!rank || !rank.tier) return false;

  const value = getRankValue(rank.tier, rank.division);

  if (minRank) {
    const minValue = getRankValue(minRank);
    if (value < minValue) return false;
  }

  if (maxRank) {
    const maxValue = getRankValue(maxRank, 'i');
    if (value > maxValue) return false;
  }

  return true;
}

function parseMaxAge(ageString) {
  if (!ageString) return null;

  const match = ageString.match(/^(\d+)\s*(s|m|h|d|w|second|minute|hour|day|week)s?$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
    case 'second': return value * 1000;
    case 'm':
    case 'minute': return value * 60 * 1000;
    case 'h':
    case 'hour': return value * 60 * 60 * 1000;
    case 'd':
    case 'day': return value * 24 * 60 * 60 * 1000;
    case 'w':
    case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  RANK_ORDER,
  DIVISION_ORDER,
  GAME_TYPES,
  getRankValue,
  isRankInRange,
  parseMaxAge
};
