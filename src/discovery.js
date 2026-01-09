const { getPlayerProfile, getPlayerProfilesBatch, getPlayersFromMatches, sleep, closeBrowser } = require('./scraper/ugg');
const { filterPlayer } = require('./filters');
const { PlayerDatabase } = require('./storage/database');

class PlayerDiscovery {
  constructor(options = {}) {
    this.region = options.region || 'na';
    this.maxResults = options.maxResults || 100;
    this.delay = options.delay || 500;
    this.gameType = options.gameType || 'all';
    this.minRank = options.minRank || null;
    this.maxRank = options.maxRank || null;
    this.maxAgeMs = options.maxAgeMs || null;
    this.maxTimeMs = options.maxTimeMs || null;
    this.outputPath = options.output || 'discovered_players.json';

    this.database = new PlayerDatabase(this.outputPath);
    this.queue = [];
    this.processing = false;
    this.startTime = null;
    this.timedOut = false;
  }

  async discoverFromSeed(seedName, seedTag) {
    console.log(`\nStarting discovery from seed: ${seedName}#${seedTag}`);
    console.log(`Region: ${this.region.toUpperCase()}`);
    console.log(`Game type filter: ${this.gameType}`);
    console.log(`Rank filter: ${this.minRank || 'any'} - ${this.maxRank || 'any'}`);
    console.log(`Max age filter: ${this.maxAgeMs ? this.formatMaxAge(this.maxAgeMs) : 'none'}`);
    console.log(`Max search time: ${this.maxTimeMs ? this.formatMaxAge(this.maxTimeMs) : 'unlimited'}`);
    console.log(`Max results: ${this.maxResults}`);
    console.log(`Mode: Parallel (5 concurrent requests)\n`);

    this.database.markSeen(seedName, seedTag);
    this.processing = true;
    this.startTime = Date.now();
    this.timedOut = false;

    try {
      await this.processPlayerFast(seedName, seedTag);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }

    this.processing = false;
    this.database.save();
    await closeBrowser();

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\nDiscovery complete!${this.timedOut ? ' (stopped due to time limit)' : ''}`);
    console.log(`Found ${this.database.getCount()} players matching filters`);
    console.log(`Total time: ${totalTime}s`);
    console.log(`Results saved to: ${this.outputPath}`);

    return this.database.getAllPlayers();
  }

  async processPlayerFast(seedName, seedTag) {
    console.log(`[Seed] Fetching match history for ${seedName}#${seedTag}...`);

    // Get players from seed's matches
    const playersFromMatches = await getPlayersFromMatches(this.region, seedName, seedTag, this.delay);

    if (playersFromMatches.length === 0) {
      console.log(`  No players found in match history`);
      return;
    }

    // Filter out already seen players
    const newPlayers = playersFromMatches.filter(p => !this.database.hasSeen(p.name, p.tag));

    // Mark all as seen
    newPlayers.forEach(p => this.database.markSeen(p.name, p.tag));

    // Add discoveredFrom info
    const playersToFetch = newPlayers.slice(0, this.maxResults * 2).map(p => ({
      ...p,
      discoveredFrom: `${seedName}#${seedTag}`
    }));

    console.log(`\n[Batch] Fetching ${playersToFetch.length} player profiles in parallel...`);
    const startTime = Date.now();

    const filterOptions = {
      gameType: this.gameType,
      minRank: this.minRank,
      maxRank: this.maxRank,
      maxAgeMs: this.maxAgeMs
    };

    // Batch fetch with callback for real-time results
    await getPlayerProfilesBatch(this.region, playersToFetch, (player) => {
      // Check if time limit exceeded
      if (this.isTimeExceeded()) {
        if (!this.timedOut) {
          this.timedOut = true;
          console.log(`\n[Timeout] Search time limit reached (${this.formatMaxAge(this.maxTimeMs)})`);
        }
        return;
      }

      if (this.database.getCount() >= this.maxResults) return;

      if (filterPlayer(player, filterOptions)) {
        const added = this.database.addPlayer(player);
        if (added) {
          const rankStr = player.rank
            ? `${player.rank.tier} ${player.rank.division || ''} ${player.rank.lp}LP`.trim()
            : 'Unranked';
          const timeStr = player.lastGameTime?.relativeTime || 'unknown';
          console.log(`    ✓ [${this.database.getCount()}/${this.maxResults}] ${player.summonerName}#${player.tag} (${rankStr}) - ${timeStr}`);
        }
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[Done] Processed ${playersToFetch.length} profiles in ${elapsed}s`);
  }

  async stop() {
    this.processing = false;
    this.database.save();
    await closeBrowser();
  }

  getResults() {
    return this.database.getAllPlayers();
  }

  formatMaxAge(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    if (ms < 604800000) return `${Math.round(ms / 86400000)}d`;
    return `${Math.round(ms / 604800000)}w`;
  }

  isTimeExceeded() {
    if (!this.maxTimeMs || !this.startTime) return false;
    return (Date.now() - this.startTime) >= this.maxTimeMs;
  }
}

module.exports = { PlayerDiscovery };
