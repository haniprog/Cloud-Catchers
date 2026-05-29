"""
Cloud Catchers Game - AI-Driven Platformer
Uses Iterative Deepening Search (IDS) to generate item sequences
Uses Breadth-First Search (BFS) to validate sequence solvability
"""
import json
import os
import random
import tkinter as tk
from collections import deque


# ============================================================================
# GAME CONFIGURATION - All adjustable game parameters
# ============================================================================
# ============================================================================
# GAME CONFIGURATION - All adjustable game parameters
# ============================================================================
class GameConfig:
    # Canvas dimensions
    WIDTH = 800
    HEIGHT = 600
    GROUND_Y = 520
    
    # Player sprite dimensions and properties
    PLAYER_W = 40
    PLAYER_H = 50
    
    # Item (star/raindrop) sprite dimensions
    ITEM_W = 20
    ITEM_H = 20
    
    # Persistence files for save data and analytics
    SAVE_FILE = "savegame.json"
    ANALYTICS_FILE = "analytics.json"
    
    # Cloud generation - number of clouds and spacing
    NUM_CLOUDS = 6
    CLOUD_SPACING = 120  # Pixels between clouds horizontally
    CLOUD_START_X = 100
    
    # IDS parameters for sequence generation
    IDS_MAX_DEPTH = 8  # Maximum items in a sequence
    
    # Game difficulty settings
    ITEM_GROUPS_MIN = 2  # Minimum items per sequence
    ITEM_GROUPS_MAX = 5  # Maximum items per sequence
    MAX_FALL_TIME = 8.0  # Maximum seconds before item falls off screen


# ============================================================================
# CLOUD GRAPH - Models the game world as a graph of interconnected platforms
# ============================================================================
class CloudGraph:
    """
    Represents clouds as nodes in a graph where edges represent valid player jumps.
    This is the state-space environment used by BFS for solvability validation.
    """
    def __init__(self):
        # nodes[i] = (x_pos, y_pos) of cloud i
        self.nodes = []
        # edges[i] = list of reachable cloud indices from cloud i
        self.edges = []
        # Generate cloud layout
        self._generate_clouds()
        # Build adjacency based on jumping distance
        self._build_edges()
    
    def _generate_clouds(self):
        """
        Create evenly-spaced clouds from left to right across the screen.
        Each cloud is a potential landing platform for the player.
        """
        for i in range(GameConfig.NUM_CLOUDS):
            x = GameConfig.CLOUD_START_X + i * GameConfig.CLOUD_SPACING
            y = GameConfig.GROUND_Y - 80  # Clouds elevated above ground
            self.nodes.append((x, y))
    
    def _build_edges(self):
        """
        Connect clouds based on jump distance.
        Player can jump to adjacent clouds within jumping range.
        """
        self.edges = [[] for _ in range(len(self.nodes))]
        
        # For each cloud, find which clouds are reachable from it
        for i in range(len(self.nodes)):
            for j in range(len(self.nodes)):
                if i != j:
                    x1, y1 = self.nodes[i]
                    x2, y2 = self.nodes[j]
                    # Distance between clouds
                    distance = abs(x2 - x1)
                    # Player can jump up to 150 pixels horizontally
                    if distance <= 150:
                        self.edges[i].append(j)
    
    def get_node_position(self, node_id):
        """Returns (x, y) position of a cloud node."""
        return self.nodes[node_id]
    
    def get_reachable_nodes(self, node_id):
        """Returns list of cloud indices reachable from given cloud."""
        return self.edges[node_id]


# ============================================================================
# BREADTH-FIRST SEARCH (BFS) - Validates sequence solvability
# ============================================================================
class BFSSolver:
    """
    Uses BFS to check if a player can collect all items in a sequence.
    If BFS finds a valid path, the sequence is solvable and accepted.
    """
    
    def is_sequence_solvable(self, cloud_graph, item_positions, start_cloud):
        """
        Check if player starting at start_cloud can reach all item positions.
        
        Args:
            cloud_graph: CloudGraph object representing cloud network
            item_positions: List of (cloud_id, time) tuples for each item
            start_cloud: Starting cloud index
        
        Returns:
            True if all items are reachable, False otherwise
        """
        # Extract unique cloud IDs where items appear
        target_clouds = set(cloud_id for cloud_id, _ in item_positions)
        
        # BFS to find if we can reach all target clouds
        visited = set()
        queue = deque([start_cloud])
        visited.add(start_cloud)
        reached_targets = set()
        
        # Standard BFS traversal
        while queue:
            current_cloud = queue.popleft()
            
            # Mark any target item on this cloud as reachable
            if current_cloud in target_clouds:
                reached_targets.add(current_cloud)
            
            # Expand to neighboring clouds
            for neighbor in cloud_graph.get_reachable_nodes(current_cloud):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        # Sequence is solvable if we can reach all item clouds
        return len(reached_targets) == len(target_clouds)


# ============================================================================
# ITERATIVE DEEPENING SEARCH (IDS) - Generates item sequences
# ============================================================================
class IDSSequenceGenerator:
    """
    Uses IDS to systematically generate item sequences that are both
    challenging and solvable. Starts with simple sequences (few items)
    and incrementally increases complexity by depth.
    """
    
    def __init__(self, cloud_graph):
        self.cloud_graph = cloud_graph
        self.bfs_solver = BFSSolver()
        self.player_start_cloud = 0  # Player always starts at first cloud
    
    def generate_sequence(self, target_depth, max_attempts=20):
        """
        Generate a valid item sequence using IDS up to target_depth.
        
        Args:
            target_depth: Number of items in sequence to generate
            max_attempts: Maximum attempts before giving up
        
        Returns:
            List of (cloud_id, time) tuples representing item positions, or None
        """
        # Perform depth-limited search starting from depth 1
        for depth in range(1, target_depth + 1):
            for attempt in range(max_attempts):
                # Generate a random sequence at this depth
                sequence = self._generate_random_sequence(depth)
                
                # Validate using BFS
                if self.bfs_solver.is_sequence_solvable(
                    self.cloud_graph, sequence, self.player_start_cloud
                ):
                    return sequence
        
        # Fallback: return a simple guaranteed-solvable sequence
        return self._generate_simple_fallback_sequence()
    
    def _generate_random_sequence(self, depth):
        """
        Create a random sequence of 'depth' items across clouds.
        Each item is assigned a random cloud and spawn time.
        """
        sequence = []
        current_time = 1.0
        
        for _ in range(depth):
            # Random cloud and time for this item
            cloud_id = random.randint(0, len(self.cloud_graph.nodes) - 1)
            sequence.append((cloud_id, current_time))
            # Space items apart in time to give player time to move
            current_time += random.uniform(2.0, 4.0)
        
        return sequence
    
    def _generate_simple_fallback_sequence(self):
        """
        Generate a guaranteed-solvable sequence for reliability.
        """
        return [
            (0, 1.0),
            (1, 3.5),
            (2, 6.0),
        ]


# ============================================================================
# DATA PERSISTENCE - Handles save/load for high scores
# ============================================================================
class DataLayer:
    """Manages game state persistence to disk."""
    
    def load(self):
        """Load best score from save file."""
        if not os.path.exists(GameConfig.SAVE_FILE):
            return {"best_score": 0}
        try:
            with open(GameConfig.SAVE_FILE, "r", encoding="utf-8") as file:
                data = json.load(file)
                return {"best_score": int(data.get("best_score", 0))}
        except (OSError, ValueError, json.JSONDecodeError):
            return {"best_score": 0}
    
    def save(self, best_score):
        """Save best score to file."""
        data = {"best_score": int(best_score)}
        with open(GameConfig.SAVE_FILE, "w", encoding="utf-8") as file:
            json.dump(data, file)


# ============================================================================
# ANALYTICS SERVICE - Tracks gameplay statistics
# ============================================================================
class AnalyticsService:
    """Collects and persists gameplay analytics and telemetry."""
    
    def __init__(self):
        # Initialize tracking data
        self.data = {
            "games_played": 0,
            "items_collected": 0,
            "sequences_completed": 0,
            "last_score": 0
        }
        self.load()
    
    def load(self):
        """Load previous analytics data."""
        if os.path.exists(GameConfig.ANALYTICS_FILE):
            try:
                with open(GameConfig.ANALYTICS_FILE, "r", encoding="utf-8") as file:
                    loaded = json.load(file)
                    self.data.update(loaded)
            except (OSError, ValueError, json.JSONDecodeError):
                pass
    
    def save(self):
        """Persist analytics to disk."""
        with open(GameConfig.ANALYTICS_FILE, "w", encoding="utf-8") as file:
            json.dump(self.data, file)
    
    def new_game(self):
        """Record start of a new game."""
        self.data["games_played"] += 1
        self.save()
    
    def collected_item(self):
        """Record when player collects an item."""
        self.data["items_collected"] += 1
        self.save()
    
    def completed_sequence(self):
        """Record when player completes a sequence."""
        self.data["sequences_completed"] += 1
        self.save()


# ============================================================================
# ACHIEVEMENT SYSTEM - Unlocks milestones
# ============================================================================
class AchievementService:
    """Awards achievements when player reaches score milestones."""
    
    def __init__(self):
        # Set of unlocked achievement names
        self.unlocked = set()
    
    def check(self, items_collected):
        """
        Check for newly unlocked achievements at current score.
        
        Returns:
            List of newly unlocked achievement names
        """
        # Define achievement thresholds
        achievements = {
            1: "First Catch",
            5: "Cloud Rider",
            10: "Sky Guardian",
            20: "Master Collector",
        }
        
        newly_unlocked = []
        for threshold, name in achievements.items():
            # Check if score reached threshold and not already unlocked
            if items_collected >= threshold and name not in self.unlocked:
                self.unlocked.add(name)
                newly_unlocked.append(name)
        
        return newly_unlocked


# ============================================================================
# PLAYER - Represents the player character with physics
# ============================================================================
class Player:
    """
    Player object with physics simulation for movement and jumping.
    Player can move left/right and jump between clouds.
    """
    
    def __init__(self, canvas, cloud_graph):
        self.canvas = canvas
        self.cloud_graph = cloud_graph
        
        # Physics state: position and velocity
        self.x = cloud_graph.nodes[0][0]  # Start at first cloud
        self.y = cloud_graph.nodes[0][1]
        self.vx = 0  # Horizontal velocity
        self.vy = 0  # Vertical velocity
        self.on_ground = True
        
        # Draw player as a blue rectangle
        self.id = canvas.create_rectangle(0, 0, 0, 0, fill="#4a90e2", outline="")
    
    def reset(self):
        """Reset player to starting position and state."""
        self.x = self.cloud_graph.nodes[0][0]
        self.y = self.cloud_graph.nodes[0][1]
        self.vx = 0
        self.vy = 0
        self.on_ground = True
    
    def move_left(self, event=None):
        """Handle left arrow key press."""
        self.vx = -6
    
    def move_right(self, event=None):
        """Handle right arrow key press."""
        self.vx = 6
    
    def stop(self, event=None):
        """Stop horizontal movement."""
        self.vx = 0
    
    def jump(self, event=None):
        """Handle space bar - player jumps if on ground."""
        if self.on_ground:
            self.vy = -14  # Jump velocity (upward)
            self.on_ground = False
    
    def update(self):
        """
        Update player position using physics simulation.
        Applies gravity, updates position, and checks ground collision.
        """
        # Apply horizontal movement
        self.x += self.vx
        # Clamp x position to screen bounds
        self.x = max(
            GameConfig.PLAYER_W // 2,
            min(GameConfig.WIDTH - GameConfig.PLAYER_W // 2, self.x)
        )
        
        # Apply gravity
        self.vy += 0.8
        # Update vertical position
        self.y += self.vy
        
        # Check collision with ground
        if self.y >= GameConfig.GROUND_Y:
            self.y = GameConfig.GROUND_Y
            self.vy = 0
            self.on_ground = True
        
        # Draw player at new position
        x1 = self.x - GameConfig.PLAYER_W // 2
        y1 = self.y - GameConfig.PLAYER_H
        x2 = self.x + GameConfig.PLAYER_W // 2
        y2 = self.y
        self.canvas.coords(self.id, x1, y1, x2, y2)


# ============================================================================
# ITEM - Represents collectible items (stars) falling from sky
# ============================================================================
class Item:
    """
    Falling item object. Spawns at top and falls vertically downward.
    Player must reach it before it passes the bottom of screen.
    """
    
    def __init__(self, canvas, x_pos, speed=4.0):
        self.canvas = canvas
        self.x = x_pos  # Horizontal position (stays constant)
        self.y = -20    # Start above screen
        self.speed = speed  # Vertical fall speed
        # Draw as white star
        self.id = canvas.create_oval(0, 0, 0, 0, fill="#ffff99", outline="#ffcc00", width=2)
    
    def update(self):
        """Update item position (falls downward)."""
        self.y += self.speed
        # Draw item at new position
        self.canvas.coords(
            self.id,
            self.x - GameConfig.ITEM_W // 2,
            self.y - GameConfig.ITEM_H // 2,
            self.x + GameConfig.ITEM_W // 2,
            self.y + GameConfig.ITEM_H // 2
        )
    
    def off_screen(self):
        """Check if item has fallen off bottom of screen."""
        return self.y > GameConfig.HEIGHT + 30
    
    def collides_with(self, player):
        """
        Check collision between item and player.
        Uses axis-aligned bounding box collision.
        """
        px1 = player.x - GameConfig.PLAYER_W // 2
        py1 = player.y - GameConfig.PLAYER_H
        px2 = player.x + GameConfig.PLAYER_W // 2
        py2 = player.y
        
        ix1 = self.x - GameConfig.ITEM_W // 2
        iy1 = self.y - GameConfig.ITEM_H // 2
        ix2 = self.x + GameConfig.ITEM_W // 2
        iy2 = self.y + GameConfig.ITEM_H // 2
        
        # Bounding box intersection test
        return not (px2 < ix1 or px1 > ix2 or py2 < iy1 or py1 > iy2)


# ============================================================================
# CLOUD VISUALIZATION - Draw clouds on screen
# ============================================================================
class CloudVisual:
    """Represents a visual cloud platform on screen."""
    
    def __init__(self, canvas, x, y):
        self.canvas = canvas
        self.x = x
        self.y = y
        # Draw cloud as light blue oval
        self.id = canvas.create_oval(
            x - 40, y - 20, x + 40, y + 20,
            fill="#e0f4ff", outline="#87ceeb", width=2
        )


# ============================================================================
# MAIN GAME CLASS - Orchestrates all game systems
# ============================================================================
class CloudCatcherGame:
    """
    Main game controller. Manages game loop, sequence generation,
    physics updates, collision detection, and rendering.
    """
    
    def __init__(self):
        # Initialize Tkinter window
        self.root = tk.Tk()
        self.root.title("Cloud Catchers - AI-Driven Platformer")
        self.root.resizable(False, False)
        
        # Create canvas for rendering
        self.canvas = tk.Canvas(
            self.root,
            width=GameConfig.WIDTH,
            height=GameConfig.HEIGHT,
            bg="#87ceeb",  # Sky blue
            highlightthickness=0
        )
        self.canvas.pack()
        
        # Initialize game systems
        self.cloud_graph = CloudGraph()  # Create cloud network
        self.sequence_generator = IDSSequenceGenerator(self.cloud_graph)  # IDS generator
        self.data_layer = DataLayer()  # Save/load system
        self.analytics = AnalyticsService()  # Statistics tracking
        self.achievements = AchievementService()  # Achievement system
        self.saved_data = self.data_layer.load()
        
        # Initialize game state
        self.player = Player(self.canvas, self.cloud_graph)
        self.items = []
        self.items_collected = 0
        self.sequence = None  # Current item sequence
        self.sequence_time = 0.0  # Time elapsed in current sequence
        self.game_over = False
        self.spawn_timer = None
        
        # Best score tracking
        self.best_score = self.saved_data["best_score"]
        
        # Visualize clouds
        self.cloud_visuals = []
        for cloud_pos in self.cloud_graph.nodes:
            visual = CloudVisual(self.canvas, cloud_pos[0], cloud_pos[1])
            self.cloud_visuals.append(visual)
        
        # Setup input handlers
        self.draw_scene()
        self.bind_controls()
        self.start_game()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
    
    def draw_scene(self):
        """Draw static scene elements."""
        # Draw ground
        self.canvas.delete("background")
        self.canvas.create_rectangle(
            0, GameConfig.GROUND_Y, GameConfig.WIDTH, GameConfig.HEIGHT,
            fill="#77c36f", outline="", tags="background"
        )
        # Draw title
        self.canvas.create_text(
            12, 12, anchor="nw", text="Cloud Catchers",
            font=("Arial", 18, "bold"), fill="white", tags="background"
        )
    
    def bind_controls(self):
        """Bind keyboard controls to player actions."""
        self.root.bind("<Left>", self.player.move_left)
        self.root.bind("<Right>", self.player.move_right)
        self.root.bind("<space>", self.player.jump)
        self.root.bind("<KeyRelease-Left>", self.player.stop)
        self.root.bind("<KeyRelease-Right>", self.player.stop)
        self.root.bind("<r>", self.restart)
        self.root.bind("<R>", self.restart)
    
    def start_game(self):
        """Initialize a new game session."""
        # Record new game start
        self.analytics.new_game()
        
        # Reset game state
        self.items_collected = 0
        self.game_over = False
        self.player.reset()
        
        # Clear any leftover items
        for item in self.items:
            self.canvas.delete(item.id)
        self.items.clear()
        
        # Generate new sequence using IDS
        self.sequence = self.sequence_generator.generate_sequence(
            GameConfig.IDS_MAX_DEPTH
        )
        self.sequence_time = 0.0
        
        # Start main game loop
        self.loop()
    
    def loop(self):
        """Main game loop - runs 60 FPS."""
        if self.game_over:
            return
        
        # Update sequence time
        self.sequence_time += 0.016  # ~60 FPS (16ms per frame)
        
        # Update player physics
        self.player.update()
        
        # Spawn items according to IDS-generated sequence
        self._spawn_items_from_sequence()
        
        # Update all items and check collisions
        remaining_items = []
        for item in self.items:
            item.update()
            
            # Check if player collected this item
            if item.collides_with(self.player):
                self.canvas.delete(item.id)
                self.items_collected += 1
                self.analytics.collected_item()
                
                # Check for new achievements
                unlocked = self.achievements.check(self.items_collected)
                if unlocked:
                    self.show_message(f"Achievement: {', '.join(unlocked)}")
                continue
            
            # Check if item fell off screen
            if item.off_screen():
                self.canvas.delete(item.id)
                # Sequence failed - player missed an item
                self.end_game(f"Missed an item! Score: {self.items_collected}")
                return
            
            remaining_items.append(item)
        
        self.items = remaining_items
        
        # Update best score
        self.best_score = max(self.best_score, self.items_collected)
        
        # Draw UI
        self.update_ui()
        
        # Check win condition
        if self.items_collected >= 15:
            self.end_game("You win! Press R to play again.")
            return
        
        # Schedule next frame
        self.root.after(16, self.loop)
    
    def _spawn_items_from_sequence(self):
        """
        Spawn items from the IDS-generated sequence based on timing.
        Items are spawned when sequence_time reaches their spawn time.
        """
        if not self.sequence:
            return
        
        for i, (cloud_id, spawn_time) in enumerate(self.sequence):
            # Check if it's time to spawn this item
            if spawn_time <= self.sequence_time:
                # Check if item already spawned
                if not hasattr(self, '_spawned_items'):
                    self._spawned_items = set()
                
                if i not in self._spawned_items:
                    # Spawn item at cloud position
                    cloud_x, _ = self.cloud_graph.get_node_position(cloud_id)
                    item = Item(self.canvas, cloud_x, speed=3.0)
                    self.items.append(item)
                    self._spawned_items.add(i)
    
    def update_ui(self):
        """Draw HUD showing score, best score, and controls."""
        self.canvas.delete("ui")
        
        # Current score
        self.canvas.create_text(
            10, 40, anchor="nw", text=f"Items: {self.items_collected}",
            font=("Arial", 14, "bold"), fill="white", tags="ui"
        )
        
        # Best score
        self.canvas.create_text(
            10, 65, anchor="nw", text=f"Best: {self.best_score}",
            font=("Arial", 14, "bold"), fill="white", tags="ui"
        )
        
        # Controls hint
        self.canvas.create_text(
            GameConfig.WIDTH - 10, 12, anchor="ne",
            text="← → Jump: Space | Restart: R",
            font=("Arial", 10), fill="white", tags="ui"
        )
    
    def show_message(self, text):
        """Display temporary on-screen message."""
        self.canvas.delete("message")
        self.canvas.create_text(
            GameConfig.WIDTH // 2, 100, text=text,
            font=("Arial", 14, "bold"), fill="#144d8a", tags="message"
        )
        # Auto-hide after 1.5 seconds
        self.root.after(1500, lambda: self.canvas.delete("message"))
    
    def end_game(self, text):
        """End current sequence/game and show results."""
        self.game_over = True
        
        # Record analytics
        self.analytics.completed_sequence()
        self.data_layer.save(self.best_score)
        
        # Draw game over screen
        self.canvas.create_rectangle(
            150, 200, 650, 360,
            fill="#ffffff", outline="#2b5d8a", width=3,
            tags="gameover"
        )
        self.canvas.create_text(
            400, 250, text="Sequence Complete",
            font=("Arial", 26, "bold"), fill="#2b5d8a", tags="gameover"
        )
        self.canvas.create_text(
            400, 300, text=text,
            font=("Arial", 14), fill="#2b5d8a", tags="gameover"
        )
        self.canvas.create_text(
            400, 330,
            text=f"Score: {self.items_collected}   Best: {self.best_score}",
            font=("Arial", 12), fill="#2b5d8a", tags="gameover"
        )
    
    def restart(self, event=None):
        """Restart game after sequence ends."""
        self.canvas.delete("all")
        self.draw_scene()
        
        # Redraw clouds
        for visual in self.cloud_visuals:
            CloudVisual(self.canvas, visual.x, visual.y)
        
        # Reset player
        self.player = Player(self.canvas, self.cloud_graph)
        self.items = []
        self._spawned_items = set()
        
        # Start new game
        self.start_game()
    
    def on_close(self):
        """Save progress and close game."""
        self.data_layer.save(self.best_score)
        self.analytics.save()
        self.root.destroy()
    
    def run(self):
        """Start the game."""
        self.root.mainloop()


# ============================================================================
# ENTRY POINT - Run the game
# ============================================================================
if __name__ == "__main__":
    # Create and start game
    game = CloudCatcherGame()
    game.run()
