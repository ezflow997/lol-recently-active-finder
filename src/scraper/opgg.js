const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.op.gg';
const DELAY_MS = 2000;

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080'
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
  const encodedName = encodeURIComponent(name);
  const encodedTag = encodeURIComponent(tag);
  return `${BASE_URL}/lol/summoners/${region}/${encodedName}-${encodedTag}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Better stealth settings
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1'
    });

    // Mask webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    await page.setViewport({ width: 1920, height: 1080 });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const status = response.status();
    console.log(`  Response status: ${status}`);

    if (status === 403 || status === 404) {
      await page.close();
      return null;
    }

    // Wait for dynamic content
    await sleep(3000);

    // Scroll to load more
    await page.evaluate(() => window.scrollTo(0, 1000));
    await sleep(1000);

    const html = await page.content();
    await page.close();
    return html;
  } catch (error) {
    try { await page.close(); } catch (e) {}
    console.error(`  Fetch error: ${error.message}`);
    return null;
  }
}

function parseRankFromHtml($) {
  const rankInfo = {
    tier: null,
    division: null,
    lp: 0
  };

  const bodyText = $('body').text();

  // Match patterns like "Diamond II", "Master", "Challenger"
  const tierMatch = bodyText.match(/\b(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\s*(IV|III|II|I)?\b/i);

  if (tierMatch) {
    rankInfo.tier = tierMatch[1].toLowerCase();
    if (tierMatch[2]) {
      rankInfo.division = tierMatch[2].toLowerCase();
    }
  }

  const lpMatch = bodyText.match(/(\d+)\s*LP/i);
  if (lpMatch) {
    rankInfo.lp = parseInt(lpMatch[1], 10);
  }

  return rankInfo.tier ? rankInfo : null;
}

function parseMatchesFromHtml($) {
  const players = new Set();
  const results = [];

  // Find all summoner links in the page
  $('a[href*="/lol/summoners/"]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const playerMatch = href.match(/\/lol\/summoners\/([^/]+)\/([^/?]+)/);
    if (playerMatch) {
      const [, region, nameTag] = playerMatch;
      const decoded = decodeURIComponent(nameTag);
      const parts = decoded.split('-');
      if (parts.length >= 2) {
        const tag = parts.pop();
        const name = parts.join('-');
        const key = `${name.toLowerCase()}#${tag.toLowerCase()}`;
        if (!players.has(key)) {
          players.add(key);
          results.push({
            name,
            tag,
            region,
            gameType: null,
            timestamp: null
          });
        }
      }
    }
  });

  return results;
}

async function getPlayerProfile(region, name, tag, delay = DELAY_MS) {
  const url = formatSummonerUrl(region, name, tag);
  console.log(`Fetching: ${url}`);

  const html = await fetchPage(url);

  if (!html) {
    return null;
  }

  const $ = cheerio.load(html);

  const profile = {
    summonerName: name,
    tag: tag,
    riotId: `${name}#${tag}`,
    region: region,
    rank: parseRankFromHtml($),
    profileUrl: url
  };

  if (delay > 0) {
    await sleep(delay);
  }

  return profile;
}

async function getMatchHistory(region, name, tag, delay = DELAY_MS) {
  const url = formatSummonerUrl(region, name, tag);
  console.log(`Fetching match history: ${url}`);

  const html = await fetchPage(url);

  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);
  const matches = parseMatchesFromHtml($);

  if (delay > 0) {
    await sleep(delay);
  }

  return matches;
}

async function getPlayersFromMatches(region, name, tag, delay = DELAY_MS) {
  const matches = await getMatchHistory(region, name, tag, delay);

  return matches.filter(player =>
    !(player.name.toLowerCase() === name.toLowerCase() && player.tag.toLowerCase() === tag.toLowerCase())
  );
}

module.exports = {
  getPlayerProfile,
  getMatchHistory,
  getPlayersFromMatches,
  formatSummonerUrl,
  closeBrowser,
  sleep
};
