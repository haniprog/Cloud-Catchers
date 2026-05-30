const GameConfig = {
  WIDTH: 800,
  HEIGHT: 600,
  GROUND_Y: 520,
  PLAYER_W: 30,
  PLAYER_H: 20,
  SAVE_KEY: "cloud-catchers-savegame",
  ANALYTICS_KEY: "cloud-catchers-analytics",
  NUM_CLOUD_ROWS: 7,
  NUM_CLOUD_COLUMNS: 4,
  CLOUD_ROW_GAP: 68,
  CLOUD_JUMP_RANGE: 185,
  IDS_MAX_DEPTH: 8,
  OBSTACLE_GROUPS_MIN: 2,
  OBSTACLE_GROUPS_MAX: 5,
  MAX_FALL_TIME: 10.0,
};

const DEFAULT_SAVE_DATA = {
  best_score: 7022,
  highest_level_unlocked: 1,
};

const DEFAULT_ANALYTICS_DATA = {
  games_played: 196,
  obstacles_dodged: 10251,
  sequences_survived: 178,
  last_score: 25,
  items_collected: 1,
  sequences_completed: 0,
  clouds_caught: 61,
};
