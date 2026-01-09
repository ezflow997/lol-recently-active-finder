const { isRankInRange, GAME_TYPES } = require('../config');

function matchesGameType(gameType, filter) {
  if (!filter || filter === 'all') {
    return true;
  }

  const allowedTypes = GAME_TYPES[filter.toLowerCase()];
  if (!allowedTypes) {
    return true;
  }

  if (!gameType) {
    return false;
  }

  const normalizedGameType = gameType.toLowerCase();
  return allowedTypes.some(type => normalizedGameType.includes(type.toLowerCase()));
}

function matchesRank(rank, minRank, maxRank) {
  if (!minRank && !maxRank) {
    return true;
  }

  if (!rank || !rank.tier) {
    return false; // Unranked players don't match rank filters
  }

  return isRankInRange(rank, minRank, maxRank);
}

function matchesMaxAge(lastGameTime, maxAgeMs) {
  if (!maxAgeMs) return true;

  // If we couldn't parse the time, include the player (don't filter out unknowns)
  if (!lastGameTime || !lastGameTime.msAgo) return true;

  return lastGameTime.msAgo <= maxAgeMs;
}

function filterPlayer(player, options = {}) {
  const { gameType, minRank, maxRank, maxAgeMs } = options;

  // Check game type filter
  if (!matchesGameType(player.lastGameType || player.gameType, gameType)) {
    return false;
  }

  // Check rank filter
  if (!matchesRank(player.rank, minRank, maxRank)) {
    return false;
  }

  // Check max age filter
  if (!matchesMaxAge(player.lastGameTime, maxAgeMs)) {
    return false;
  }

  return true;
}

function filterPlayers(players, options = {}) {
  return players.filter(player => filterPlayer(player, options));
}

module.exports = {
  matchesGameType,
  matchesRank,
  filterPlayer,
  filterPlayers
};
