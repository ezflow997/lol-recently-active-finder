const { Command } = require('commander');
const { PlayerDiscovery } = require('./src/discovery');
const { RANK_ORDER, parseMaxAge } = require('./src/config');

const program = new Command();

program
  .name('lol-player-finder')
  .description('Find recently active League of Legends players')
  .version('1.0.0')
  .requiredOption('--seed <riotId>', 'Starting player Riot ID (format: Name#Tag)')
  .option('--region <region>', 'Server region', 'na')
  .option('--game-type <type>', 'Filter by game type: ranked, normal, aram, all', 'all')
  .option('--min-rank <rank>', `Minimum rank tier (${RANK_ORDER.join(', ')})`)
  .option('--max-rank <rank>', `Maximum rank tier (${RANK_ORDER.join(', ')})`)
  .option('--max-age <time>', 'Max time since last game (e.g., 1h, 30m, 2d, 1w)')
  .option('--max-results <number>', 'Maximum number of players to find', '100')
  .option('--max-time <time>', 'Maximum search duration (e.g., 5m, 10m, 1h)')
  .option('--delay <ms>', 'Delay between requests in milliseconds', '1500')
  .option('--output <file>', 'Output JSON file path', 'discovered_players.json')
  .action(async (options) => {
    // Parse seed player
    const seedParts = options.seed.split('#');
    if (seedParts.length !== 2) {
      console.error('Error: Seed must be in format Name#Tag (e.g., Faker#T1)');
      process.exit(1);
    }
    const [seedName, seedTag] = seedParts;

    // Validate rank options
    if (options.minRank && !RANK_ORDER.includes(options.minRank.toLowerCase())) {
      console.error(`Error: Invalid min-rank. Must be one of: ${RANK_ORDER.join(', ')}`);
      process.exit(1);
    }
    if (options.maxRank && !RANK_ORDER.includes(options.maxRank.toLowerCase())) {
      console.error(`Error: Invalid max-rank. Must be one of: ${RANK_ORDER.join(', ')}`);
      process.exit(1);
    }

    // Validate game type
    const validGameTypes = ['ranked', 'normal', 'aram', 'all'];
    if (!validGameTypes.includes(options.gameType.toLowerCase())) {
      console.error(`Error: Invalid game-type. Must be one of: ${validGameTypes.join(', ')}`);
      process.exit(1);
    }

    // Validate and parse max-age
    let maxAgeMs = null;
    if (options.maxAge) {
      maxAgeMs = parseMaxAge(options.maxAge);
      if (!maxAgeMs) {
        console.error('Error: Invalid max-age format. Use format like: 1h, 30m, 2d, 1w');
        process.exit(1);
      }
    }

    // Validate and parse max-time (search duration limit)
    let maxTimeMs = null;
    if (options.maxTime) {
      maxTimeMs = parseMaxAge(options.maxTime);
      if (!maxTimeMs) {
        console.error('Error: Invalid max-time format. Use format like: 5m, 10m, 1h');
        process.exit(1);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('  League of Legends Recently Active Player Finder');
    console.log('═══════════════════════════════════════════════════════\n');

    const discovery = new PlayerDiscovery({
      region: options.region.toLowerCase(),
      gameType: options.gameType.toLowerCase(),
      minRank: options.minRank?.toLowerCase(),
      maxRank: options.maxRank?.toLowerCase(),
      maxAgeMs: maxAgeMs,
      maxTimeMs: maxTimeMs,
      maxResults: parseInt(options.maxResults, 10),
      delay: parseInt(options.delay, 10),
      output: options.output
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\nInterrupted! Saving progress...');
      discovery.stop();
      process.exit(0);
    });

    try {
      await discovery.discoverFromSeed(seedName, seedTag);
    } catch (error) {
      console.error('Fatal error:', error.message);
      discovery.stop();
      process.exit(1);
    }
  });

program.parse();
