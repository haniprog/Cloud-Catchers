"""
Cloud Catchers Game - Frog Platformer
Player is a frog jumping on disappearing cloud platforms
Avoid falling deadly stars to survive
Uses IDS to generate star obstacle patterns
Uses BFS to ensure platform path is survivable
"""
import json
import os
import random
import tkinter as tk
from collections import deque


# ============================================================================
# GAME CONFIGURATION - All adjustable game parameters
# ============================================================================
class GameConfig:
    # Canvas dimensions
    WIDTH = 800
    HEIGHT = 600
    GROUND_Y = 520
    
    # Frog sprite dimensions
    PLAYER_W = 30
    PLAYER_H = 20
    
    # Persistence files for save data and analytics
    SAVE_FILE = "savegame.json"
    ANALYTICS_FILE = "analytics.json"
    
    # Cloud generation - number of clouds and spacing
    NUM_CLOUDS = 6
    CLOUD_SPACING = 120  # Pixels between clouds horizontally
    CLOUD_START_X = 100
    
    # IDS parameters for obstacle sequence generation
    IDS_MAX_DEPTH = 8  # Maximum obstacles in a sequence
    
    # Game difficulty settings
    OBSTACLE_GROUPS_MIN = 2  # Minimum obstacles per sequence
    OBSTACLE_GROUPS_MAX = 5  # Maximum obstacles per sequence
    MAX_FALL_TIME = 10.0  # Maximum seconds before obstacle falls off screen


# ============================================================================
# CLOUD GRAPH - Models the game world as a graph of interconnected platforms
# ============================================================================
class CloudGraph:
    """
    Represents clouds as nodes in a graph where edges represent valid jumps.
    This is the state-space environment used by BFS for survivability validation.
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
        Each cloud is a potential landing platform for the frog.
        """
        for i in range(GameConfig.NUM_CLOUDS):
            x = GameConfig.CLOUD_START_X + i * GameConfig.CLOUD_SPACING
            y = GameConfig.GROUND_Y - 80  # Clouds elevated above ground
            self.nodes.append((x, y))
    
    def _build_edges(self):
        """
        Connect clouds based on jump distance.
        Frog can jump to adjacent clouds within jumping range.
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
                    # Frog can jump up to 150 pixels horizontally
                    if distance <= 150:
                        self.edges[i].append(j)
    
    def get_node_position(self, node_id):
        """Returns (x, y) position of a cloud node."""
        return self.nodes[node_id]
    
    def get_reachable_nodes(self, node_id):
        """Returns list of cloud indices reachable from given cloud."""
        return self.edges[node_id]


# ============================================================================
# BREADTH-FIRST SEARCH (BFS) - Validates obstacle sequence survivability
# ============================================================================
class BFSSolver:
    """
    Uses BFS to check if a frog can survive a sequence of falling obstacles.
    Ensures there's always a safe path of clouds to land on.
    """
    
    def is_sequence_survivable(self, cloud_graph, obstacle_sequence, start_cloud):
        """
        Check if frog can navigate all obstacles from start_cloud.
        
        Args:
            cloud_graph: CloudGraph object representing cloud network
            obstacle_sequence: List of (cloud_id, time) tuples for obstacles
            start_cloud: Starting cloud index
        
        Returns:
            True if sequence is survivable, False otherwise
        """
        # BFS to verify frog can reach safe clouds
        visited = set()
        queue = deque([start_cloud])
        visited.add(start_cloud)
        
        # Standard BFS traversal - ensure reachable clouds exist
        while queue:
            current_cloud = queue.popleft()
            
            # Expand to neighboring clouds
            for neighbor in cloud_graph.get_reachable_nodes(current_cloud):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        # Sequence is survivable if we have at least 2 reachable clouds
        return len(visited) >= 2


# ============================================================================
# ITERATIVE DEEPENING SEARCH (IDS) - Generates obstacle sequences
# ============================================================================
class IDSSequenceGenerator:
    """
    Uses IDS to systematically generate falling star obstacle sequences that are
    challenging but survivable. Starts simple and increases complexity.
    """
    
    def __init__(self, cloud_graph):
        self.cloud_graph = cloud_graph
        self.bfs_solver = BFSSolver()
        self.frog_start_cloud = 0  # Frog always starts at first cloud
    
    def generate_sequence(self, target_depth, max_attempts=20):
        """
        Generate a valid obstacle sequence using IDS up to target_depth.
        
        Args:
            target_depth: Number of obstacles in sequence to generate
            max_attempts: Maximum attempts before giving up
        
        Returns:
            List of (cloud_id, time) tuples representing obstacle positions
        """
        # Perform depth-limited search starting from depth 1
        for depth in range(1, target_depth + 1):
            for attempt in range(max_attempts):
                # Generate a random sequence at this depth
                sequence = self._generate_random_sequence(depth)
                
                # Validate using BFS
                if self.bfs_solver.is_sequence_survivable(
                    self.cloud_graph, sequence, self.frog_start_cloud
                ):
                    return sequence
        
        # Fallback: return a simple guaranteed-survivable sequence
        return self._generate_simple_fallback_sequence()
    
    def _generate_random_sequence(self, depth):
        """
        Create a random sequence of 'depth' obstacles across clouds.
        Each obstacle is assigned a random cloud and spawn time.
        """
        sequence = []
        current_time = 1.0
        
        for _ in range(depth):
            # Random cloud and time for this obstacle
            cloud_id = random.randint(0, len(self.cloud_graph.nodes) - 1)
            sequence.append((cloud_id, current_time))
            # Space obstacles apart in time to give frog time to dodge
            current_time += random.uniform(2.0, 4.0)
        
        return sequence
    
    def _generate_simple_fallback_sequence(self):
        """
        Generate a guaranteed-survivable sequence for reliability.
        """
        return [
            (1, 1.0),
            (3, 3.5),
            (5, 6.0),
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
            "obstacles_dodged": 0,
            "sequences_survived": 0,
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
    
    def dodged_obstacle(self):
        """Record when frog dodges an obstacle."""
        self.data["obstacles_dodged"] += 1
        self.save()
    
    def survived_sequence(self):
        """Record when frog survives a sequence."""
        self.data["sequences_survived"] += 1
        self.save()


# ============================================================================
# ACHIEVEMENT SYSTEM - Unlocks milestones
# ============================================================================
class AchievementService:
    """Awards achievements when frog reaches score milestones."""
    
    def __init__(self):
        # Set of unlocked achievement names
        self.unlocked = set()
    
    def check(self, obstacles_dodged):
        """
        Check for newly unlocked achievements at current score.
        
        Returns:
            List of newly unlocked achievement names
        """
        # Define achievement thresholds
        achievements = {
            1: "First Dodge",
            3: "Cloud Hopper",
            7: "Sky Dancer",
            15: "Frog Master",
        }
        
        newly_unlocked = []
        for threshold, name in achievements.items():
            # Check if score reached threshold and not already unlocked
            if obstacles_dodged >= threshold and name not in self.unlocked:
                self.unlocked.add(name)
                newly_unlocked.append(name)
        
        return newly_unlocked


# ============================================================================
# FROG - Player character that jumps on clouds and avoids stars
# ============================================================================
class Frog:
    """
    Frog player with physics simulation.
    Jumps on disappearing cloud platforms and avoids falling stars.
    Dies if: hits a star, falls off bottom, or runs out of platforms.
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
        self.current_cloud = 0  # Which cloud frog is on
        
        # Draw frog as a green sprite with eyes
        # Body: green rectangle
        self.body_id = canvas.create_rectangle(
            0, 0, 0, 0, fill="#2ecc71", outline="#27ae60", width=2, tags="frog"
        )
        # Eyes: two white circles
        self.eye_left_id = canvas.create_oval(
            0, 0, 0, 0, fill="white", outline="black", width=1, tags="frog"
        )
        self.eye_right_id = canvas.create_oval(
            0, 0, 0, 0, fill="white", outline="black", width=1, tags="frog"
        )
        # Pupils: two black dots
        self.pupil_left_id = canvas.create_oval(
            0, 0, 0, 0, fill="black", tags="frog"
        )
        self.pupil_right_id = canvas.create_oval(
            0, 0, 0, 0, fill="black", tags="frog"
        )
    
    def reset(self):
        """Reset frog to starting position and state."""
        self.x = self.cloud_graph.nodes[0][0]
        self.y = self.cloud_graph.nodes[0][1]
        self.vx = 0
        self.vy = 0
        self.on_ground = True
        self.current_cloud = 0
    
    def move_left(self, event=None):
        """Handle left arrow key press - hop left."""
        self.vx = -6
    
    def move_right(self, event=None):
        """Handle right arrow key press - hop right."""
        self.vx = 6
    
    def stop(self, event=None):
        """Stop horizontal movement."""
        self.vx = 0
    
    def jump(self, event=None):
        """Handle space bar - frog jumps if on ground."""
        if self.on_ground:
            self.vy = -14  # Jump velocity (upward)
            self.on_ground = False
    
    def update(self, cloud_platforms):
        """
        Update frog position using physics simulation.
        Applies gravity, updates position, checks cloud collisions.
        
        Returns:
            True if frog alive, False if frog died
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
        
        # Check collision with clouds (platforms)
        landing_on_cloud = False
        for i, cloud in enumerate(cloud_platforms):
            # Only collide with solid clouds
            if not cloud.is_solid():
                continue
            
            # Check if frog is landing on this cloud
            cloud_x, cloud_y = cloud.x, cloud.y
            if (abs(self.x - cloud_x) < 50 and 
                self.vy > 0 and 
                abs(self.y - cloud_y) < 40):
                
                # Land on cloud
                self.y = cloud_y - 40
                self.vy = 0
                self.on_ground = True
                self.current_cloud = i
                cloud.touch()  # Cloud starts disappearing timer
                landing_on_cloud = True
        
        # Check collision with ground at bottom (death - fell off)
        if self.y >= GameConfig.HEIGHT:
            return False  # Frog died - fell off screen
        
        # Draw frog at new position
        self._draw_frog()
        return True  # Frog still alive
    
    def _draw_frog(self):
        """Draw frog sprite at current position."""
        # Body - main rectangle
        self.canvas.coords(
            self.body_id,
            self.x - 15, self.y - 12,
            self.x + 15, self.y + 8
        )
        # Left eye
        self.canvas.coords(
            self.eye_left_id,
            self.x - 10, self.y - 10,
            self.x - 5, self.y - 5
        )
        # Right eye
        self.canvas.coords(
            self.eye_right_id,
            self.x + 5, self.y - 10,
            self.x + 10, self.y - 5
        )
        # Left pupil
        self.canvas.coords(
            self.pupil_left_id,
            self.x - 9, self.y - 8,
            self.x - 7, self.y - 6
        )
        # Right pupil
        self.canvas.coords(
            self.pupil_right_id,
            self.x + 7, self.y - 8,
            self.x + 9, self.y - 6
        )


# ============================================================================
# CLOUD PLATFORM - Disappearing platforms frog jumps on
# ============================================================================
class CloudPlatform:
    """
    Cloud platforms that frog jumps on.
    When frog lands on a cloud, it starts a disappear timer.
    After timeout, the cloud fades and becomes non-solid.
    """
    
    def __init__(self, canvas, x, y, cloud_id):
        self.canvas = canvas
        self.x = x
        self.y = y
        self.cloud_id = cloud_id
        
        # Cloud state: how long until it disappears (in seconds)
        self.disappear_timer = None  # None = not touched yet
        self.disappear_delay = 2.5  # Seconds before cloud vanishes after landing
        
        # Visual representation - cloud oval
        self.id = canvas.create_oval(
            x - 40, y - 20, x + 40, y + 20,
            fill="#e0f4ff", outline="#87ceeb", width=2, tags="platform"
        )
        self.label = canvas.create_text(
            x, y, text=str(cloud_id),
            font=("Arial", 8, "bold"), fill="#4a90e2", tags="platform"
        )
    
    def touch(self):
        """
        Called when frog lands on this cloud.
        Starts the disappear countdown.
        """
        if self.disappear_timer is None:
            self.disappear_timer = self.disappear_delay
    
    def update(self, dt):
        """
        Update cloud state each frame.
        Decrements disappear timer and fades appearance.
        """
        if self.disappear_timer is not None:
            self.disappear_timer -= dt
            
            # Fade out effect: cloud becomes lighter as it disappears
            progress = 1.0 - (self.disappear_timer / self.disappear_delay)
            if progress < 0.7:
                # Still mostly visible
                self.canvas.itemconfig(self.id, fill="#e0f4ff")
            else:
                # Almost gone - very faint
                self.canvas.itemconfig(self.id, fill="#f0f8ff", outline="#d0e8ff")
    
    def is_solid(self):
        """Check if cloud is still a solid platform."""
        return self.disappear_timer is None or self.disappear_timer > 0
    
    def is_visible(self):
        """Check if cloud should be drawn."""
        return self.disappear_timer is None or self.disappear_timer > -0.5


# ============================================================================
# FALLING OBSTACLE - Deadly stars that kill frog on contact
# ============================================================================
class FallingObstacle:
    """
    Stars that fall from the sky and are deadly hazards.
    If frog touches a star, frog dies and game ends.
    Stars are RED 5-pointed shapes.
    """
    
    def __init__(self, canvas, x_pos, speed=4.0):
        self.canvas = canvas
        self.x = x_pos  # Horizontal position (stays constant)
        self.y = -30    # Start above screen
        self.speed = speed  # Vertical fall speed
        
        # Draw star shape (5-pointed star using polygon)
        self.id = canvas.create_polygon(
            x_pos, self.y,           # Top point
            x_pos + 8, self.y + 8,   # Upper right
            x_pos + 18, self.y + 8,  # Right point
            x_pos + 11, self.y + 14, # Lower right
            x_pos + 14, self.y + 24, # Bottom right
            x_pos, self.y + 18,      # Bottom center
            x_pos - 14, self.y + 24, # Bottom left
            x_pos - 11, self.y + 14, # Lower left
            x_pos - 18, self.y + 8,  # Left point
            x_pos - 8, self.y + 8,   # Upper left
            fill="#ff6b6b", outline="#cc0000", width=2, tags="hazard"
        )
    
    def update(self):
        """Update falling position downward."""
        self.y += self.speed
        # Redraw star at new position using polygon points
        self.canvas.coords(
            self.id,
            self.x, self.y,
            self.x + 8, self.y + 8,
            self.x + 18, self.y + 8,
            self.x + 11, self.y + 14,
            self.x + 14, self.y + 24,
            self.x, self.y + 18,
            self.x - 14, self.y + 24,
            self.x - 11, self.y + 14,
            self.x - 18, self.y + 8,
            self.x - 8, self.y + 8,
        )
    
    def off_screen(self):
        """Check if star has fallen off bottom of screen."""
        return self.y > GameConfig.HEIGHT + 50
    
    def collides_with(self, frog):
        """
        Check collision between deadly star and frog.
        Uses simple distance-based collision detection.
        """
        dx = abs(self.x - frog.x)
        dy = abs(self.y - frog.y)
        # Star touches frog if distance is small enough
        return (dx < 25) and (dy < 30)


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
        self.root.title("Cloud Catchers - Frog Platformer")
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
        self.frog = Frog(self.canvas, self.cloud_graph)
        self.obstacles = []  # Falling stars
        self.cloud_platforms = []  # Cloud platforms
        self.obstacles_dodged = 0
        self.sequence = None  # Current obstacle sequence
        self.sequence_time = 0.0  # Time elapsed in current sequence
        self.game_over = False
        
        # Best score tracking
        self.best_score = self.saved_data["best_score"]
        
        # Create cloud platforms
        for i, cloud_pos in enumerate(self.cloud_graph.nodes):
            platform = CloudPlatform(self.canvas, cloud_pos[0], cloud_pos[1], i)
            self.cloud_platforms.append(platform)
        
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
            12, 12, anchor="nw", text="Cloud Catchers - Frog Platformer",
            font=("Arial", 18, "bold"), fill="white", tags="background"
        )
    
    def bind_controls(self):
        """Bind keyboard controls to frog actions."""
        self.root.bind("<Left>", self.frog.move_left)
        self.root.bind("<Right>", self.frog.move_right)
        self.root.bind("<space>", self.frog.jump)
        self.root.bind("<KeyRelease-Left>", self.frog.stop)
        self.root.bind("<KeyRelease-Right>", self.frog.stop)
        self.root.bind("<r>", self.restart)
        self.root.bind("<R>", self.restart)
    
    def start_game(self):
        """Initialize a new game session."""
        # Record new game start
        self.analytics.new_game()
        
        # Reset game state
        self.obstacles_dodged = 0
        self.game_over = False
        self.frog.reset()
        
        # Clear any leftover obstacles
        for obstacle in self.obstacles:
            self.canvas.delete(obstacle.id)
        self.obstacles.clear()
        
        # Reset cloud platforms
        for cloud in self.cloud_platforms:
            cloud.disappear_timer = None
        
        # Generate new obstacle sequence using IDS
        self.sequence = self.sequence_generator.generate_sequence(
            GameConfig.IDS_MAX_DEPTH
        )
        self.sequence_time = 0.0
        self._spawned_obstacles = set()
        
        # Start main game loop
        self.loop()
    
    def loop(self):
        """Main game loop - runs 60 FPS."""
        if self.game_over:
            return
        
        # Increment time
        dt = 0.016  # ~60 FPS (16ms per frame)
        self.sequence_time += dt
        
        # Update frog physics
        frog_alive = self.frog.update(self.cloud_platforms)
        if not frog_alive:
            self.end_game("Frog fell off! Game Over!")
            return
        
        # Update cloud platforms
        for cloud in self.cloud_platforms:
            cloud.update(dt)
        
        # Spawn obstacles from IDS-generated sequence
        self._spawn_obstacles_from_sequence()
        
        # Update all obstacles and check collisions
        remaining_obstacles = []
        for obstacle in self.obstacles:
            obstacle.update()
            
            # Check if frog hit this deadly star
            if obstacle.collides_with(self.frog):
                self.end_game("Hit by a star! Game Over!")
                return
            
            # Check if obstacle fell off screen
            if obstacle.off_screen():
                self.canvas.delete(obstacle.id)
                self.obstacles_dodged += 1
                self.analytics.dodged_obstacle()
                
                # Check for new achievements
                unlocked = self.achievements.check(self.obstacles_dodged)
                if unlocked:
                    self.show_message(f"Achievement: {', '.join(unlocked)}")
                continue
            
            remaining_obstacles.append(obstacle)
        
        self.obstacles = remaining_obstacles
        
        # Update best score
        self.best_score = max(self.best_score, self.obstacles_dodged)
        
        # Draw UI
        self.update_ui()
        
        # Check win condition - survive enough obstacles
        if self.obstacles_dodged >= 10:
            self.end_game("You survived! You win!")
            return
        
        # Schedule next frame
        self.root.after(16, self.loop)
    
    def _spawn_obstacles_from_sequence(self):
        """
        Spawn obstacles from the IDS-generated sequence based on timing.
        Obstacles are spawned when sequence_time reaches their spawn time.
        """
        if not self.sequence:
            return
        
        for i, (cloud_id, spawn_time) in enumerate(self.sequence):
            # Check if it's time to spawn this obstacle
            if spawn_time <= self.sequence_time:
                # Check if obstacle already spawned
                if i not in self._spawned_obstacles:
                    # Spawn obstacle at cloud position
                    cloud_x, _ = self.cloud_graph.get_node_position(cloud_id)
                    obstacle = FallingObstacle(self.canvas, cloud_x, speed=3.5)
                    self.obstacles.append(obstacle)
                    self._spawned_obstacles.add(i)
    
    def update_ui(self):
        """Draw HUD showing score, best score, and controls."""
        self.canvas.delete("ui")
        
        # Current score - obstacles dodged
        self.canvas.create_text(
            10, 40, anchor="nw", text=f"Dodged: {self.obstacles_dodged}",
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
            text="Move: <- -> | Jump: Space | Restart: R",
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
        """End current game and show results."""
        self.game_over = True
        
        # Record analytics
        self.analytics.survived_sequence()
        self.data_layer.save(self.best_score)
        
        # Draw game over screen
        self.canvas.create_rectangle(
            150, 200, 650, 360,
            fill="#ffffff", outline="#2b5d8a", width=3,
            tags="gameover"
        )
        self.canvas.create_text(
            400, 250, text="Game Over",
            font=("Arial", 26, "bold"), fill="#2b5d8a", tags="gameover"
        )
        self.canvas.create_text(
            400, 300, text=text,
            font=("Arial", 14), fill="#2b5d8a", tags="gameover"
        )
        self.canvas.create_text(
            400, 330,
            text=f"Score: {self.obstacles_dodged}   Best: {self.best_score}",
            font=("Arial", 12), fill="#2b5d8a", tags="gameover"
        )
    
    def restart(self, event=None):
        """Restart game after sequence ends."""
        self.canvas.delete("all")
        self.draw_scene()
        
        # Reset frog
        self.frog = Frog(self.canvas, self.cloud_graph)
        self.obstacles = []
        self._spawned_obstacles = set()
        
        # Recreate cloud platforms
        self.cloud_platforms = []
        for i, cloud_pos in enumerate(self.cloud_graph.nodes):
            platform = CloudPlatform(self.canvas, cloud_pos[0], cloud_pos[1], i)
            self.cloud_platforms.append(platform)
        
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
