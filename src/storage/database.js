const fs = require('fs');
const path = require('path');

class PlayerDatabase {
  constructor(outputPath = 'discovered_players.json') {
    this.outputPath = path.resolve(outputPath);
    this.players = new Map();
    this.seen = new Set();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.outputPath)) {
        const data = JSON.parse(fs.readFileSync(this.outputPath, 'utf8'));
        if (Array.isArray(data)) {
          for (const player of data) {
            const key = `${player.summonerName}#${player.tag}`;
            this.players.set(key, player);
            this.seen.add(key);
          }
        }
        console.log(`Loaded ${this.players.size} existing players from ${this.outputPath}`);
      }
    } catch (error) {
      console.error('Error loading existing data:', error.message);
    }
  }

  save() {
    try {
      const data = Array.from(this.players.values());
      fs.writeFileSync(this.outputPath, JSON.stringify(data, null, 2));
      console.log(`Saved ${data.length} players to ${this.outputPath}`);
    } catch (error) {
      console.error('Error saving data:', error.message);
    }
  }

  addPlayer(player) {
    const key = `${player.summonerName}#${player.tag}`;
    if (!this.players.has(key)) {
      this.players.set(key, {
        ...player,
        discoveredAt: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  hasPlayer(name, tag) {
    const key = `${name}#${tag}`;
    return this.players.has(key);
  }

  hasSeen(name, tag) {
    const key = `${name}#${tag}`;
    return this.seen.has(key);
  }

  markSeen(name, tag) {
    const key = `${name}#${tag}`;
    this.seen.add(key);
  }

  getPlayer(name, tag) {
    const key = `${name}#${tag}`;
    return this.players.get(key);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  getCount() {
    return this.players.size;
  }

  clear() {
    this.players.clear();
    this.seen.clear();
  }
}

module.exports = { PlayerDatabase };
