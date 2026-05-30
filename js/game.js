function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.arcTo(x + width, y, x + width, y + height, corner);
  ctx.arcTo(x + width, y + height, x, y + height, corner);
  ctx.arcTo(x, y + height, x, y, corner);
  ctx.arcTo(x, y, x + width, y, corner);
  ctx.closePath();
}

class Frog {
  constructor(canvas, cloudGraph, avatarType = "frog") {
    this.canvas = canvas;
    this.cloudGraph = cloudGraph;
    this.x = cloudGraph.nodes[0][0];
    this.y = cloudGraph.nodes[0][1];
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.currentCloud = 0;
    this.currentCloudRow = 0;
    this.avatarType = avatarType;
    this.starShieldTimer = 0;
    this.jumpBoostReady = false;
    this.jumpBoostFlightActive = false;
  }

  reset() {
    this.x = this.cloudGraph.nodes[0][0];
    this.y = this.cloudGraph.nodes[0][1];
    this.vx = 0;
    this.vy = -14;
    this.onGround = false;
    this.currentCloud = 0;
    this.currentCloudRow = 0;
    this.starShieldTimer = 0;
    this.jumpBoostReady = false;
    this.jumpBoostFlightActive = false;
  }

  moveLeft() {
    this.vx = -6;
  }

  moveRight() {
    this.vx = 6;
  }

  stop() {
    this.vx = 0;
  }

  setAvatar(avatarType) {
    this.avatarType = avatarType;
  }

  jump() {
    return;
  }

  update(cloudPlatforms, width, height, dt = 0.016) {
    this.starShieldTimer = Math.max(0, this.starShieldTimer - dt);

    this.x += this.vx;
    this.x = clamp(this.x, GameConfig.PLAYER_W / 2, width - GameConfig.PLAYER_W / 2);

    this.vy += 0.8;
    this.y += this.vy;

    const supportCloud = cloudPlatforms[this.currentCloud];
    if (
      supportCloud &&
      !supportCloud.isSolid() &&
      this.vy >= 0 &&
      Math.abs(this.x - supportCloud.x) < 56 &&
      Math.abs(this.y - supportCloud.y) < 72
    ) {
      return false;
    }

    let landingOnCloud = false;
    for (let index = 0; index < cloudPlatforms.length; index += 1) {
      const cloud = cloudPlatforms[index];
      if (!cloud.isSolid()) {
        continue;
      }

      if (
        Math.abs(this.x - cloud.x) < 50 &&
        this.vy > 0 &&
        Math.abs(this.y - cloud.y) < 40 &&
        (
          this.jumpBoostFlightActive ||
          cloud.row === this.currentCloudRow ||
          cloud.row === this.currentCloudRow + 1
        )
      ) {
        this.y = cloud.y - 40;
        this.vy = this.jumpBoostReady ? -40 : -14;
        this.jumpBoostReady = false;
        if (this.jumpBoostFlightActive) {
          this.jumpBoostFlightActive = false;
        }
        this.onGround = false;
        this.currentCloud = index;
        this.currentCloudRow = cloud.row;
        cloud.touch();
        const pickup = cloud.collectPickup();
        if (pickup === "umbrella") {
          this.starShieldTimer = 8;
        } else if (pickup === "magic") {
          this.jumpBoostReady = true;
          this.jumpBoostFlightActive = true;
        }
        landingOnCloud = true;
        break;
      }

      this.onGround = landingOnCloud && this.vy < 0;
    }

    if (this.y >= height) {
      return false;
    }

    return true;
  }

  draw(ctx, cameraOffsetY = 0) {
    this.drawAt(ctx, this.x, this.y + cameraOffsetY);
  }

  drawAt(ctx, x, y) {
    if (this.avatarType === "rabbit") {
      this._drawRabbit(ctx, x, y);
    } else if (this.avatarType === "cat") {
      this._drawCat(ctx, x, y);
    } else {
      this._drawFrog(ctx, x, y);
    }

    if (this.starShieldTimer > 0) {
      this._drawUmbrellaShield(ctx, x, y);
    }
  }

  _drawUmbrellaShield(ctx, x, y) {
    ctx.save();
    const bob = Math.sin(Date.now() / 180) * 1.2;
    const topY = y - 30 + bob;

    // handle
    ctx.strokeStyle = "#5c2a86";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, topY + 6);
    ctx.lineTo(x, topY + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, topY + 26, 5, Math.PI * 1.15, Math.PI * 0.15, false);
    ctx.stroke();

    // canopy
    const canopy = ctx.createLinearGradient(x - 20, topY - 10, x + 20, topY + 8);
    canopy.addColorStop(0, "#b17cff");
    canopy.addColorStop(0.55, "#8c3cf0");
    canopy.addColorStop(1, "#5f1eb0");
    ctx.fillStyle = canopy;
    ctx.strokeStyle = "#4c178f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 22, topY + 6);
    ctx.quadraticCurveTo(x - 14, topY - 16, x, topY - 16);
    ctx.quadraticCurveTo(x + 14, topY - 16, x + 22, topY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, topY - 15);
    ctx.lineTo(x, topY + 5);
    ctx.stroke();
    ctx.restore();
  }

  _drawFrog(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "#2fa86a";
    ctx.fillStyle = "#5fd08a";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(x, y - 1, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x - 7, y - 9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 9, y - 9, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1f6b3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 2, 8, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();
  }

  _drawRabbit(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "#f2b5d3";
    ctx.fillStyle = "#fff5fb";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(x, y + 1, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffd0e5";
    ctx.strokeStyle = "#f2a7c6";
    ctx.beginPath();
    roundRectPath(ctx, x - 9, y - 27, 7, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    roundRectPath(ctx, x + 2, y - 27, 7, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.strokeStyle = "#d08bb0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#5d3246";
    ctx.beginPath();
    ctx.arc(x - 6, y - 9, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 9, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#cb8ca8";
    ctx.beginPath();
    ctx.arc(x, y + 1, 6, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();
  }

  _drawCat(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "#e18a3e";
    ctx.fillStyle = "#ffbf62";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(x, y + 1, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffc97d";
    ctx.strokeStyle = "#d67722";
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 16);
    ctx.lineTo(x - 4, y - 28);
    ctx.lineTo(x - 1, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 16);
    ctx.lineTo(x + 4, y - 28);
    ctx.lineTo(x + 1, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.strokeStyle = "#b86d28";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 10, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#3a2017";
    ctx.beginPath();
    ctx.arc(x - 7, y - 9, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 9, y - 9, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#7d4a22";
    ctx.beginPath();
    ctx.arc(x, y + 2, 6, 0, Math.PI, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 1);
    ctx.lineTo(x - 19, y - 1);
    ctx.moveTo(x - 12, y + 4);
    ctx.lineTo(x - 19, y + 5);
    ctx.moveTo(x + 12, y + 1);
    ctx.lineTo(x + 19, y - 1);
    ctx.moveTo(x + 12, y + 4);
    ctx.lineTo(x + 19, y + 5);
    ctx.stroke();
    ctx.restore();
  }
}

class CloudPlatform {
  constructor(x, y, cloudId, row, groundY) {
    this.x = x;
    this.y = y;
    this.cloudId = cloudId;
    this.row = row;
    this._groundY = groundY;
    this.disappearTimer = null;
    this.disappearDelay = Math.min(5.0, Math.max(1.2, 2.6 - row * 0.18));
    this.pickupType = this._rollPickupType();
    this.pickupCollected = false;
    this.pickupPhase = Math.random() * Math.PI * 2;
  }

  _rollPickupType() {
    const roll = Math.random();
    if (roll < 0.02) {
      return "umbrella";
    }
    if (roll < 0.03) {
      return "magic";
    }
    return null;
  }

  touch() {
    if (this.disappearTimer === null) {
      this.disappearTimer = this.disappearDelay;
    }
  }

  update(dt) {
    if (this.disappearTimer !== null) {
      this.disappearTimer -= dt;
    }
  }

  isSolid() {
    return this.disappearTimer === null || this.disappearTimer > 0;
  }

  isVisible() {
    return this.disappearTimer === null || this.disappearTimer > -0.5;
  }

  collectPickup() {
    if (!this.pickupType || this.pickupCollected) {
      return null;
    }

    this.pickupCollected = true;
    return this.pickupType;
  }

  draw(ctx, cameraOffsetY = 0) {
    if (!this.isVisible()) {
      return;
    }

    ctx.save();
    const alpha = this.disappearTimer === null ? 1 : Math.max(0, Math.min(1, this.disappearTimer / this.disappearDelay));
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    const drawY = this.y + cameraOffsetY;

    // keep platform clouds above the visible ground line
    if (drawY + 20 >= this._groundY + cameraOffsetY) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.ellipse(this.x - 22, drawY + 3, 22, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(this.x, drawY - 2, 26, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(this.x + 24, drawY + 4, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.pickupType && !this.pickupCollected) {
      const floatY = drawY - 24 + Math.sin(Date.now() / 250 + this.pickupPhase) * 4;
      ctx.save();
      ctx.globalAlpha = Math.max(0.75, alpha);
      if (this.pickupType === "umbrella") {
          // purple umbrella pickup
          ctx.strokeStyle = "#4b1e8f";
          ctx.fillStyle = "#8f4de3";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x, floatY, 11, Math.PI, 0, false);
          ctx.lineTo(this.x + 11, floatY);
          ctx.lineTo(this.x, floatY + 10);
          ctx.lineTo(this.x - 11, floatY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.beginPath();
          ctx.arc(this.x - 4, floatY - 5, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#5a2a86";
          ctx.beginPath();
          ctx.moveTo(this.x, floatY + 10);
          ctx.lineTo(this.x, floatY + 19);
          ctx.stroke();
      } else if (this.pickupType === "magic") {
          // glass jar with cloud inside
          ctx.save();
          ctx.shadowColor = "rgba(140, 220, 255, 0.38)";
          ctx.shadowBlur = 12;
          const jarTop = floatY - 18;
          const jarBottom = floatY + 16;
          ctx.fillStyle = "rgba(214, 245, 255, 0.26)";
          ctx.strokeStyle = "#7ab7d6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.x - 13, jarTop);
          ctx.lineTo(this.x + 13, jarTop);
          ctx.lineTo(this.x + 11, jarBottom - 2);
          ctx.quadraticCurveTo(this.x, jarBottom + 4, this.x - 11, jarBottom - 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#c9d7e0";
          ctx.fillRect(this.x - 14, jarTop - 5, 28, 6);
          ctx.fillStyle = "#e8f2f7";
          ctx.fillRect(this.x - 9, jarTop - 10, 18, 5);
          ctx.shadowBlur = 0;
          const cloudGlow = ctx.createRadialGradient(this.x, floatY + 1, 2, this.x, floatY + 1, 12);
          cloudGlow.addColorStop(0, "rgba(255,255,255,0.95)");
          cloudGlow.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = cloudGlow;
          ctx.beginPath();
          ctx.arc(this.x, floatY + 2, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.ellipse(this.x - 5, floatY + 2, 5, 3.5, 0, 0, Math.PI * 2);
          ctx.ellipse(this.x + 2, floatY, 6, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(this.x + 8, floatY + 3, 4.5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

class FallingObstacle {
  constructor(xPos, speed = 4.0) {
    this.x = xPos;
    this.y = -30;
    this.speed = speed;
  }

  update(speedBoost = 0) {
    this.y += this.speed + speedBoost;
  }

  offScreen(height, cameraOffsetY = 0) {
    return this.y + cameraOffsetY > height + 50;
  }

  collidesWith(frog) {
    const dx = Math.abs(this.x - frog.x);
    const dy = Math.abs(this.y - frog.y);
    return dx < 25 && dy < 30;
  }

  draw(ctx, cameraOffsetY = 0) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 84, 0.85)";
    ctx.shadowBlur = 18;
    const drawY = this.y + cameraOffsetY;
    const glow = ctx.createRadialGradient(this.x, drawY + 6, 6, this.x, drawY + 6, 28);
    glow.addColorStop(0, "rgba(255, 247, 168, 0.95)");
    glow.addColorStop(0.45, "rgba(255, 208, 66, 0.6)");
    glow.addColorStop(1, "rgba(255, 208, 66, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, drawY + 6, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffcf3f";
    ctx.strokeStyle = "#f29a00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, drawY - 18);
    ctx.lineTo(this.x + 7, drawY - 2);
    ctx.lineTo(this.x + 24, drawY - 2);
    ctx.lineTo(this.x + 11, drawY + 9);
    ctx.lineTo(this.x + 16, drawY + 26);
    ctx.lineTo(this.x, drawY + 16);
    ctx.lineTo(this.x - 16, drawY + 26);
    ctx.lineTo(this.x - 11, drawY + 9);
    ctx.lineTo(this.x - 24, drawY - 2);
    ctx.lineTo(this.x - 7, drawY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

class CloudCatcherGame {
  constructor(canvas, controls = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;

    this.root = document.documentElement;
    this.isFullscreen = false;
    this.lastFrameTime = 0;
    this.messageTimer = null;
    this.pendingMessage = "";
    this.gameOverText = "";
    this.pointerDragging = false;
    this.pointerX = 0;

    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    this.windowWidth = canvas.clientWidth || 1280;
    this.windowHeight = canvas.clientHeight || 720;

    this.dataLayer = new DataLayer();
    this.analytics = new AnalyticsService();
    this.achievements = new AchievementService();
    this.savedData = this.dataLayer.load();
    this.bestScore = this.savedData.best_score;

    this.onHomeScreen = true;
    this.onSelectScreen = false;
    this.gameOver = false;
    this.selectedCatcher = 0;
    this.selectedAvatarType = "frog";
    this.selectCardBounds = [];
    this.homeStartButtonBounds = null;
    this.obstacles = [];
    this.cloudPlatforms = [];
    this.obstaclesDodged = 0;
    this.altitudeScore = 0;
    this.sequence = null;
    this.sequenceTime = 0;
    this.lastHazardSpawn = 0;
    this.hazardSpawnInterval = 1.6;
    this.spawnedObstacles = new Set();
    this.previewFrames = 0;
    // dev helper: force an altitude for previewing atmosphere stages (null = off)
    this.debugForceAltitude = null;
    this.cameraOffsetY = 0;
    this.sceneGroundY = 0;

    this._bindControls();
    this._installResizeListeners();
    this._rebuildWorld();
    this.drawHomeScreen();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _bindControls() {
    this.canvas.addEventListener("click", (event) => this._handleCanvasClick(event));
    this.canvas.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    window.addEventListener("pointermove", (event) => this._onPointerMove(event));
    window.addEventListener("pointerup", () => this._onPointerUp());
    window.addEventListener("pointercancel", () => this._onPointerUp());
    window.addEventListener("keydown", (event) => this._onKeyDown(event));
    window.addEventListener("keyup", (event) => this._onKeyUp(event));
    window.addEventListener("beforeunload", () => this.onClose());

    if (this.controls.fullscreenButton) {
      this.controls.fullscreenButton.addEventListener("click", () => this.toggleFullscreen());
    }

    if (this.controls.restartButton) {
      this.controls.restartButton.addEventListener("click", () => this.restart());
    }
  }

  _installResizeListeners() {
    window.addEventListener("resize", () => this._handleResize());
    document.addEventListener("fullscreenchange", () => {
      this.isFullscreen = Boolean(document.fullscreenElement);
      this._handleResize();
    });
  }

  _handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 1230));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 712));

    if (this.isFullscreen) {
      this.screenWidth = window.innerWidth;
      this.screenHeight = window.innerHeight;
    } else {
      this.windowWidth = width;
      this.windowHeight = height;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.onHomeScreen) {
      this.drawHomeScreen();
      return;
    }

    if (this.onSelectScreen) {
      this.drawSelectScreen();
      return;
    }

    this._rebuildWorld();
    this.drawScene();
  }

  _getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height ? this.canvas.height / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  _displaySize() {
    return [this.canvas.width || 1230, this.canvas.height || 712];
  }

  _rebuildWorld() {
    const [width, height] = this._displaySize();
    const groundY = Math.max(height - 56, Math.floor(height * 0.92));
    this.sceneGroundY = groundY;

    this.cloudGraph = new CloudGraph(
      width,
      groundY,
      GameConfig.NUM_CLOUD_ROWS,
      GameConfig.NUM_CLOUD_COLUMNS,
      GameConfig.CLOUD_ROW_GAP,
      GameConfig.CLOUD_JUMP_RANGE,
    );
    this.sequenceGenerator = new IDSSequenceGenerator(this.cloudGraph);
    this.frog = new Frog(this.canvas, this.cloudGraph, this.selectedAvatarType);
    this.cloudPlatforms = this.cloudGraph.nodes.map((cloudPos, index) => new CloudPlatform(cloudPos[0], cloudPos[1], index, this.cloudGraph.getRow(index), groundY));
    // prepare deterministic ground decoration positions so they don't jitter
    const decorCount = 18;
    this._groundDecorPositions = [];
    for (let i = 0; i < decorCount; i += 1) {
      // distribute across width with small deterministic offsets
      const fx = 0.06 + (i / (decorCount - 1)) * 0.88; // fraction across width
      // vertical offset above ground (pixels)
      const vy = 6 + ((i * 37) % 12); // deterministic pseudo-random
      const colorIndex = i % 4;
      this._groundDecorPositions.push({ fx, vy, colorIndex });
    }
  }

  _getHeroRoster() {
    return [
      {
        avatarType: "frog",
        name: "Ribbit",
        tagline: "Springy hopper",
        emoji: "🐸",
        face: "#67e57b",
        glowInner: "rgba(229, 255, 160, 0.95)",
        glowMid: "rgba(100, 236, 119, 0.76)",
        glowOuter: "rgba(47, 163, 75, 0.42)",
        shadow: "rgba(88, 255, 121, 0.6)",
      },
      {
        avatarType: "rabbit",
        name: "Mochi",
        tagline: "Soft & swift",
        emoji: "🐰",
        face: "#ffd7eb",
        glowInner: "rgba(255, 255, 255, 0.92)",
        glowMid: "rgba(248, 154, 208, 0.78)",
        glowOuter: "rgba(201, 117, 181, 0.4)",
        shadow: "rgba(255, 166, 220, 0.6)",
      },
      {
        avatarType: "cat",
        name: "Nova",
        tagline: "Curious climber",
        emoji: "🐱",
        face: "#ffd46d",
        glowInner: "rgba(255, 241, 179, 0.92)",
        glowMid: "rgba(255, 161, 72, 0.8)",
        glowOuter: "rgba(191, 104, 46, 0.42)",
        shadow: "rgba(255, 180, 92, 0.68)",
      },
    ];
  }

  _getSelectedAvatarType() {
    return this._getHeroRoster()[this.selectedCatcher]?.avatarType || "frog";
  }

  _setHomeShellState(isHomeScreen) {
    if (document && document.body) {
      document.body.classList.toggle("home-screen", Boolean(isHomeScreen));
    }
  }

  _setSelectShellState(isSelectScreen) {
    if (document && document.body) {
      document.body.classList.toggle("select-screen", Boolean(isSelectScreen));
    }
  }

  _setGameShellState(isGameScreen) {
    if (document && document.body) {
      document.body.classList.toggle("game-screen", Boolean(isGameScreen));
    }
  }

  _drawRoundedRect(x1, y1, x2, y2, radius, fill, stroke = "", lineWidth = 1) {
    const width = x2 - x1;
    const height = y2 - y1;
    roundRectPath(this.ctx, x1, y1, width, height, radius);
    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  _drawHomeGradientCard(x1, y1, x2, y2) {
    const gradientColors = HOME_THEME.card_fill_top;
    const height = y2 - y1;
    const stripeHeight = Math.max(1, Math.floor(height / gradientColors.length));
    let currentY = y1;

    for (const color of gradientColors) {
      const nextY = Math.min(y2, currentY + stripeHeight);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x1, currentY, x2 - x1, nextY - currentY);
      currentY = nextY;
    }

    if (currentY < y2) {
      this.ctx.fillStyle = gradientColors[gradientColors.length - 1];
      this.ctx.fillRect(x1, currentY, x2 - x1, y2 - currentY);
    }
  }

  _drawHomeCloud(x, y, scale) {
    const radiusX = Math.round(30 * scale);
    const radiusY = Math.round(18 * scale);
    const color = HOME_THEME.cloud;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x + radiusX, y + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.ellipse(x + Math.round(25 * scale) + radiusX, y - Math.round(12 * scale) + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.ellipse(x + Math.round(50 * scale) + radiusX, y + Math.round(6 * scale) + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  _drawLandingBackdrop(width, height) {
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, "#09172f");
    skyGradient.addColorStop(0.42, "#25134b");
    skyGradient.addColorStop(0.72, "#4f2388");
    skyGradient.addColorStop(1, "#257fd6");
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, width, height);

    const softGlow = this.ctx.createRadialGradient(width * 0.5, height * 0.4, 40, width * 0.5, height * 0.4, Math.max(width, height) * 0.72);
    softGlow.addColorStop(0, "rgba(174, 73, 255, 0.3)");
    softGlow.addColorStop(0.6, "rgba(89, 51, 192, 0.09)");
    softGlow.addColorStop(1, "rgba(89, 51, 192, 0)");
    this.ctx.fillStyle = softGlow;
    this.ctx.fillRect(0, 0, width, height);

    const planetCx = width * 0.945;
    const planetCy = height * 0.075;
    const planetGradient = this.ctx.createRadialGradient(planetCx - 50, planetCy - 20, 20, planetCx, planetCy, Math.max(width, height) * 0.24);
    planetGradient.addColorStop(0, "#ffcb58");
    planetGradient.addColorStop(0.38, "#ff9d43");
    planetGradient.addColorStop(0.78, "#dc4936");
    planetGradient.addColorStop(1, "rgba(220, 73, 54, 0)");
    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 151, 69, 0.24)";
    this.ctx.shadowBlur = 40;
    this.ctx.fillStyle = planetGradient;
    this.ctx.beginPath();
    this.ctx.arc(planetCx, planetCy, Math.max(120, Math.min(width, height) * 0.22), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    const starFields = [
      [0.02, 0.06, 1.2], [0.06, 0.18, 1.8], [0.10, 0.12, 1.3], [0.13, 0.34, 1.1],
      [0.17, 0.07, 1.6], [0.20, 0.24, 1.0], [0.25, 0.38, 1.4], [0.28, 0.10, 1.1],
      [0.32, 0.28, 1.6], [0.36, 0.15, 1.1], [0.40, 0.33, 1.4], [0.44, 0.08, 1.2],
      [0.49, 0.17, 1.3], [0.53, 0.29, 1.1], [0.58, 0.11, 1.7], [0.63, 0.24, 1.0],
      [0.67, 0.08, 1.2], [0.71, 0.32, 1.5], [0.76, 0.15, 1.1], [0.81, 0.27, 1.7],
      [0.86, 0.10, 1.0], [0.90, 0.23, 1.4], [0.95, 0.16, 1.1], [0.98, 0.05, 1.5],
      [0.11, 0.72, 1.1], [0.24, 0.81, 1.3], [0.41, 0.77, 1.0], [0.64, 0.87, 1.4],
      [0.78, 0.77, 1.2], [0.92, 0.84, 1.1],
    ];

    this.ctx.fillStyle = "rgba(255, 231, 145, 0.95)";
    for (const [sx, sy, size] of starFields) {
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.save();
    this.ctx.translate(width * 0.03, height * 0.2);
    this.ctx.rotate(-0.18);
    const sweep = this.ctx.createLinearGradient(0, 0, width * 0.22, height * 0.08);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.45, "rgba(255,255,255,0.38)");
    sweep.addColorStop(1, "rgba(255,235,171,0.9)");
    this.ctx.strokeStyle = sweep;
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(width * 0.2, height * 0.09);
    this.ctx.stroke();
    this.ctx.restore();

    this._drawHomeCloud(width * 0.04, height * 0.075, 0.32);

    const horizonGlow = this.ctx.createLinearGradient(0, height * 0.55, 0, height);
    horizonGlow.addColorStop(0, "rgba(58, 128, 224, 0)");
    horizonGlow.addColorStop(1, "rgba(31, 127, 218, 0.45)");
    this.ctx.fillStyle = horizonGlow;
    this.ctx.fillRect(0, 0, width, height);
  }

  _drawKeyHint(x, y, label) {
    const boxWidth = label.length > 2 ? 48 : 40;
    this.ctx.save();
    this._drawRoundedRect(x, y - 16, x + boxWidth, y + 16, 6, "rgba(58, 86, 139, 0.9)", "rgba(255,255,255,0.08)", 1);
    this.ctx.fillStyle = "#dde6f7";
    this.ctx.font = "700 12px Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label, x + boxWidth / 2, y - 1);
    this.ctx.restore();
  }

  _drawLandingIntro(width, height) {
    const leftX = width * 0.024;
    const topY = height * 0.082;

    this.ctx.save();
    this.ctx.fillStyle = "rgba(255,255,255,0.12)";
    this.ctx.beginPath();
    this.ctx.arc(leftX + 20, topY + 10, 20, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#e8eef8";
    this.ctx.font = "700 14px Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("☁", leftX + 22, topY + 12);
    this.ctx.restore();

    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillStyle = "rgba(220, 232, 246, 0.88)";
    this.ctx.font = "700 12px Arial, sans-serif";
    this.ctx.fillText("CLOUD CATCHERS", leftX + 56, topY + 18);

    const headlineX = leftX + 8;
    const headlineY = height * 0.26;
    this.ctx.save();
    this.ctx.font = "900 72px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.lineWidth = 6;
    this.ctx.shadowColor = "rgba(255,255,255,0.18)";
    this.ctx.shadowBlur = 20;
    this.ctx.strokeStyle = "rgba(10, 8, 34, 0.18)";
    this.ctx.fillStyle = "#fbf8ff";
    this.ctx.strokeText("Leap the sky.", headlineX, headlineY);
    this.ctx.fillText("Leap the sky.", headlineX, headlineY);
    this.ctx.restore();

    const gradient = this.ctx.createLinearGradient(headlineX, 0, headlineX + width * 0.43, 0);
    gradient.addColorStop(0, "#ffc14a");
    gradient.addColorStop(0.4, "#f08be7");
    gradient.addColorStop(0.74, "#8ab3ff");
    gradient.addColorStop(1, "#2bd2db");
    this.ctx.save();
    this.ctx.font = "900 72px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = "rgba(10, 8, 34, 0.18)";
    this.ctx.fillStyle = gradient;
    this.ctx.strokeText("Outrun the stars.", headlineX, headlineY + 70);
    this.ctx.fillText("Outrun the stars.", headlineX, headlineY + 70);
    this.ctx.restore();

    this.ctx.fillStyle = "rgba(232, 237, 247, 0.74)";
    this.ctx.font = "400 17px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Bounce from cloud to cloud through atmosphere,", headlineX, height * 0.50);
    this.ctx.fillText("stratosphere, and the deep dark beyond. One slip —", headlineX, height * 0.535);
    this.ctx.fillText("or one falling star — and the journey ends.", headlineX, height * 0.57);

    const buttonX = headlineX;
    const buttonY = height * 0.71;
    const buttonWidth = Math.min(width * 0.19, 250);
    const buttonHeight = 68;
    this.homeStartButtonBounds = [buttonX, buttonY, buttonX + buttonWidth, buttonY + buttonHeight];
    const buttonGradient = this.ctx.createLinearGradient(buttonX, 0, buttonX + buttonWidth, 0);
    buttonGradient.addColorStop(0, "#ef8bec");
    buttonGradient.addColorStop(1, "#f2bf85");
    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 141, 221, 0.35)";
    this.ctx.shadowBlur = 26;
    this._drawRoundedRect(buttonX, buttonY, buttonX + buttonWidth, buttonY + buttonHeight, 999, buttonGradient, "", 0);
    this.ctx.restore();
    this.ctx.fillStyle = "#231536";
    this.ctx.font = "900 19px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("Start Climbing", buttonX + buttonWidth / 2 - 14, buttonY + 41);
    this.ctx.font = "900 20px Arial, sans-serif";
    this.ctx.fillText("→", buttonX + buttonWidth - 24, buttonY + 41);

    const hintY = buttonY + 36;
    this._drawKeyHint(buttonX + buttonWidth + 22, hintY, "← →");
    this.ctx.fillStyle = "rgba(212, 220, 239, 0.7)";
    this.ctx.font = "500 16px 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText("or", buttonX + buttonWidth + 64, hintY + 7);
    this._drawKeyHint(buttonX + buttonWidth + 90, hintY, "A D");
    this.ctx.fillStyle = "rgba(212, 220, 239, 0.7)";
    this.ctx.fillText("to steer", buttonX + buttonWidth + 144, hintY + 7);
  }

  _drawHeroCard(x1, y1, width, height, hero, isSelected) {
    const x2 = x1 + width;
    const y2 = y1 + height;
    const fill = isSelected ? "rgba(115, 126, 196, 0.34)" : "rgba(35, 37, 75, 0.5)";
    const stroke = isSelected ? "rgba(255, 255, 255, 0.18)" : "rgba(123, 131, 188, 0.16)";
    this._drawRoundedRect(x1, y1, x2, y2, 24, fill, stroke, 2);

    const orbCx = x1 + width / 2;
    const orbCy = y1 + 66;
    const orbRadius = 46;
    const orbGradient = this.ctx.createRadialGradient(orbCx - 12, orbCy - 12, 8, orbCx, orbCy, orbRadius + 12);
    orbGradient.addColorStop(0, hero.glowInner);
    orbGradient.addColorStop(0.55, hero.glowMid);
    orbGradient.addColorStop(1, hero.glowOuter);

    this.ctx.save();
    this.ctx.shadowColor = hero.shadow;
    this.ctx.shadowBlur = isSelected ? 28 : 16;
    this.ctx.fillStyle = orbGradient;
    this.ctx.beginPath();
    this.ctx.arc(orbCx, orbCy, orbRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.fillStyle = hero.face;
    this.ctx.font = "42px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(hero.emoji, orbCx, orbCy + 1);

    if (isSelected) {
      this.ctx.save();
      this._drawRoundedRect(x1 + width / 2 - 24, y1 - 12, x1 + width / 2 + 24, y1 + 10, 11, "#ffc91a", "", 0);
      this.ctx.fillStyle = "#251520";
      this.ctx.font = "900 10px Arial, sans-serif";
      this.ctx.fillText("PICKED", x1 + width / 2, y1 + 2);
      this.ctx.restore();
    }

    this.ctx.fillStyle = "#fbf7ff";
    this.ctx.font = "900 16px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText(hero.name, orbCx, y1 + height - 36);
    this.ctx.fillStyle = "rgba(226, 228, 241, 0.74)";
    this.ctx.font = "500 11px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText(hero.tagline, orbCx, y1 + height - 16);
  }

  _drawHeroPanel(width, height, selectedCatcher, panelOptions = {}) {
    const compact = width < 1160;
    const panelW = compact ? Math.min(width * 0.86, 750) : Math.min(width * 0.42, 760);
    const panelH = compact ? Math.min(height * 0.58, 410) : Math.min(height * 0.63, 470);
    const panelX1 = compact ? Math.floor(width * 0.07) : Math.floor(width - panelW - width * 0.03);
    const panelY1 = compact ? Math.floor(height * 0.22) : Math.floor(height * 0.18);
    const panelX2 = Math.floor(panelX1 + panelW);
    const panelY2 = Math.floor(panelY1 + panelH);

    this._drawRoundedRect(panelX1, panelY1, panelX2, panelY2, 30, "rgba(27, 33, 71, 0.54)", "rgba(255,255,255,0.16)", 1.5);

    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillStyle = "#f5f3fb";
    this.ctx.font = "900 22px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Choose your catcher", panelX1 + 28, panelY1 + 46);

    this.ctx.fillStyle = "rgba(216, 224, 240, 0.72)";
    this.ctx.font = "500 12px 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "right";
    this.ctx.fillText("3 HEROES", panelX2 - 26, panelY1 + 43);

    const cardGap = compact ? 14 : 12;
    const cardY1 = panelY1 + 68;
    const cardH = compact ? Math.min(150, panelH * 0.43) : Math.min(165, panelH * 0.43);
    const cardW = Math.floor((panelW - 56 - cardGap * 2) / 3);
    const cardsX1 = panelX1 + 28;
    this.selectCardBounds = [];

    const heroes = this._getHeroRoster();

    heroes.forEach((hero, index) => {
      const x1 = cardsX1 + index * (cardW + cardGap);
      this.selectCardBounds.push([x1, cardY1, x1 + cardW, cardY1 + cardH]);
      this._drawHeroCard(x1, cardY1, cardW, cardH, hero, index === selectedCatcher);
    });

    const warningY1 = panelY2 - 74;
    this._drawRoundedRect(panelX1 + 20, warningY1, panelX2 - 20, panelY2 - 18, 20, "rgba(25, 55, 110, 0.92)", "rgba(255,255,255,0.06)", 1);
    this.ctx.fillStyle = "#ffbf59";
    this.ctx.font = "900 18px Arial, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText("⚠", panelX1 + 40, warningY1 + 28);
    this.ctx.fillStyle = "rgba(225, 232, 241, 0.82)";
    this.ctx.font = "500 12px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Every hero shares one nemesis: falling stars.", panelX1 + 74, warningY1 + 28);
    if (panelOptions.showStartButton) {
      const buttonW = panelW - 44;
      const buttonH = 56;
      const buttonX1 = panelX1 + 22;
      const buttonY1 = panelY1 + panelH + 18;
      const buttonX2 = buttonX1 + buttonW;
      const buttonY2 = buttonY1 + buttonH;
      this.selectButtonBounds = [buttonX1, buttonY1, buttonX2, buttonY2];
      const buttonGradient = this.ctx.createLinearGradient(buttonX1, 0, buttonX2, 0);
      buttonGradient.addColorStop(0, "#71e0f8");
      buttonGradient.addColorStop(1, "#ffe17c");
      this._drawRoundedRect(buttonX1, buttonY1, buttonX2, buttonY2, 18, buttonGradient, "", 0);
      this.ctx.fillStyle = "#21183c";
      this.ctx.font = "900 15px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("Start climbing →", panelX1 + panelW / 2, buttonY1 + 35);
    } else {
      this.selectButtonBounds = null;
    }
  }

  _drawLandingFooter(width, height) {
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillStyle = "rgba(223, 229, 241, 0.7)";
    this.ctx.font = "500 13px 'Segoe UI', Arial, sans-serif";
    const baseY = height - 28;
    this.ctx.fillText("↑ Height unlocks new atmospheres", width * 0.025, baseY);
    this.ctx.fillText("★ Stars deal damage", width * 0.19, baseY);
    this.ctx.fillText("☁ Clouds bounce you higher", width * 0.33, baseY);
  }

  drawScene() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(false);
    this._setSelectShellState(false);
    this._setGameShellState(true);
    const cameraOffsetY = this.cameraOffsetY || 0;
    const groundY = this.sceneGroundY || Math.max(height - 56, Math.floor(height * 0.92));
    this.ctx.clearRect(0, 0, width, height);
    this._drawGameGradient(width, height);
    // draw altitude-driven atmosphere/detail layers (planes, sun, satellites, planets)
    this._drawAtmosphereLayers(width, height, cameraOffsetY);
    this._drawGameClouds(width, height, cameraOffsetY, groundY);

    for (const cloud of this.cloudPlatforms) {
      cloud.draw(this.ctx, cameraOffsetY);
    }

    // compute altitude for ground translate (rows proxy)
    const altitudeRows = this.debugForceAltitude != null ? this.debugForceAltitude : (this.frog?.currentCloudRow || 0);
    const tSky = 8; // same scale as atmosphere entry
    // ground slides down with the camera once the frog reaches the center of the screen
    const groundOffsetProportion = Math.max(0, Math.min(1, altitudeRows / (tSky * 1.0)));
    const groundOffset = Math.max(0, cameraOffsetY);
    const groundAlpha = Math.max(0.08, 1 - groundOffsetProportion * 0.85);

    if (groundAlpha > 0.02) {
      this.ctx.save();
      this.ctx.globalAlpha = groundAlpha;
      this.ctx.fillStyle = "#2f8f4a";
      this.ctx.fillRect(0, groundY + groundOffset, width, height - (groundY + groundOffset));
      // decorations on the ground (flowers, house) with vertical translation
      this._drawGroundDecorations(width, height, groundY, groundAlpha, groundOffset);
      this.ctx.restore();
    }

    for (const obstacle of this.obstacles) {
      obstacle.draw(this.ctx, cameraOffsetY);
    }

    if (this.previewFrames > 0) {
      this._drawPreviewHazard(width, height, cameraOffsetY);
      this._drawPreviewFrog(width, height, cameraOffsetY);
    } else if (this.frog) {
      this.frog.draw(this.ctx, cameraOffsetY);
    }

    this.updateUi();
    this._drawOverlayMessage();
    if (this.gameOver) {
      this._drawGameOverOverlay();
    }
  }

  _drawPreviewFrog(width, height, cameraOffsetY = 0) {
    if (!this.frog) {
      return;
    }

    const previewX = width * 0.52;
    const previewY = height * 0.46;
    this.frog.drawAt(this.ctx, previewX, previewY + cameraOffsetY);
  }

  _drawPreviewHazard(width, height, cameraOffsetY = 0) {
    const x = width * 0.14;
    const y = height * 0.28;
    const obstacle = new FallingObstacle(x, 0);
    obstacle.y = y;
    obstacle.draw(this.ctx, cameraOffsetY);
  }

  _drawGameClouds(width, height, cameraOffsetY = 0, groundY = height) {
    // Background atmosphere clouds: soft, semi-transparent, and visually
    // distinct from the solid platform clouds (which remain opaque white).
    const specs = [
      [Math.floor(width * 0.12), Math.floor(height * 0.14), 1.0],
      [Math.floor(width * 0.28), Math.floor(height * 0.08), 0.95],
      [Math.floor(width * 0.55), Math.floor(height * 0.12), 0.9],
      [Math.floor(width * 0.82), Math.floor(height * 0.18), 0.85],
      [Math.floor(width * 0.87), Math.floor(height * 0.33), 0.92],
      [Math.floor(width * 0.74), Math.floor(height * 0.46), 1.0],
    ];

    this.ctx.save();
    // Softer, translucent fill so players can distinguish from platform clouds
    this.ctx.fillStyle = "rgba(255,255,255,0.48)";
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.shadowColor = "rgba(0,0,0,0)";

    for (const [x, y, scale] of specs) {
      const rx = Math.round(34 * scale);
      const ry = Math.round(20 * scale);
      // draw a few overlapping, softer ellipses
      this.ctx.beginPath();
      const adjustedY = y + cameraOffsetY * 0.08;
      if (adjustedY + 20 >= groundY - 8) {
        continue;
      }
      this.ctx.ellipse(x - Math.round(rx * 0.6), adjustedY + Math.round(2 * scale), Math.round(rx * 0.85), Math.round(ry * 0.9), 0, 0, Math.PI * 2);
      this.ctx.ellipse(x + Math.round(rx * 0.1), adjustedY - Math.round(6 * scale), Math.round(rx * 0.95), Math.round(ry * 0.85), 0, 0, Math.PI * 2);
      this.ctx.ellipse(x + Math.round(rx * 1.25), adjustedY + Math.round(4 * scale), Math.round(rx * 0.8), Math.round(ry * 0.9), 0, 0, Math.PI * 2);
      this.ctx.fill();

      // a faint inner highlight to suggest translucency
      const grad = this.ctx.createRadialGradient(x, y, 4, x, y, rx * 1.1);
      grad.addColorStop(0, 'rgba(255,255,255,0.28)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.ellipse(x, adjustedY, Math.round(rx * 0.9), Math.round(ry * 0.7), 0, 0, Math.PI * 2);
      this.ctx.fill();

      // restore fillStyle for the next cloud
      this.ctx.fillStyle = "rgba(255,255,255,0.48)";
    }

    this.ctx.restore();
  }

  _drawGameGradient(width, height) {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#9fd0f7");
    gradient.addColorStop(0.72, "#bfe3f3");
    gradient.addColorStop(1, "#95cb96");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    const softBand = this.ctx.createLinearGradient(0, height * 0.56, 0, height);
    softBand.addColorStop(0, "rgba(227, 248, 250, 0)");
    softBand.addColorStop(1, "rgba(192, 240, 200, 0.75)");
    this.ctx.fillStyle = softBand;
    this.ctx.fillRect(0, 0, width, height);
  }

  _drawGroundDecorations(width, height, groundY, opacity = 1, groundOffset = 0) {
    // draw house and flowers using deterministic positions stored in _groundDecorPositions
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, Math.min(1, opacity));

    // draw a small house anchored to ground (moves down with groundOffset)
    const houseW = Math.min(140, Math.round(width * 0.14));
    const houseH = Math.round(houseW * 0.6);
    const hx = Math.round(width * 0.12);
    const hy = groundY - houseH + groundOffset;
    ctx.fillStyle = '#f6e7d8';
    ctx.fillRect(hx, hy, houseW, houseH);
    ctx.fillStyle = '#d96b5a';
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy);
    ctx.lineTo(hx + houseW / 2, hy - houseH * 0.6);
    ctx.lineTo(hx + houseW + 6, hy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a3b2a';
    ctx.fillRect(hx + Math.round(houseW / 2) - 12, hy + houseH - 36, 24, 36);

    // grassy tufts and flowers using cached positions
    const flowerColors = ['#ffd3e8', '#ffeaa7', '#ffd4b5', '#d7ffd6'];
    const positions = this._groundDecorPositions || [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const fx = Math.round(p.fx * width);
      const fy = Math.round(groundY - p.vy + groundOffset);
      // stem
      ctx.strokeStyle = '#2f8f4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 10);
      ctx.lineTo(fx, fy - 6);
      ctx.stroke();
      // flower
      ctx.fillStyle = flowerColors[p.colorIndex % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawAtmosphereLayers(width, height, cameraOffsetY = 0) {
    // Decide stage by frog's currentCloudRow (altitude proxy)
    const altitude = this.debugForceAltitude != null ? this.debugForceAltitude : (this.frog?.currentCloudRow || 0);
    // increased thresholds so transitions are noticeably slower and level-like
    const tSky = 8;
    const tAtmos = 18;
    const tSat = 30;
    const tSpace = 45;

    const now = Date.now();

    const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

    // Sky layer: slower moving airplanes when above small altitude
    if (altitude >= tSky * 0.25) {
      const planeOpacity = Math.max(0, Math.min(1, (altitude - tSky * 0.25) / (tSky * 1.5)));
      this.ctx.save();
      this.ctx.globalAlpha = 0.45 * planeOpacity;
      const planeCount = 2;
      for (let i = 0; i < planeCount; i++) {
        const speed = 0.008 + i * 0.004; // much slower
          const x = ((now * speed) / 10 + i * (width / planeCount)) % (width + 160) - 80;
          const y = Math.round(height * (0.12 + 0.06 * i)) + cameraOffsetY * 0.08;
        this.ctx.fillStyle = 'rgba(48,68,96,0.85)';
        this.ctx.beginPath();
        this.ctx.moveTo(x - 12, y);
        this.ctx.lineTo(x + 6, y - 6);
        this.ctx.lineTo(x + 18, y - 4);
        this.ctx.lineTo(x + 18, y + 4);
        this.ctx.lineTo(x + 6, y + 6);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Atmosphere / sunset gradient blend (slower entry)
    if (altitude >= tAtmos * 0.35) {
      const p = Math.max(0, Math.min(1, (altitude - tAtmos * 0.35) / (tAtmos * 1.2)));
      const grad = this.ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, `rgba(${lerp(159, 255, p)}, ${lerp(208, 130, p)}, ${lerp(247, 70, p)}, ${0.12 * p})`);
      grad.addColorStop(1, `rgba(${lerp(191, 255, p)}, ${lerp(227, 95, p)}, ${lerp(243, 90, p)}, ${0.10 * p})`);
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'lighter';
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, width, height);
      if (p > 0.12) {
        const sunX = width * 0.9;
        const sunY = height * 0.12;
        const r = lerp(40, 120, p);
        const g = this.ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, r);
        g.addColorStop(0, `rgba(255,200,80,${0.9 * p})`);
        g.addColorStop(1, `rgba(255,120,60,${0.0 * p})`);
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Satellites: appear higher with slower movement
    if (altitude >= tSat * 0.35) {
      const s = Math.max(0, Math.min(1, (altitude - tSat * 0.35) / (tSat * 1.1)));
      this.ctx.save();
      this.ctx.globalAlpha = 0.5 * s;
      const satCount = 3;
      for (let i = 0; i < satCount; i++) {
        const sx = ((now * (0.006 + i * 0.004)) / 10 + i * (width / satCount)) % (width + 120) - 60;
        const sy = Math.round(height * (0.22 - 0.02 * i)) + cameraOffsetY * 0.04;
        this.ctx.fillStyle = 'rgba(200,200,210,0.95)';
        this.ctx.fillRect(sx - 6, sy - 4, 12, 8);
        this.ctx.fillStyle = 'rgba(40,80,120,0.9)';
        this.ctx.fillRect(sx - 18, sy - 5, 8, 10);
        this.ctx.fillRect(sx + 10, sy - 5, 8, 10);
      }
      this.ctx.restore();
    }

    // Outer space: stars, moon, and planets beyond high altitude
    if (altitude >= tSpace * 0.3) {
      const q = Math.max(0, Math.min(1, (altitude - tSpace * 0.3) / (tSpace * 1.0)));
      this.ctx.save();
      const spaceGrad = this.ctx.createLinearGradient(0, 0, 0, height * 0.6);
      spaceGrad.addColorStop(0, `rgba(4,6,18,${0.92 * q})`);
      spaceGrad.addColorStop(1, `rgba(8,12,36,${0.12 * q})`);
      this.ctx.fillStyle = spaceGrad;
      this.ctx.fillRect(0, 0, width, height * 0.6);

      this.ctx.globalAlpha = q;
      this.ctx.fillStyle = '#fff9d9';
      for (let i = 0; i < 60; i++) {
        const rx = Math.floor((i * 37 + (now / 137)) % width);
        const ry = Math.floor((i * 23 + (now / 143)) % Math.floor(height * 0.45)) + cameraOffsetY * 0.03;
        const r = (i % 3) + 0.6;
        this.ctx.beginPath();
        this.ctx.arc(rx, ry, r, 0, Math.PI * 2);
        this.ctx.fill();
      }

      const moonX = width * 0.82;
      const moonY = height * 0.12 + cameraOffsetY * 0.04;
      const moonR = 52 * (0.6 + 0.8 * q);
      this.ctx.fillStyle = '#eef3ff';
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      this.ctx.fill();

      // Saturn-like ringed planet
      const saturnX = width * 0.12;
      const saturnY = height * 0.16 + cameraOffsetY * 0.03;
      const saturnR = 34 * (0.7 + 0.5 * q);
      const saturnGrad = this.ctx.createRadialGradient(saturnX - 8, saturnY - 8, 4, saturnX, saturnY, saturnR);
      saturnGrad.addColorStop(0, 'rgba(255,220,150,0.98)');
      saturnGrad.addColorStop(1, 'rgba(196,138,70,0.95)');
      this.ctx.fillStyle = saturnGrad;
      this.ctx.beginPath();
      this.ctx.arc(saturnX, saturnY, saturnR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(234, 208, 170, 0.75)';
      this.ctx.lineWidth = 8;
      this.ctx.beginPath();
      this.ctx.ellipse(saturnX, saturnY + 1, saturnR * 1.6, saturnR * 0.55, -0.25, 0, Math.PI * 2);
      this.ctx.stroke();

      // Jupiter-like banded planet
      const jupiterX = width * 0.92;
      const jupiterY = height * 0.09 + cameraOffsetY * 0.035;
      const jupiterR = 44 * (0.65 + 0.55 * q);
      this.ctx.fillStyle = '#d8a074';
      this.ctx.beginPath();
      this.ctx.arc(jupiterX, jupiterY, jupiterR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.save();
      this.ctx.globalAlpha = 0.85;
      this.ctx.strokeStyle = 'rgba(255, 240, 220, 0.45)';
      this.ctx.lineWidth = 6;
      for (let band = -2; band <= 2; band += 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(jupiterX - jupiterR * 0.82, jupiterY + band * 8);
        this.ctx.lineTo(jupiterX + jupiterR * 0.82, jupiterY + band * 8);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Higher altitude UFOs
      if (altitude >= tSpace * 0.85) {
        const ufoStrength = Math.max(0, Math.min(1, (altitude - tSpace * 0.85) / (tSpace * 0.6)));
        this.ctx.save();
        this.ctx.globalAlpha = 0.6 * ufoStrength;
        for (let i = 0; i < 3; i += 1) {
          const ufoX = ((now * (0.012 + i * 0.004)) / 10 + i * (width / 3)) % (width + 140) - 70;
          const ufoY = height * (0.05 + i * 0.07) + cameraOffsetY * 0.02;
          this.ctx.fillStyle = 'rgba(120, 238, 255, 0.9)';
          this.ctx.beginPath();
          this.ctx.ellipse(ufoX, ufoY, 20, 8, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = 'rgba(225, 255, 255, 0.72)';
          this.ctx.beginPath();
          this.ctx.ellipse(ufoX, ufoY - 4, 10, 5, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = 'rgba(180, 255, 255, 0.6)';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(ufoX - 14, ufoY + 1);
          this.ctx.lineTo(ufoX + 14, ufoY + 1);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      this.ctx.restore();
    }
  }

  drawHomeScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(true);
    this._setSelectShellState(false);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);
    this._drawLandingBackdrop(width, height);
    this._drawLandingIntro(width, height);
    this._drawHeroPanel(width, height, this.selectedCatcher, { showStartButton: false });
    this._drawLandingFooter(width, height);
  }

  drawSelectScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(false);
    this._setSelectShellState(true);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);
    this._drawLandingBackdrop(width, height);
    this._drawLandingIntro(width, height);
    this._drawHeroPanel(width, height, this.selectedCatcher, { showStartButton: true });
    this._drawLandingFooter(width, height);
  }

  _handleCanvasClick(event) {
    const { x, y } = this._getCanvasPoint(event);

    if (this.onHomeScreen && !this.gameOver) {
      if (
        this.homeStartButtonBounds &&
        this.homeStartButtonBounds[0] <= x && x <= this.homeStartButtonBounds[2] &&
        this.homeStartButtonBounds[1] <= y && y <= this.homeStartButtonBounds[3]
      ) {
        this.beginGame();
        return;
      }

      this._handleSelectScreenClick(x, y);
      return;
    }

    if (this.onSelectScreen && !this.gameOver) {
      this._handleSelectScreenClick(x, y);
    }
  }

  _handleSelectScreenClick(x, y) {
    for (let index = 0; index < this.selectCardBounds.length; index += 1) {
      const [x1, y1, x2, y2] = this.selectCardBounds[index];
      if (x1 <= x && x <= x2 && y1 <= y && y <= y2) {
        this.selectedCatcher = index;
        this.selectedAvatarType = this._getSelectedAvatarType();
        if (this.frog) {
          this.frog.setAvatar(this.selectedAvatarType);
        }
        if (this.onHomeScreen) {
          this.drawHomeScreen();
        } else {
          this.drawSelectScreen();
        }
        return;
      }
    }

    if (this.selectButtonBounds && this.selectButtonBounds[0] <= x && x <= this.selectButtonBounds[2] && this.selectButtonBounds[1] <= y && y <= this.selectButtonBounds[3]) {
      this.beginGame();
    }
  }

  _onPointerDown(event) {
    if (this.onHomeScreen || this.onSelectScreen) {
      return;
    }

    if (this.gameOver) {
      return;
    }

    this.pointerDragging = true;
    this.pointerX = this._getCanvasPoint(event).x;
    this._setFrogFromPointer(this.pointerX);
  }

  _onPointerMove(event) {
    if (!this.pointerDragging) {
      return;
    }

    this.pointerX = this._getCanvasPoint(event).x;
    this._setFrogFromPointer(this.pointerX);
  }

  _onPointerUp() {
    this.pointerDragging = false;
    if (this.frog) {
      this.frog.stop();
    }
  }

  _setFrogFromPointer(x) {
    if (!this.frog) {
      return;
    }

    const [width] = this._displaySize();
    this.frog.x = clamp(x, GameConfig.PLAYER_W / 2, width - GameConfig.PLAYER_W / 2);
    this.frog.vx = 0;
  }

  _onKeyDown(event) {
    if (event.key === "ArrowLeft") {
      this.frog?.moveLeft();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      this.frog?.moveRight();
      event.preventDefault();
    } else if (event.key === "r" || event.key === "R") {
      this.restart();
    } else if (event.key === "F11") {
      this.toggleFullscreen();
      event.preventDefault();
    } else if (event.key === "Escape" && this.isFullscreen) {
      this.toggleFullscreen(false);
    } else if (event.key === "Enter" && this.onSelectScreen) {
      this.beginGame();
    } else if (event.key === "p" || event.key === "P") {
      // cycle preview stages: 0(ground) -> sky -> atmosphere -> satellites -> space -> off
      const cycle = [0, 6, 12, 20, 32, null];
      const curIndex = cycle.indexOf(this.debugForceAltitude);
      const next = cycle[(curIndex + 1) % cycle.length];
      this.debugForceAltitude = next;
      const label = next === null ? 'off' : `${next} rows`;
      this.showMessage(`Preview altitude: ${label}`);
    }
  }

  _onKeyUp(event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      this.frog?.stop();
    }
  }

  toggleFullscreen(enabled) {
    const shouldEnable = enabled === undefined ? !this.isFullscreen : Boolean(enabled);

    if (shouldEnable) {
      const target = document.documentElement;
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          this.isFullscreen = true;
          this._handleResize();
        });
      } else {
        this.isFullscreen = true;
        this._handleResize();
      }
      return;
    }

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        this.isFullscreen = false;
        this._handleResize();
      });
    } else {
      this.isFullscreen = false;
      this._handleResize();
    }
  }

  beginGame() {
    this.onHomeScreen = false;
    this.onSelectScreen = false;
    this._setHomeShellState(false);
    this._setSelectShellState(false);
    this._setGameShellState(true);
    if (!this.isFullscreen) {
      this.toggleFullscreen(true);
    }
    this.startGame();
    this.drawScene();
  }

  startGame() {
    this.analytics.newGame();
    this.obstaclesDodged = 0;
    this.altitudeScore = 0;
    this.gameOver = false;
    this.cameraOffsetY = 0;
    this.selectedAvatarType = this._getSelectedAvatarType();
    this.frog.setAvatar(this.selectedAvatarType);
    this.frog.reset();
    this.lastHazardSpawn = 0;
    this.obstacles = [];
    this.cloudPlatforms.forEach((cloud) => {
      cloud.disappearTimer = null;
    });

    this.sequence = this.sequenceGenerator.generateSequence(GameConfig.IDS_MAX_DEPTH);
    this.sequenceTime = 0;
    this.spawnedObstacles = new Set();
    this.pendingMessage = "";
    this._loopRunning = true;
    this.previewFrames = 45;
  }

  _updateGame(dt) {
    if (this.gameOver) {
      return;
    }

    this.sequenceTime += dt;
    const [width, height] = this._displaySize();
    const frogAlive = this.frog.update(this.cloudPlatforms, width, height, dt);
    if (!frogAlive) {
      this.endGame("Frog fell off! Game Over!");
      return;
    }

    for (const cloud of this.cloudPlatforms) {
      cloud.update(dt);
    }

    const centerY = Math.round(height * 0.5);
    const targetOffsetY = Math.max(0, centerY - this.frog.y);
    // lock the camera upward without easing so the character pace stays visually consistent
    this.cameraOffsetY = Math.max(this.cameraOffsetY || 0, targetOffsetY);

    const altitudeMeters = Math.max(0, Math.trunc(this.frog.currentCloudRow * 10));
    this.altitudeScore = Math.max(this.altitudeScore, altitudeMeters);
    this.bestScore = Math.max(this.bestScore, this.altitudeScore);

    this._ensureCloudContinuity();
    if (this.frog.jumpBoostFlightActive) {
      this.obstacles = [];
      this.lastHazardSpawn = 0;
    } else {
      this.sequenceTime += dt;
      this._spawnObstaclesFromSequence();
      this._continuousHazardSpawner(dt);

      const altitudeLift = this.cameraOffsetY || 0;
      const speedBoost = Math.min(6, altitudeLift / 160);
      const remainingObstacles = [];
      for (const obstacle of this.obstacles) {
        obstacle.update(speedBoost);

        if (obstacle.collidesWith(this.frog)) {
          if (this.frog.starShieldTimer > 0) {
            continue;
          }
          this.endGame("Hit by a star! Game Over!");
          return;
        }

        if (obstacle.offScreen(height, this.cameraOffsetY)) {
          this.obstaclesDodged += 1;
          this.analytics.dodgedObstacle();
          const unlocked = this.achievements.check(this.obstaclesDodged);
          if (unlocked.length) {
            this.showMessage(`Achievement: ${unlocked.join(", ")}`);
          }
          continue;
        }

        remainingObstacles.push(obstacle);
      }

      this.obstacles = remainingObstacles;
    }

    this.bestScore = Math.max(this.bestScore, this.obstaclesDodged);
    this.updateUi();
  }

  _spawnObstaclesFromSequence() {
    if (!this.sequence) {
      return;
    }

    this.sequence.hazards.forEach(([cloudId, spawnTime, speed], index) => {
      if (spawnTime <= this.sequenceTime && !this.spawnedObstacles.has(index)) {
        const [cloudX] = this.cloudGraph.getNodePosition(cloudId);
        this.obstacles.push(new FallingObstacle(cloudX, speed));
        this.spawnedObstacles.add(index);
      }
    });
  }

  _continuousHazardSpawner(dt) {
    const altitudeLift = this.cameraOffsetY || 0;
    const interval = Math.max(0.35, this.hazardSpawnInterval - altitudeLift / 1000);
    this.lastHazardSpawn += dt;

    if (this.obstacles.length < 2 || this.lastHazardSpawn >= interval) {
      const [width] = this._displaySize();
      const cx = Math.floor(70 + Math.random() * Math.max(1, width - 140));
      const speed = 2.0 + altitudeLift / 220;
      const obstacle = new FallingObstacle(cx, speed);
      // spawn just above the visible camera so stars continue to enter the screen
      obstacle.y = -(this.cameraOffsetY || 0) - 40;
      this.obstacles.push(obstacle);

      this.lastHazardSpawn = 0;
    }
  }

  _ensureCloudContinuity() {
    if (!this.cloudPlatforms.length) {
      return;
    }

    const frogY = this.frog?.y;
    const bufferPx = this.cloudGraph.rowGap * 6;
    const rowsToAdd = 4;

    while (typeof frogY === "number") {
      const topCloudY = Math.min(...this.cloudPlatforms.map((cloud) => cloud.y));
      if (frogY > topCloudY + bufferPx) {
        break;
      }

      const beforeCount = this.cloudGraph.nodes.length;
      const beforeGoalRow = this.cloudGraph.goalRow;
      this.cloudGraph.addRowsAbove(rowsToAdd);

      for (let nodeId = beforeCount; nodeId < this.cloudGraph.nodes.length; nodeId += 1) {
        const [cloudX, cloudY] = this.cloudGraph.getNodePosition(nodeId);
        this.cloudPlatforms.push(new CloudPlatform(cloudX, cloudY, nodeId, this.cloudGraph.getRow(nodeId), this.sceneGroundY));
      }

      if (this.cloudGraph.goalRow === beforeGoalRow) {
        break;
      }
    }
  }

  updateUi() {
    const [width] = this._displaySize();
    const boxX1 = 14;
    const boxY1 = 14;
    const boxW = 132;
    const boxH = 44;

    this.ctx.save();
    this._drawRoundedRect(boxX1, boxY1, boxX1 + boxW, boxY1 + boxH, 2, "#7c93a3", "", 0);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.moveTo(boxX1 + 18, boxY1 + boxH / 2 - 9);
    this.ctx.lineTo(boxX1 + 9, boxY1 + boxH / 2 + 7);
    this.ctx.lineTo(boxX1 + 27, boxY1 + boxH / 2 + 7);
    this.ctx.closePath();
    this.ctx.fill();

    const altitude = this.altitudeScore || 0;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = 'bold 18px Arial, sans-serif';
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(`${altitude}m`, boxX1 + 38, boxY1 + boxH / 2 + 1);
    this.ctx.restore();
  }

  _drawOverlayMessage() {
    if (!this.pendingMessage) {
      return;
    }

    const [width] = this._displaySize();
    this.ctx.save();
    this._drawRoundedRect(width / 2 - 180, 84, width / 2 + 180, 126, 18, "rgba(255,255,255,0.88)", "#2b5d8a", 2);
    this.ctx.fillStyle = "#144d8a";
    this.ctx.font = 'bold 14px Arial, sans-serif';
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(this.pendingMessage, width / 2, 105);
    this.ctx.restore();
  }

  _drawGameOverOverlay() {
    const [width, height] = this._displaySize();
    this.ctx.save();
    this._drawRoundedRect(width / 2 - 250, height / 2 - 80, width / 2 + 250, height / 2 + 80, 18, "#ffffff", "#2b5d8a", 3);
    this.ctx.fillStyle = "#2b5d8a";
    this.ctx.font = 'bold 26px Arial, sans-serif';
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("Game Over", width / 2, height / 2 - 30);
    this.ctx.font = '14px Arial, sans-serif';
    this.ctx.fillText(this.gameOverText, width / 2, height / 2 + 10);
    this.ctx.font = '12px Arial, sans-serif';
    this.ctx.fillText(`Score: ${this.altitudeScore}   Best: ${this.bestScore}`, width / 2, height / 2 + 40);
    this.ctx.restore();
  }

  showMessage(text) {
    this.pendingMessage = text;
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }
    this.messageTimer = setTimeout(() => {
      this.pendingMessage = "";
      this.messageTimer = null;
    }, 1500);
  }

  endGame(text) {
    this.gameOver = true;
    this.gameOverText = text;
    this.analytics.data.last_score = this.altitudeScore;
    this.analytics.survivedSequence();
    this.dataLayer.save(this.bestScore);
    this.analytics.save();
  }

  restart() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._setSelectShellState(false);
    this._setGameShellState(true);
    this.drawScene();
    this._rebuildWorld();
    this.obstacles = [];
    this.spawnedObstacles = new Set();
    this.onHomeScreen = false;
    this.onSelectScreen = false;
    this.cameraOffsetY = 0;
    this.altitudeScore = 0;
    this.selectedAvatarType = this._getSelectedAvatarType();
    this.frog.setAvatar(this.selectedAvatarType);
    this.startGame();
  }

  onClose() {
    this.dataLayer.save(this.bestScore);
    this.analytics.save();
  }

  _loop(timestamp) {
    const dt = this.lastFrameTime ? Math.min(0.032, (timestamp - this.lastFrameTime) / 1000) : 0.016;
    this.lastFrameTime = timestamp;

    if (this.onHomeScreen) {
      this.drawHomeScreen();
    } else if (this.onSelectScreen) {
      this.drawSelectScreen();
    } else {
      if (!this.gameOver && this.previewFrames > 0) {
        this.previewFrames -= 1;
        this.drawScene();
        requestAnimationFrame(this._loop);
        return;
      }

      if (!this.gameOver) {
        this._updateGame(dt);
      }
      this.drawScene();
    }

    requestAnimationFrame(this._loop);
  }
}
