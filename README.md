# LOL Recently Active Player Finder

Find recently active League of Legends players by scraping u.gg. Filter by rank, game type, and how recently they played.

## Features

- Discover players from a seed player's match history
- Filter by rank (Iron to Challenger)
- Filter by game type (Ranked, Normal, ARAM)
- Filter by recency (find players who played within the last hour, day, etc.)
- Set maximum search time to limit how long it runs
- Web UI for easy access
- CLI for command-line usage
- View and load previously saved results

## Quick Start

### Option 1: Web UI (Recommended)

```bash
# Clone the repository
git clone https://github.com/ezflow997/lol-recently-active-finder.git
cd lol-recently-active-finder

# Install dependencies
npm install

# Start the UI
npm run ui
```

Then open **http://localhost:3000** in your browser.

On Windows, you can also just double-click `Start UI.bat`.

### Option 2: Command Line

```bash
# Basic search
node index.js --seed "PlayerName#TAG"

# Find silver/gold players who played in the last 2 hours
node index.js --seed "PlayerName#TAG" --min-rank silver --max-rank gold --max-age 2h

# Limit search time to 5 minutes, find 10 players
node index.js --seed "PlayerName#TAG" --max-time 5m --max-results 10
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--seed <RiotID>` | Starting player (required) | - |
| `--region <region>` | Server region (na, euw, kr, etc.) | na |
| `--game-type <type>` | ranked, normal, aram, all | all |
| `--min-rank <rank>` | Minimum rank tier | any |
| `--max-rank <rank>` | Maximum rank tier | any |
| `--max-age <time>` | Max time since last game (e.g., 1h, 30m, 2d) | none |
| `--max-time <time>` | Max search duration (e.g., 5m, 10m) | unlimited |
| `--max-results <n>` | Stop after finding N players | 100 |
| `--output <file>` | Output JSON file | discovered_players.json |

## Rank Tiers

iron, bronze, silver, gold, platinum, emerald, diamond, master, grandmaster, challenger

## Examples

```bash
# Find Diamond+ players
node index.js --seed "Faker#KR1" --min-rank diamond

# Find players who just finished a game (within 30 min)
node index.js --seed "PlayerName#TAG" --max-age 30m

# Quick 2-minute search for ranked players
node index.js --seed "PlayerName#TAG" --game-type ranked --max-time 2m --max-results 20
```

## GitHub Codespaces

Run directly in your browser without installing anything:

1. Click the green **Code** button on the repo
2. Select **Codespaces** → **Create codespace on master**
3. Wait for it to set up automatically (installs dependencies)
4. Run in the terminal:
   ```bash
   npm run ui
   ```
5. Click the popup link or go to the **Ports** tab to open the UI

**If you get a Chrome/Puppeteer error**, run this first:
```bash
bash setup-codespace.sh
```

## How It Works

1. Takes a seed player's Riot ID
2. Scrapes their profile on u.gg to find players from recent matches
3. Fetches each player's profile to get their rank and last game time
4. Filters based on your criteria
5. Saves results to a JSON file

## Requirements

- Node.js 18+
- npm

## License

ISC
