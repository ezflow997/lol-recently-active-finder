const express = require('express');
const path = require('path');
const { PlayerDiscovery } = require('./src/discovery');
const { RANK_ORDER, parseMaxAge } = require('./src/config');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Current search state
let currentSearch = null;
let searchResults = [];
let searchLog = [];
let isSearching = false;

// Override console.log to capture output
const originalLog = console.log;
const originalError = console.error;

function captureLog(...args) {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  searchLog.push({ type: 'log', message, time: new Date().toISOString() });
  originalLog.apply(console, args);
}

function captureError(...args) {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  searchLog.push({ type: 'error', message, time: new Date().toISOString() });
  originalError.apply(console, args);
}

// API endpoints
app.get('/api/config', (req, res) => {
  res.json({
    ranks: RANK_ORDER,
    gameTypes: ['all', 'ranked', 'normal', 'aram'],
    regions: ['na', 'euw', 'eune', 'kr', 'br', 'lan', 'las', 'oce', 'tr', 'ru', 'jp']
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    isSearching,
    resultsCount: searchResults.length,
    logCount: searchLog.length
  });
});

app.get('/api/results', (req, res) => {
  res.json(searchResults);
});

app.get('/api/logs', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  res.json(searchLog.slice(since));
});

app.post('/api/search', async (req, res) => {
  if (isSearching) {
    return res.status(400).json({ error: 'Search already in progress' });
  }

  const { seed, region, gameType, minRank, maxRank, maxAge, maxTime, maxResults } = req.body;

  // Validate seed
  if (!seed || !seed.includes('#')) {
    return res.status(400).json({ error: 'Seed must be in format Name#Tag' });
  }

  const [seedName, seedTag] = seed.split('#');

  // Parse max-age
  let maxAgeMs = null;
  if (maxAge) {
    maxAgeMs = parseMaxAge(maxAge);
    if (!maxAgeMs) {
      return res.status(400).json({ error: 'Invalid max-age format' });
    }
  }

  // Parse max-time
  let maxTimeMs = null;
  if (maxTime) {
    maxTimeMs = parseMaxAge(maxTime);
    if (!maxTimeMs) {
      return res.status(400).json({ error: 'Invalid max-time format' });
    }
  }

  // Clear previous results
  searchResults = [];
  searchLog = [];
  isSearching = true;

  // Redirect console output
  console.log = captureLog;
  console.error = captureError;

  res.json({ message: 'Search started', seed });

  // Run search in background
  try {
    const discovery = new PlayerDiscovery({
      region: region || 'na',
      gameType: gameType || 'all',
      minRank: minRank || null,
      maxRank: maxRank || null,
      maxAgeMs,
      maxTimeMs,
      maxResults: parseInt(maxResults) || 20,
      delay: 1500,
      output: `search_results_${Date.now()}.json`
    });

    currentSearch = discovery;

    const results = await discovery.discoverFromSeed(seedName, seedTag);
    searchResults = results || [];
  } catch (error) {
    searchLog.push({ type: 'error', message: `Fatal error: ${error.message}`, time: new Date().toISOString() });
  } finally {
    isSearching = false;
    currentSearch = null;
    console.log = originalLog;
    console.error = originalError;
  }
});

app.post('/api/stop', async (req, res) => {
  if (currentSearch) {
    try {
      await currentSearch.stop();
      searchLog.push({ type: 'log', message: 'Search stopped by user', time: new Date().toISOString() });
    } catch (e) {
      // Ignore errors on stop
    }
  }
  isSearching = false;
  res.json({ message: 'Search stopped' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  LOL Player Finder UI`);
  console.log(`========================================`);
  console.log(`\n  Open in browser: http://localhost:${PORT}`);
  console.log(`\n  Press Ctrl+C to stop the server\n`);
});
