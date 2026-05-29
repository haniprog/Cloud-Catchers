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

from ai_algorithms import CloudGraph, IDSSequenceGenerator
from ui_theme import HOME_THEME, SELECT_THEME


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
    NUM_CLOUD_ROWS = 7
    NUM_CLOUD_COLUMNS = 4
    CLOUD_ROW_GAP = 68
    CLOUD_JUMP_RANGE = 185
    
    # IDS parameters for obstacle sequence generation
    IDS_MAX_DEPTH = 8  # Maximum obstacles in a sequence
    
    # Game difficulty settings
    OBSTACLE_GROUPS_MIN = 2  # Minimum obstacles per sequence
    OBSTACLE_GROUPS_MAX = 5  # Maximum obstacles per sequence
    MAX_FALL_TIME = 10.0  # Maximum seconds before obstacle falls off screen


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
        self.current_cloud_row = 0
        
        # Draw frog as a green rounded sprite with eyes and smiling mouth
        self.body_id = canvas.create_oval(
            0, 0, 0, 0, fill="#5fd08a", outline="#2fa86a", width=2, tags="frog"
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
        # Small smiling mouth (arc)
        self.mouth_id = canvas.create_arc(0, 0, 0, 0, start=180, extent=180, style="arc", outline="#1f6b3f", width=2, tags="frog")
    
    def reset(self):
        """Reset frog to starting position and state."""
        self.x = self.cloud_graph.nodes[0][0]
        self.y = self.cloud_graph.nodes[0][1]
        self.vx = 0
        self.vy = -14  # Auto-jump immediately so the game starts moving on its own
        self.on_ground = False
        self.current_cloud = 0
        self.current_cloud_row = 0
    
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
        """Manual jump is disabled; jumping happens automatically when landing."""
        return
    
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
                abs(self.y - cloud_y) < 40 and
                cloud.row in (self.current_cloud_row, self.current_cloud_row + 1)):
                
                # Land on cloud
                self.y = cloud_y - 40
                self.vy = -14  # Auto-jump upward immediately after landing
                self.on_ground = False
                self.current_cloud = i
                self.current_cloud_row = cloud.row
                cloud.touch()  # Cloud starts disappearing timer
                landing_on_cloud = True
                break

            self.on_ground = landing_on_cloud and self.vy < 0
        
        # Check collision with ground at bottom (death - fell off)
        try:
            canvas_h = int(self.canvas.winfo_height())
        except Exception:
            canvas_h = GameConfig.HEIGHT
        if self.y >= canvas_h:
            return False  # Frog died - fell off screen
        
        # Draw frog at new position
        self._draw_frog()
        return True  # Frog still alive
    
    def _draw_frog(self):
        """Draw frog sprite at current position."""
        # Body - main oval
        self.canvas.coords(
            self.body_id,
            self.x - 16, self.y - 14,
            self.x + 16, self.y + 10
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
        # Mouth - small arc under eyes
        self.canvas.coords(
            self.mouth_id,
            self.x - 8, self.y - 2,
            self.x + 8, self.y + 8
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
    
    def __init__(self, canvas, x, y, cloud_id, row):
        self.canvas = canvas
        self.x = x
        self.y = y
        self.cloud_id = cloud_id
        self.row = row
        
        # Cloud state: how long until it disappears (in seconds)
        self.disappear_timer = None  # None = not touched yet
        # Clouds should disappear within 5 seconds of being stepped on
        self.disappear_delay = min(5.0, max(1.2, 2.6 - row * 0.18))
        
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
    
    def update(self, speed_boost=0.0):
        """Update falling position downward."""
        self.y += self.speed + speed_boost
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
        try:
            canvas_h = int(self.canvas.winfo_height())
        except Exception:
            canvas_h = GameConfig.HEIGHT
        return self.y > canvas_h + 50
    
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
        self.root.resizable(True, True)
        self.root.configure(bg=HOME_THEME["page_bg"])

        self.root.update_idletasks()
        self.screen_width = self.root.winfo_screenwidth()
        self.screen_height = self.root.winfo_screenheight()

        window_width = min(1280, max(1024, self.screen_width - 120))
        window_height = min(720, max(640, self.screen_height - 120))
        self.window_width = window_width
        self.window_height = window_height
        self.is_fullscreen = False
        self.root.geometry(f"{window_width}x{window_height}")
        self.root.minsize(960, 600)
        
        # Create canvas for rendering
        self.canvas = tk.Canvas(
            self.root,
            width=window_width,
            height=window_height,
            bg="#0c0520",
            highlightthickness=0
        )
        self.canvas.place(x=0, y=0, width=window_width, height=window_height)
        # Ensure window/canvas has focus so key events are received
        try:
            self.root.focus_set()
            self.canvas.focus_set()
        except Exception:
            pass
        
        # Initialize game systems
        self.cloud_graph = CloudGraph(
            GameConfig.WIDTH,
            GameConfig.GROUND_Y,
            rows=GameConfig.NUM_CLOUD_ROWS,
            columns=GameConfig.NUM_CLOUD_COLUMNS,
            row_gap=GameConfig.CLOUD_ROW_GAP,
            jump_range=GameConfig.CLOUD_JUMP_RANGE,
        )  # Cloud network used by BFS/IDS/DLS
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
        self.on_home_screen = True
        self.on_select_screen = False
        self.selected_catcher = 0
        self.select_card_bounds = []
        # Continuous hazard spawner state
        self.last_hazard_spawn = 0.0
        self.hazard_spawn_interval = 1.6  # base seconds between spawns (will scale)
        
        # Best score tracking
        self.best_score = self.saved_data["best_score"]
        
        # Build the initial world to match the actual canvas dimensions
        self._rebuild_world()
        
        # Setup input handlers
        self.draw_scene()
        self.draw_home_screen()
        self.bind_controls()
        self.canvas.bind("<Button-1>", self._on_canvas_click)
        self.root.bind("<Configure>", self._on_root_configure)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
    
    def draw_scene(self):
        """Draw static scene elements."""
        # Draw ground
        self.canvas.delete("background")
        width, height = self._display_size()

        # Sky gradient and decorative clouds for gameplay view
        self._draw_game_gradient(width, height)
        self._draw_game_clouds(width, height)

        # Ground strip - draw as 'ground' so it can move with the world when camera scrolls
        ground_y = min(height - 80, GameConfig.GROUND_Y)
        self.canvas.create_rectangle(0, ground_y, width, height, fill="#2f8f4a", outline="", tags="ground")
        # Ensure background/ground sit behind gameplay items
        try:
            self.canvas.tag_lower("background")
            self.canvas.tag_lower("ground")
        except Exception:
            pass
        # Raise interactive items so they remain visible
        try:
            self.canvas.tag_raise("platform")
            self.canvas.tag_raise("frog")
            self.canvas.tag_raise("hazard")
            self.canvas.tag_raise("ui")
        except Exception:
            pass

    def _draw_game_clouds(self, width, height):
        """Draw decorative soft clouds for the gameplay background."""
        cloud_color = "#ffffff"
        specs = [
            (int(width * 0.12), int(height * 0.18), 1.0),
            (int(width * 0.35), int(height * 0.10), 0.8),
            (int(width * 0.6), int(height * 0.22), 1.1),
            (int(width * 0.82), int(height * 0.15), 0.7),
            (int(width * 0.75), int(height * 0.45), 1.2),
        ]
        for x, y, s in specs:
            rx = int(34 * s)
            ry = int(20 * s)
            self.canvas.create_oval(x - rx, y - ry, x + rx, y + ry, fill=cloud_color, outline="", tags="background")
            self.canvas.create_oval(x + int(20 * s) - rx, y - int(12 * s) - ry, x + int(20 * s) + rx, y - int(12 * s) + ry, fill=cloud_color, outline="", tags="background")
            self.canvas.create_oval(x + int(40 * s) - rx, y + int(6 * s) - ry, x + int(40 * s) + rx, y + int(6 * s) + ry, fill=cloud_color, outline="", tags="background")

    def _draw_game_gradient(self, width, height):
        """Draw a soft vertical sky gradient for gameplay."""
        # Gradient from sky blue at top to soft green near ground
        colors = [
            "#aee1ff", "#bfe9ff", "#d6f5ff", "#e8fbf0", "#e6f7e6", "#d6f0d6"
        ]
        stripe_h = max(1, height // len(colors))
        y = 0
        for c in colors:
            ny = min(height, y + stripe_h)
            self.canvas.create_rectangle(0, y, width, ny, fill=c, outline="", tags="background")
            y = ny

    def draw_home_screen(self):
        """Draw a Doodle Jump-inspired intro screen before gameplay starts."""
        self.canvas.delete("home")

        width, height = self._display_size()
        card_margin_x = int(width * 0.05)
        card_margin_y = int(height * 0.05)
        card_x1 = card_margin_x
        card_y1 = card_margin_y
        card_x2 = width - card_margin_x
        card_y2 = height - card_margin_y
        card_radius = 28

        # Outer page background.
        self.canvas.create_rectangle(
            0, 0, width, height,
            fill=HOME_THEME["page_bg"], outline="", tags="home"
        )

        # A warm vertical gradient inside the main card.
        self._draw_home_gradient_card(card_x1, card_y1, card_x2, card_y2)

        # Card frame.
        self._draw_home_rounded_rect(card_x1, card_y1, card_x2, card_y2, card_radius, fill="", outline=HOME_THEME["card_outline"], width=2)

        # Small twinkling stars.
        sparkle_points = [
            (card_x1 + 70, card_y1 + 60), (card_x1 + 145, card_y1 + 160), (card_x1 + 320, card_y1 + 230),
            (card_x1 + 500, card_y1 + 120), (card_x1 + 680, card_y1 + 55), (card_x1 + 830, card_y1 + 170),
            (card_x1 + 1060, card_y1 + 40), (card_x1 + 950, card_y1 + 410), (card_x1 + 200, card_y1 + 95)
        ]
        for x, y in sparkle_points:
            self.canvas.create_oval(x, y, x + 3, y + 3, fill=HOME_THEME["sparkle"], outline="", tags="home")

        # Soft cloud clusters inspired by the reference image.
        cloud_specs = [
            (card_x1 + 35, card_y1 + 255, 1.15),
            (card_x1 + 760, card_y1 + 280, 1.35),
            (card_x1 + 930, card_y1 + 470, 1.10),
            (card_x1 + 520, card_y1 + 510, 0.78),
        ]
        for x, y, scale in cloud_specs:
            self._draw_home_cloud(x, y, scale)

        # Sun glow behind the button.
        sun_cx = width // 2
        sun_cy = card_y1 + int((card_y2 - card_y1) * 0.62)
        self.canvas.create_oval(sun_cx - 95, sun_cy - 95, sun_cx + 95, sun_cy + 95, fill=HOME_THEME["sun_outer"], outline="", tags="home")
        self.canvas.create_oval(sun_cx - 72, sun_cy - 72, sun_cx + 72, sun_cy + 72, fill=HOME_THEME["sun_mid"], outline="", tags="home")
        self.canvas.create_oval(sun_cx - 45, sun_cy - 45, sun_cx + 45, sun_cy + 45, fill=HOME_THEME["sun_inner"], outline="", tags="home")

        # Main title inside the card.
        self.canvas.create_text(
            width // 2, card_y1 + int((card_y2 - card_y1) * 0.42),
            text="Cloud Catchers",
            font=HOME_THEME["title_font"],
            fill=HOME_THEME["title_main"],
            tags="home"
        )
        self.canvas.create_text(
            width // 2, card_y1 + int((card_y2 - card_y1) * 0.50),
            text="HOP THE SKY · DODGE THE STARS",
            font=HOME_THEME["subtitle_font"],
            fill=HOME_THEME["subtitle_main"],
            tags="home"
        )

        # Characters on the home screen.
        emoji_y = card_y1 + int((card_y2 - card_y1) * 0.26)
        self.canvas.create_text(width // 2 - 80, emoji_y, text="🐸", font=HOME_THEME["emoji_font"], tags="home")
        self.canvas.create_text(width // 2, emoji_y, text="🐰", font=HOME_THEME["emoji_font"], tags="home")
        self.canvas.create_text(width // 2 + 80, emoji_y, text="🐱", font=HOME_THEME["emoji_font"], tags="home")

        # Play button and glow.
        button_w = int(width * 0.42)
        button_h = 60
        button_x1 = width // 2 - button_w // 2
        button_y1 = card_y1 + int((card_y2 - card_y1) * 0.62)
        button_x2 = button_x1 + button_w
        button_y2 = button_y1 + button_h

        self.canvas.create_oval(button_x1 - 16, button_y1 - 16, button_x2 + 16, button_y2 + 16, fill=HOME_THEME["button_glow_outer"], outline="", tags="home")
        self.canvas.create_oval(button_x1 - 6, button_y1 - 6, button_x2 + 6, button_y2 + 6, fill=HOME_THEME["button_glow_inner"], outline="", tags="home")
        self._draw_home_rounded_rect(button_x1, button_y1, button_x2, button_y2, 18, fill=HOME_THEME["button_left"], outline="", width=0, tag="home")
        self._draw_home_rounded_rect(button_x1 + int(button_w * 0.45), button_y1, button_x2, button_y2, 18, fill=HOME_THEME["button_right"], outline="", width=0, tag="home")
        self.canvas.create_text(
            width // 2, button_y1 + button_h // 2,
            text="Tap to play  ▶",
            font=HOME_THEME["button_font"],
            fill=HOME_THEME["button_text"],
            tags=("home", "play_button")
        )

        self.canvas.create_text(
            width // 2, card_y2 - 28,
            text=f"BEST ALTITUDE · {self.best_score} M",
            font=HOME_THEME["footer_font"],
            fill=HOME_THEME["footer"],
            tags="home"
        )

    def draw_catcher_select_screen(self):
        """Draw the catcher selection screen shown after tapping play."""
        self.canvas.delete("select")
        self.canvas.delete("home")
        self.canvas.delete("gameover")

        width, height = self._display_size()
        panel_w = int(width * 0.36)
        panel_h = int(height * 0.42)
        panel_x1 = width // 2 - panel_w // 2
        panel_y1 = height // 2 - panel_h // 2 - 20
        panel_x2 = panel_x1 + panel_w
        panel_y2 = panel_y1 + panel_h

        self.canvas.create_rectangle(0, 0, width, height, fill=SELECT_THEME["page_bg"], outline="", tags="select")
        self._draw_home_rounded_rect(panel_x1, panel_y1, panel_x2, panel_y2, 24, fill=SELECT_THEME["panel_fill"], outline=SELECT_THEME["panel_outline"], width=2, tag="select")

        self.canvas.create_text(
            width // 2, panel_y1 + 38,
            text="Choose your catcher",
            font=SELECT_THEME["title_font"],
            fill=SELECT_THEME["title_fill"],
            tags="select"
        )

        card_w = 134
        card_h = 108
        gap = 12
        total_w = card_w * 3 + gap * 2
        cards_x1 = width // 2 - total_w // 2
        card_y1 = panel_y1 + 74
        self.select_card_bounds = []

        catchers = [
            ("Mochi", "🐸"),
            ("Pip", "🐰"),
            ("Luna", "🐱"),
        ]
        for index, (name, emoji) in enumerate(catchers):
            x1 = cards_x1 + index * (card_w + gap)
            x2 = x1 + card_w
            y1 = card_y1
            y2 = y1 + card_h
            self.select_card_bounds.append((x1, y1, x2, y2))

            selected = index == self.selected_catcher
            fill = SELECT_THEME["card_selected_fill"] if selected else SELECT_THEME["card_fill"]
            outline = SELECT_THEME["card_selected_outline"] if selected else SELECT_THEME["card_outline"]
            self._draw_home_rounded_rect(x1, y1, x2, y2, 18, fill=fill, outline=outline, width=2, tag="select")
            self.canvas.create_text(x1 + card_w // 2, y1 + 34, text=emoji, font=SELECT_THEME["emoji_font"], fill="#ffffff", tags="select")
            self.canvas.create_text(x1 + card_w // 2, y2 - 24, text=name, font=SELECT_THEME["card_name_font"], fill=SELECT_THEME["label_fill"], tags="select")

        self.canvas.create_text(
            width // 2, panel_y2 - 84,
            text="Use ← → or drag to move.\nJump cloud to cloud. Avoid the falling stars.",
            font=SELECT_THEME["instruction_font"],
            fill=SELECT_THEME["instruction_fill"],
            justify="center",
            tags="select"
        )

        button_w = int(panel_w * 0.90)
        button_h = 60
        button_x1 = width // 2 - button_w // 2
        button_y1 = panel_y2 - 50
        button_x2 = button_x1 + button_w
        button_y2 = button_y1 + button_h
        self._draw_home_rounded_rect(button_x1, button_y1, button_x2, button_y2, 18, fill=SELECT_THEME["button_left"], outline="", width=0, tag="select")
        self._draw_home_rounded_rect(button_x1 + int(button_w * 0.45), button_y1, button_x2, button_y2, 18, fill=SELECT_THEME["button_right"], outline="", width=0, tag="select")
        self.canvas.create_text(
            width // 2, button_y1 + button_h // 2,
            text="Start climbing →",
            font=SELECT_THEME["button_font"],
            fill=SELECT_THEME["button_text"],
            tags=("select", "start_button")
        )

        self.canvas.create_text(
            width // 2, panel_y2 + 26,
            text=f"Best altitude: {self.best_score} m",
            font=SELECT_THEME["footer_font"],
            fill=SELECT_THEME["footer_fill"],
            tags="select"
        )

    def _draw_home_cloud(self, x, y, scale):
        """Draw a soft cloud cluster on the home screen."""
        radius_x = int(30 * scale)
        radius_y = int(18 * scale)
        color = HOME_THEME["cloud"]
        self.canvas.create_oval(x, y, x + radius_x * 2, y + radius_y * 2, fill=color, outline="", tags="home")
        self.canvas.create_oval(x + int(25 * scale), y - int(12 * scale), x + int(25 * scale) + radius_x * 2, y - int(12 * scale) + radius_y * 2, fill=color, outline="", tags="home")
        self.canvas.create_oval(x + int(50 * scale), y + int(6 * scale), x + int(50 * scale) + radius_x * 2, y + int(6 * scale) + radius_y * 2, fill=color, outline="", tags="home")

    def _draw_home_rounded_rect(self, x1, y1, x2, y2, radius, fill, outline="", width=1, tag="home"):
        """Draw a rounded rectangle using simple ovals and rectangles."""
        self.canvas.create_rectangle(x1 + radius, y1, x2 - radius, y2, fill=fill, outline=outline, width=width, tags=tag)
        self.canvas.create_rectangle(x1, y1 + radius, x2, y2 - radius, fill=fill, outline=outline, width=width, tags=tag)
        self.canvas.create_oval(x1, y1, x1 + radius * 2, y1 + radius * 2, fill=fill, outline=outline, width=width, tags=tag)
        self.canvas.create_oval(x2 - radius * 2, y1, x2, y1 + radius * 2, fill=fill, outline=outline, width=width, tags=tag)
        self.canvas.create_oval(x1, y2 - radius * 2, x1 + radius * 2, y2, fill=fill, outline=outline, width=width, tags=tag)
        self.canvas.create_oval(x2 - radius * 2, y2 - radius * 2, x2, y2, fill=fill, outline=outline, width=width, tags=tag)

    def _draw_home_gradient_card(self, x1, y1, x2, y2):
        """Draw a simple vertical gradient for the intro card."""
        gradient_colors = HOME_THEME["card_fill_top"]
        height = y2 - y1
        stripe_height = max(1, height // len(gradient_colors))
        current_y = y1
        for color in gradient_colors:
            next_y = min(y2, current_y + stripe_height)
            self.canvas.create_rectangle(x1, current_y, x2, next_y, fill=color, outline="", tags="home")
            current_y = next_y
        if current_y < y2:
            self.canvas.create_rectangle(x1, current_y, x2, y2, fill=gradient_colors[-1], outline="", tags="home")

    def _display_size(self):
        """Return the current drawing size for the active window mode."""
        if self.is_fullscreen:
            return self.screen_width, self.screen_height
        return self.window_width, self.window_height

    def _on_root_configure(self, event):
        """Keep the canvas synced to the actual visible window size."""
        if event.widget is not self.root:
            return

        width = max(1, event.width)
        height = max(1, event.height)

        if self.is_fullscreen:
            self.screen_width = width
            self.screen_height = height
        else:
            self.window_width = width
            self.window_height = height

        self.canvas.place(x=0, y=0, width=width, height=height)
        self.canvas.configure(width=width, height=height)

        if self.on_home_screen:
            self.draw_home_screen()
        elif self.on_select_screen:
            self.draw_catcher_select_screen()
        else:
            # Rebuild world to adapt to new window size so the main grid scales
            self._rebuild_world()
            self.draw_scene()

    def _on_canvas_click(self, event):
        """Start the game when the home screen is clicked."""
        if self.on_home_screen and not self.game_over:
            self.begin_game()
            return

        if self.on_select_screen and not self.game_over:
            self._handle_select_screen_click(event.x, event.y)

    def _handle_select_screen_click(self, x, y):
        """Handle clicks on the catcher selection screen."""
        for index, (x1, y1, x2, y2) in enumerate(self.select_card_bounds):
            if x1 <= x <= x2 and y1 <= y <= y2:
                self.selected_catcher = index
                self.draw_catcher_select_screen()
                return

        width, height = self._display_size()
        panel_w = int(width * 0.36)
        panel_h = int(height * 0.42)
        panel_y1 = height // 2 - panel_h // 2 - 20
        panel_y2 = panel_y1 + panel_h
        button_w = int(panel_w * 0.90)
        button_h = 60
        button_x1 = width // 2 - button_w // 2
        button_y1 = panel_y2 - 50
        button_x2 = button_x1 + button_w
        button_y2 = button_y1 + button_h

        if button_x1 <= x <= button_x2 and button_y1 <= y <= button_y2:
            self.begin_game()
    
    def bind_controls(self):
        """Bind keyboard controls to frog actions."""
        # Use wrapper handlers so bindings always call the current frog instance
        self.root.bind_all("<Left>", self._on_left)
        self.root.bind_all("<Right>", self._on_right)
        self.root.bind_all("<KeyRelease-Left>", self._on_left_release)
        self.root.bind_all("<KeyRelease-Right>", self._on_right_release)
        self.root.bind_all("<r>", self._on_restart)
        self.root.bind_all("<R>", self._on_restart)
        self.root.bind_all("<F11>", self._on_toggle_fullscreen)
        self.root.bind_all("<Escape>", self._on_exit_fullscreen)

    # Wrapper input handlers that forward to the current frog instance
    def _on_left(self, event=None):
        if hasattr(self, 'frog') and self.frog:
            self.frog.move_left(event)

    def _on_right(self, event=None):
        if hasattr(self, 'frog') and self.frog:
            self.frog.move_right(event)

    def _on_left_release(self, event=None):
        if hasattr(self, 'frog') and self.frog:
            self.frog.stop(event)

    def _on_right_release(self, event=None):
        if hasattr(self, 'frog') and self.frog:
            self.frog.stop(event)

    def _on_restart(self, event=None):
        self.restart(event)

    def _on_toggle_fullscreen(self, event=None):
        self.toggle_fullscreen()

    def _on_exit_fullscreen(self, event=None):
        if self.is_fullscreen:
            self.toggle_fullscreen(False)

    def toggle_fullscreen(self, enabled=None):
        """Toggle fullscreen mode on or off."""
        if enabled is None:
            enabled = not self.is_fullscreen
        self.is_fullscreen = bool(enabled)
        try:
            self.root.attributes("-fullscreen", self.is_fullscreen)
        except tk.TclError:
            if self.is_fullscreen:
                self.root.state("zoomed")

        # Force geometry update and query actual sizes so canvas truly fills the screen.
        self.root.update_idletasks()
        if self.is_fullscreen:
            # Use current monitor/screen dimensions
            width = self.root.winfo_screenwidth()
            height = self.root.winfo_screenheight()
            self.screen_width = width
            self.screen_height = height
            self.canvas.configure(width=width, height=height)
            self.canvas.place(x=0, y=0, width=width, height=height)
            # Rebuild world to match new canvas size
            self._rebuild_world()
        else:
            # Use actual window size (restore) and update stored window size
            width = max(960, self.root.winfo_width())
            height = max(600, self.root.winfo_height())
            self.window_width = width
            self.window_height = height
            try:
                self.root.geometry(f"{width}x{height}")
            except Exception:
                pass
            self.canvas.configure(width=width, height=height)
            self.canvas.place(x=0, y=0, width=width, height=height)
            # Rebuild world to match restored window size
            self._rebuild_world()

        # Redraw whichever screen is currently visible so it matches the new size.
        if self.on_home_screen:
            self.draw_home_screen()
        else:
            self.draw_scene()

    def begin_game(self):
        """Transition from the home screen into live gameplay."""
        if self.on_home_screen:
            self.on_home_screen = False
            self.on_select_screen = True
            self.draw_catcher_select_screen()
            return

        self.on_select_screen = False
        self.canvas.delete("home")
        self.canvas.delete("select")
        self.canvas.delete("gameover")
        if self.is_fullscreen:
            width, height = self.screen_width, self.screen_height
        else:
            # Maximize the window when entering gameplay for a larger view
            try:
                self.root.state("zoomed")
                self.root.update_idletasks()
                width = self.root.winfo_width()
                height = self.root.winfo_height()
                self.window_width = width
                self.window_height = height
            except Exception:
                width, height = GameConfig.WIDTH, GameConfig.HEIGHT
        self.canvas.configure(width=width, height=height)
        self.canvas.place(x=0, y=0, width=width, height=height)
        # Enter fullscreen for gameplay and draw scene (will rebuild world inside toggle)
        try:
            self.toggle_fullscreen(True)
        except Exception:
            pass
        self.draw_scene()
        self.start_game()

    def _rebuild_world(self):
        """Create a fresh cloud world and matching platform objects sized to the canvas."""
        # Clear previous platform and frog visuals
        try:
            self.canvas.delete("platform")
            self.canvas.delete("frog")
        except Exception:
            pass

        # Determine current display size and compute ground Y so ground remains a fixed distance from bottom
        width, height = self._display_size()
        bottom_gap = GameConfig.HEIGHT - GameConfig.GROUND_Y  # default distance from bottom to ground
        ground_y = max(80, height - bottom_gap)

        # Recreate cloud graph sized to current canvas
        self.cloud_graph = CloudGraph(
            width,
            ground_y,
            rows=GameConfig.NUM_CLOUD_ROWS,
            columns=GameConfig.NUM_CLOUD_COLUMNS,
            row_gap=GameConfig.CLOUD_ROW_GAP,
            jump_range=GameConfig.CLOUD_JUMP_RANGE,
        )
        self.sequence_generator = IDSSequenceGenerator(self.cloud_graph)

        # Create frog tied to new cloud graph
        self.frog = Frog(self.canvas, self.cloud_graph)

        # Create platform visuals for all nodes
        self.cloud_platforms = []
        for i, cloud_pos in enumerate(self.cloud_graph.nodes):
            platform = CloudPlatform(self.canvas, cloud_pos[0], cloud_pos[1], i, self.cloud_graph.get_row(i))
            self.cloud_platforms.append(platform)
    
    def start_game(self):
        """Initialize a new game session."""
        # Record new game start
        self.analytics.new_game()
        
        # Reset game state
        self.obstacles_dodged = 0
        self.game_over = False
        self.frog.reset()
        self.last_hazard_spawn = 0.0
        
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

        # Camera: if the frog rises above a threshold, move the world down
        camera_threshold = 180
        if self.frog.y < camera_threshold:
            dy = camera_threshold - self.frog.y

            # Keep sky/gradient fixed to the viewport (no full-background moves)
            # If you want parallax, move background by a fraction of dy here.

            # Move all cloud platforms and update their stored positions
            # Move ground with the world so it disappears as frog climbs
            try:
                self.canvas.move("ground", 0, dy)
            except Exception:
                pass
            for cloud in self.cloud_platforms:
                cloud.y += dy
                self.canvas.move(cloud.id, 0, dy)
                self.canvas.move(cloud.label, 0, dy)

            # Move obstacles (falling stars) and update their stored positions
            for obstacle in self.obstacles:
                obstacle.y += dy
                self.canvas.move(obstacle.id, 0, dy)

            # Shift AI graph node positions so future spawns align with visuals
            for idx, (nx, ny) in enumerate(self.cloud_graph.nodes):
                self.cloud_graph.nodes[idx] = (nx, ny + dy)

            # Keep frog at camera threshold
            self.frog.y = camera_threshold

        # Keep the world continuous by extending clouds upward as needed.
        self._ensure_cloud_continuity()

        # Spawn obstacles from IDS-generated sequence
        self._spawn_obstacles_from_sequence()

        # Continuous spawner: ensure a stream of falling stars
        self._continuous_hazard_spawner(dt)

        # Stars get faster as the frog climbs higher.
        speed_boost = self.frog.current_cloud_row * 0.18
        
        # Update all obstacles and check collisions
        remaining_obstacles = []
        for obstacle in self.obstacles:
            obstacle.update(speed_boost)
            
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
            

                # Do NOT move the full background tag; keep sky/gradient fixed to the viewport
                # (moving the background causes uncovered areas at the top when scrolling).
                # If a parallax effect is desired, move background by a fraction of dy.
                self.canvas.move("background", 0, dy)
        self.best_score = max(self.best_score, self.obstacles_dodged)

        # Draw UI
        self.update_ui()
        
        # Schedule next frame
        self.root.after(16, self.loop)
    
    def _spawn_obstacles_from_sequence(self):
        """
        Spawn hazards from the IDS-generated sequence based on timing.
        IDS builds the route, DLS finds the bounded ascent, and BFS validated it.
        """
        if not self.sequence:
            return
        
        for i, (cloud_id, spawn_time, speed) in enumerate(self.sequence["hazards"]):
            # Check if it's time to spawn this obstacle
            if spawn_time <= self.sequence_time:
                # Check if obstacle already spawned
                if i not in self._spawned_obstacles:
                    # Spawn obstacle at cloud position
                    cloud_x, _ = self.cloud_graph.get_node_position(cloud_id)
                    obstacle = FallingObstacle(self.canvas, cloud_x, speed=speed)
                    self.obstacles.append(obstacle)
                    self._spawned_obstacles.add(i)

    def _continuous_hazard_spawner(self, dt):
        """Spawn additional hazards continuously, rate increases with frog height."""
        # Increase spawn rate with height (higher row -> faster spawns)
        frog_row = getattr(self.frog, 'current_cloud_row', 0)
        # interval shrinks as frog climbs, but keep a minimum interval
        interval = max(0.35, self.hazard_spawn_interval - frog_row * 0.12)
        self.last_hazard_spawn += dt

        # If there are fewer than a few hazards, spawn more; also time-based spawn
        want_min_active = 2
        if len(self.obstacles) < want_min_active or self.last_hazard_spawn >= interval:
            # choose a cloud to drop from: prefer clouds ahead of the frog (same or above row)
            # Choose clouds at or above the frog's current row (spawn from above)
            candidates = [i for i in range(len(self.cloud_graph.nodes)) if self.cloud_graph.get_row(i) >= getattr(self.frog, 'current_cloud_row', 0)]
            if candidates:
                # pick random candidate but bias toward columns above frog
                choice = random.choice(candidates)
                cx, cy = self.cloud_graph.get_node_position(choice)
                # speed scales with row
                speed = 3.0 + self.cloud_graph.get_row(choice) * 0.45 + frog_row * 0.08
                obstacle = FallingObstacle(self.canvas, cx, speed=speed)
                self.obstacles.append(obstacle)
            self.last_hazard_spawn = 0.0

    def _ensure_cloud_continuity(self):
        """Add new cloud rows above the visible stack so the climb never runs out."""
        if not self.cloud_platforms:
            return

        top_threshold = 120
        current_top = min(cloud.y for cloud in self.cloud_platforms)

        while current_top > top_threshold:
            before_count = len(self.cloud_graph.nodes)
            self.cloud_graph.add_rows_above(1)

            # Create platform visuals for only the newly added nodes.
            for node_id in range(before_count, len(self.cloud_graph.nodes)):
                cloud_x, cloud_y = self.cloud_graph.get_node_position(node_id)
                platform = CloudPlatform(
                    self.canvas,
                    cloud_x,
                    cloud_y,
                    node_id,
                    self.cloud_graph.get_row(node_id)
                )
                self.cloud_platforms.append(platform)

            current_top = min(cloud.y for cloud in self.cloud_platforms)
    
    def update_ui(self):
        """Draw HUD showing score, best score, and controls."""
        self.canvas.delete("ui")

        width, height = self._display_size()

        # Altitude HUD (small rounded box with triangle icon)
        box_x1 = 12
        box_y1 = 12
        box_w = 110
        box_h = 36
        self._draw_home_rounded_rect(box_x1, box_y1, box_x1 + box_w, box_y1 + box_h, 8, fill="#6d7780", outline="", width=0, tag="ui")

        # Triangle indicator (simple white chevron/up-triangle)
        tri_cx = box_x1 + 20
        tri_cy = box_y1 + box_h // 2
        self.canvas.create_polygon(
            tri_cx, tri_cy - 8,
            tri_cx - 10, tri_cy + 6,
            tri_cx + 10, tri_cy + 6,
            fill="#ffffff", outline="", tags="ui"
        )

        # Altitude text: compute from frog row (approximate meters)
        altitude = 0
        if hasattr(self, 'frog') and getattr(self.frog, 'current_cloud_row', None) is not None:
            altitude = max(0, int(self.frog.current_cloud_row * 10))
        self.canvas.create_text(
            box_x1 + 40, box_y1 + box_h // 2,
            text=f"{altitude}m",
            font=("Arial", 12, "bold"), fill="#ffffff", anchor="w", tags="ui"
        )

        # Small score indicator at top-right
        self.canvas.create_text(
            width - 12, 12 + 6,
            text=f"★ {self.obstacles_dodged}", font=("Arial", 12, "bold"), fill="#ffffff", anchor="ne", tags="ui"
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
        self._rebuild_world()
        self.obstacles = []
        self._spawned_obstacles = set()
        self.on_home_screen = False

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
