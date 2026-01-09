const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://u.gg';
const DELAY_MS = 500;
const MAX_CONCURRENT = 3; // Reduce to avoid detection

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--window-size=1920,1080',
        '--single-process',
        '--no-zygote'
      ]
    });
  }
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

function formatSummonerUrl(region, name, tag) {
  // u.gg format: https://u.gg/lol/profile/na1/name-tag/overview
  const regionCode = region === 'na' ? 'na1' : region;
  const encodedName = encodeURIComponent(name.toLowerCase());
  const encodedTag = encodeURIComponent(tag.toLowerCase());
  return `${BASE_URL}/lol/profile/${regionCode}/${encodedName}-${encodedTag}/overview`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const status = response.status();

    if (status === 404 || status === 403) {
      await page.close();
      return null;
    }

    // Wait for dynamic content to fully load
    await sleep(4000);

    // Scroll to load match history
    await page.evaluate(() => window.scrollTo(0, 1500));
    await sleep(2000);

    const html = await page.content();
    await page.close();
    return html;
  } catch (error) {
    try { await page.close(); } catch (e) {}
    console.error(`  Fetch error: ${error.message}`);
    return null;
  }
}

function parseLastGameTime($) {
  const bodyText = $('body').text();

  // Look for patterns like "X minutes ago", "X hours ago", "X days ago"
  const timeMatch = bodyText.match(/(\d+)\s*(second|minute|hour|day|week|month)s?\s*ago/i);

  if (timeMatch) {
    const value = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2].toLowerCase();

    const now = Date.now();
    let msAgo = 0;

    switch (unit) {
      case 'second': msAgo = value * 1000; break;
      case 'minute': msAgo = value * 60 * 1000; break;
      case 'hour': msAgo = value * 60 * 60 * 1000; break;
      case 'day': msAgo = value * 24 * 60 * 60 * 1000; break;
      case 'week': msAgo = value * 7 * 24 * 60 * 60 * 1000; break;
      case 'month': msAgo = value * 30 * 24 * 60 * 60 * 1000; break;
    }

    return {
      timestamp: new Date(now - msAgo).toISOString(),
      relativeTime: `${value} ${unit}${value > 1 ? 's' : ''} ago`,
      msAgo
    };
  }

  // Try to match short format like "5m ago", "2h ago", "3d ago"
  const shortMatch = bodyText.match(/(\d+)\s*(s|m|h|d|w)\s*ago/i);
  if (shortMatch) {
    const value = parseInt(shortMatch[1], 10);
    const unit = shortMatch[2].toLowerCase();

    const now = Date.now();
    let msAgo = 0;

    switch (unit) {
      case 's': msAgo = value * 1000; break;
      case 'm': msAgo = value * 60 * 1000; break;
      case 'h': msAgo = value * 60 * 60 * 1000; break;
      case 'd': msAgo = value * 24 * 60 * 60 * 1000; break;
      case 'w': msAgo = value * 7 * 24 * 60 * 60 * 1000; break;
    }

    const units = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week' };
    return {
      timestamp: new Date(now - msAgo).toISOString(),
      relativeTime: `${value} ${units[unit]}${value > 1 ? 's' : ''} ago`,
      msAgo
    };
  }

  return null;
}

function parseRankFromHtml($) {
  const rankInfo = {
    tier: null,
    division: null,
    lp: 0,
    season: 'current'
  };

  const bodyText = $('body').text();

  // Look for current season "Ranked Solo" section
  const rankedSoloSection = bodyText.match(/Ranked Solo[\s\S]{0,100}?(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\s*(IV|III|II|I)?[\s\S]{0,50}?(\d+)\s*LP/i);

  if (rankedSoloSection) {
    rankInfo.tier = rankedSoloSection[1].toLowerCase();
    if (rankedSoloSection[2]) {
      rankInfo.division = rankedSoloSection[2].toLowerCase();
    }
    rankInfo.lp = parseInt(rankedSoloSection[3], 10);
    return rankInfo;
  }

  // Fallback: Look for any rank pattern near LP
  const rankPattern = bodyText.match(/\b(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\s*(IV|III|II|I)?\s*(\d+)\s*LP/i);

  if (rankPattern) {
    rankInfo.tier = rankPattern[1].toLowerCase();
    if (rankPattern[2]) {
      rankInfo.division = rankPattern[2].toLowerCase();
    }
    rankInfo.lp = parseInt(rankPattern[3], 10);
    return rankInfo;
  }

  // Check for past season rank (e.g., "S14 Gold", "S14-2 Silver")
  const pastSeasonMatch = bodyText.match(/S\d+(?:-\d)?\s*(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)/i);

  if (pastSeasonMatch) {
    rankInfo.tier = pastSeasonMatch[1].toLowerCase();
    rankInfo.season = 'past';
    rankInfo.lp = 0;
    return rankInfo;
  }

  return null;
}

function parsePlayersFromHtml($, seedName, seedTag) {
  const players = new Map();
  const seedKey = `${seedName.toLowerCase()}#${seedTag.toLowerCase()}`;

  // Find all profile links
  $('a[href*="/lol/profile/"]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/lol\/profile\/([^/]+)\/([^/]+)\/overview/);

    if (match) {
      const [, region, nameTag] = match;
      const decoded = decodeURIComponent(nameTag);
      const parts = decoded.split('-');

      if (parts.length >= 2) {
        const tag = parts.pop();
        const name = parts.join('-');
        const key = `${name.toLowerCase()}#${tag.toLowerCase()}`;

        // Skip self-links and navigation links
        if (key !== seedKey && !players.has(key)) {
          players.set(key, {
            name,
            tag,
            region: region === 'na1' ? 'na' : region,
            gameType: null,
            timestamp: null
          });
        }
      }
    }
  });

  return Array.from(players.values());
}

async function getPlayerProfile(region, name, tag, delay = DELAY_MS) {
  const url = formatSummonerUrl(region, name, tag);
  console.log(`Fetching: ${url}`);

  const html = await fetchPage(url);

  if (!html) {
    return null;
  }

  const $ = cheerio.load(html);

  const lastGameTime = parseLastGameTime($);

  const profile = {
    summonerName: name,
    tag: tag,
    riotId: `${name}#${tag}`,
    region: region,
    rank: parseRankFromHtml($),
    lastGameTime: lastGameTime,
    profileUrl: url
  };

  if (delay > 0) {
    await sleep(delay);
  }

  return profile;
}

async function getPlayersFromMatches(region, name, tag, delay = DELAY_MS) {
  const url = formatSummonerUrl(region, name, tag);
  console.log(`Fetching players from: ${url}`);

  const html = await fetchPage(url);

  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);
  const players = parsePlayersFromHtml($, name, tag);

  console.log(`  Found ${players.length} unique players`);

  if (delay > 0) {
    await sleep(delay);
  }

  return players;
}

// Batch fetch multiple profiles in parallel
async function getPlayerProfilesBatch(region, players, onResult) {
  const results = [];

  // Process in chunks of MAX_CONCURRENT
  for (let i = 0; i < players.length; i += MAX_CONCURRENT) {
    const chunk = players.slice(i, i + MAX_CONCURRENT);
    console.log(`  Batch fetching ${chunk.length} profiles (${i + 1}-${Math.min(i + MAX_CONCURRENT, players.length)} of ${players.length})...`);

    const promises = chunk.map(async (player) => {
      try {
        const profile = await getPlayerProfile(region, player.name, player.tag, 0);
        if (profile) {
          const fullPlayer = {
            ...profile,
            lastGameType: player.gameType,
            lastGameTime: player.lastGameTime,
            discoveredFrom: player.discoveredFrom
          };
          if (onResult) onResult(fullPlayer);
          return fullPlayer;
        }
      } catch (err) {
        console.log(`    Error fetching ${player.name}#${player.tag}: ${err.message}`);
      }
      return null;
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.filter(r => r !== null));

    // Small delay between batches
    if (i + MAX_CONCURRENT < players.length) {
      await sleep(500);
    }
  }

  return results;
}

module.exports = {
  getPlayerProfile,
  getPlayerProfilesBatch,
  getPlayersFromMatches,
  formatSummonerUrl,
  closeBrowser,
  sleep,
  MAX_CONCURRENT
};
