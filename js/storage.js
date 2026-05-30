class DataLayer {
  load() {
    try {
      const stored = window.localStorage.getItem(GameConfig.SAVE_KEY);
      if (!stored) {
        return { ...DEFAULT_SAVE_DATA };
      }

      const parsed = JSON.parse(stored);
      return {
        best_score: Number.parseInt(parsed.best_score ?? DEFAULT_SAVE_DATA.best_score, 10) || 0,
        highest_level_unlocked: Number.parseInt(parsed.highest_level_unlocked ?? DEFAULT_SAVE_DATA.highest_level_unlocked, 10) || 1,
      };
    } catch (error) {
      return { ...DEFAULT_SAVE_DATA };
    }
  }

  save(bestScore, highestLevelUnlocked = DEFAULT_SAVE_DATA.highest_level_unlocked) {
    window.localStorage.setItem(
      GameConfig.SAVE_KEY,
      JSON.stringify({
        best_score: Number(bestScore) || 0,
        highest_level_unlocked: Math.max(1, Number(highestLevelUnlocked) || 1),
      }),
    );
  }
}

class AnalyticsService {
  constructor() {
    this.data = {
      games_played: 0,
      obstacles_dodged: 0,
      sequences_survived: 0,
      last_score: 0,
      items_collected: 0,
      sequences_completed: 0,
      clouds_caught: 0,
    };
    this.load();
  }

  load() {
    try {
      const stored = window.localStorage.getItem(GameConfig.ANALYTICS_KEY);
      if (!stored) {
        this.data = { ...DEFAULT_ANALYTICS_DATA };
        return;
      }

      const parsed = JSON.parse(stored);
      this.data = { ...this.data, ...parsed };
    } catch (error) {
      this.data = { ...DEFAULT_ANALYTICS_DATA };
    }
  }

  save() {
    window.localStorage.setItem(GameConfig.ANALYTICS_KEY, JSON.stringify(this.data));
  }

  newGame() {
    this.data.games_played += 1;
    this.save();
  }

  dodgedObstacle() {
    this.data.obstacles_dodged += 1;
    this.save();
  }

  survivedSequence() {
    this.data.sequences_survived += 1;
    this.save();
  }
}

class AchievementService {
  constructor() {
    this.unlocked = new Set();
  }

  check(obstaclesDodged, avatarLabel = "Frog") {
    const achievements = new Map([
      [1, "First Dodge"],
      [3, `${avatarLabel} Hopper`],
      [7, `${avatarLabel} Dancer`],
      [15, `${avatarLabel} Master`],
    ]);

    const newlyUnlocked = [];
    for (const [threshold, name] of achievements.entries()) {
      if (obstaclesDodged >= threshold && !this.unlocked.has(name)) {
        this.unlocked.add(name);
        newlyUnlocked.push(name);
      }
    }

    return newlyUnlocked;
  }
}
