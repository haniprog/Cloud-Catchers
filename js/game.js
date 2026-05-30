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
    this.coinsCollected = 0;
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
    this.coinsCollected = 0;
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
        if (this.jumpBoostReady) {
          this.vy = -40;
          this.jumpBoostReady = false;
          // keep boost flight active while the powered jump is still in progress
        } else {
          this.vy = -14;
          if (this.jumpBoostFlightActive) {
            this.jumpBoostFlightActive = false;
          }
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
        // collect coin if present
        if (typeof cloud.collectCoin === "function" && cloud.collectCoin()) {
          this.coinsCollected += 1;
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
    this.coin = false;
    this.coinCollected = false;
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

  collectCoin() {
    if (!this.coin || this.coinCollected) {
      return false;
    }
    this.coinCollected = true;
    return true;
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

    // draw coin if present
    if (this.coin && !this.coinCollected) {
      ctx.save();
      const floatY = drawY - 22 + Math.sin(Date.now() / 300 + this.pickupPhase) * 3;
      ctx.fillStyle = "#ffd54a";
      ctx.strokeStyle = "#d49a18";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, floatY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff6d6";
      ctx.beginPath();
      ctx.arc(this.x - 2, floatY - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
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
    this.highestLevelUnlocked = this.savedData.highest_level_unlocked || 1;

    this.onHomeScreen = true;
    this.onSelectScreen = false;
    this.gameOver = false;
    this.selectedCatcher = 0;
    this.selectedAvatarType = "frog";
    this.selectCardBounds = [];
    this.homeStartButtonBounds = null;
    this.modePickerButtonBounds = null;
    this.levelNodeBounds = [];
    this.selectBackButtonBounds = null;
    this.selectStage = "mode";
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
    this.playMode = "continuous"; // or "levels"
    this.levelNumber = 1;
    this.levelConfig = null;
    this.levelDoor = null;
    this.coinsTotal = 0;
    this.coinsCollected = 0;
    this.levelCompleted = false;
    this.overlayButtonBounds = null;
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
    // clear any level data
    this.levelDoor = null;
    this.coinsTotal = 0;
    this.coinsCollected = 0;
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

  // level setup: mark clouds with coins and create an exit door
  _setupLevel(levelNum) {
    const defs = {
      1: { stars: false, coinCount: 6, rows: 40 },
      2: { stars: true, coinCount: 8, rows: 60, slowStars: true },
      3: { stars: true, coinCount: 10, rows: 80, slowStars: false },
    };
    this.levelNumber = Math.max(1, Math.min(3, Number(levelNum) || 1));
    this.levelConfig = defs[this.levelNumber] || defs[1];
    // clear previous coins
    for (const cloud of this.cloudPlatforms) {
      cloud.coin = false;
      cloud.coinCollected = false;
    }

    // If we're in levels mode, build a single-path vertical cloud graph
    if (this.playMode === "levels") {
      const [width, height] = this._displaySize();
      const groundY = this.sceneGroundY || Math.max(height - 56, Math.floor(height * 0.92));
      // build a CloudGraph with one column and many rows to form a single path
      this.cloudGraph = new CloudGraph(width, groundY, this.levelConfig.rows, 1, GameConfig.CLOUD_ROW_GAP, GameConfig.CLOUD_JUMP_RANGE);
      this.sequenceGenerator = new IDSSequenceGenerator(this.cloudGraph);
      this.cloudPlatforms = this.cloudGraph.nodes.map((cloudPos, index) => new CloudPlatform(cloudPos[0], cloudPos[1], index, this.cloudGraph.getRow(index), groundY));
      // ensure frog references the new cloud graph and reset to start
      if (this.frog) {
        this.frog.cloudGraph = this.cloudGraph;
        this.frog.reset();
      }
      for (const cloud of this.cloudPlatforms) {
        if (cloud.pickupType === "magic") {
          cloud.pickupType = null;
        }
        if (this.levelNumber === 1) {
          cloud.pickupType = null;
        }
      }
    }

    // randomly assign coins to distinct clouds (avoid ground row)
    const candidates = this.cloudPlatforms.filter((c) => c.row > 0);
    let placed = 0;
    while (placed < this.levelConfig.coinCount && candidates.length) {
      const idx = Math.floor(Math.random() * candidates.length);
      const cloud = candidates.splice(idx, 1)[0];
      cloud.coin = true;
      placed += 1;
    }
    this.coinsTotal = placed;
    this.coinsCollected = 0;

    // place door on the highest cloud (top-most row)
    const topCloud = this.cloudPlatforms.reduce((best, c) => (c.y < (best?.y ?? Infinity) ? c : best), null);
    if (topCloud) {
      this.levelDoor = { x: topCloud.x, y: topCloud.y - 28, row: topCloud.row, w: 28, h: 36 };
    } else {
      this.levelDoor = null;
    }

    // adjust hazard behaviour for levels
    if (!this.levelConfig.stars) {
      this.hazardSpawnInterval = 9999; // effectively disable continuous stars
    } else if (this.levelConfig.slowStars) {
      this.hazardSpawnInterval = 2.2;
    } else {
      this.hazardSpawnInterval = 0.9;
    }
    // require reaching the top row to complete level
    this.levelConfig.requiredRows = (this.levelConfig.rows || 0) - 1;
  }

  _getHeroRoster() {
    return [
      {
        avatarType: "frog",
        name: "Freddy",
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
        name: "Ruby",
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
        name: "Cathy",
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

  _getAvatarLabel(avatarType = this.selectedAvatarType) {
    const labels = {
      frog: "Frog",
      rabbit: "Rabbit",
      cat: "Cat",
    };

    return labels[avatarType] || "Frog";
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

  _drawLandingBackdrop(width, height, time = 0) {
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

    for (let index = 0; index < starFields.length; index += 1) {
      const [sx, sy, size] = starFields[index];
      const twinkle = 0.45 + 0.55 * Math.max(0, Math.sin(time * 0.0018 + index * 1.35));
      this.ctx.fillStyle = `rgba(255, 231, 145, ${0.22 + twinkle * 0.78})`;
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const fallingCycle = (time * 0.00011) % 1;
    const starStartX = -width * 0.03;
    const starStartY = height * 0.08;
    const starTravelX = width * 0.38;
    const starTravelY = height * 0.42;
    const starX = starStartX + starTravelX * fallingCycle;
    const starY = starStartY + starTravelY * fallingCycle;
    this.ctx.save();
    this.ctx.translate(starX, starY);
    this.ctx.rotate(-0.62);
    const sweep = this.ctx.createLinearGradient(-80, 0, 24, 0);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.45, "rgba(255,255,255,0.34)");
    sweep.addColorStop(1, "rgba(255,235,171,0.95)");
    this.ctx.strokeStyle = sweep;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(-72, 0);
    this.ctx.lineTo(0, 0);
    this.ctx.stroke();
    this.ctx.fillStyle = "rgba(255, 244, 198, 0.96)";
    this.ctx.shadowColor = "rgba(255, 214, 111, 0.65)";
    this.ctx.shadowBlur = 18;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    const cloudLoop = width + 520;
    const cloudBands = [
      { start: -320, y: height * 0.085, scale: 0.32, speed: 0.120, spacing: 340, count: 3, phase: 0 },
      { start: -340, y: height * 0.20, scale: 0.75, speed: 0.098, spacing: 390, count: 3, phase: cloudLoop * 0.22 },
      { start: -360, y: height * 0.60, scale: 0.95, speed: 0.084, spacing: 450, count: 2, phase: cloudLoop * 0.48 },
      { start: -380, y: height * 0.76, scale: 1.08, speed: 0.074, spacing: 520, count: 2, phase: cloudLoop * 0.74 },
    ];
    for (const band of cloudBands) {
      for (let index = 0; index < band.count; index += 1) {
        const x = band.start + ((time * band.speed + band.phase + index * band.spacing) % cloudLoop);
        const y = band.y + Math.sin(time * 0.0011 + index * 1.7) * (band.scale * 5);
        this._drawHomeCloud(x, y, band.scale);
      }
    }

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
    if (panelOptions.showModeOptions) {
      const modeW = 120;
      const modeH = 36;
      const gap = 12;
      const totalW = modeW * 2 + gap;
      const modeX = panelX1 + Math.floor((panelW - totalW) / 2);
      const modeY = cardY1 + cardH + 14;

      // Continuous button
      const contX1 = modeX;
      const contY1 = modeY;
      const contX2 = contX1 + modeW;
      const contY2 = contY1 + modeH;
      this.ctx.fillStyle = this.playMode === "continuous" ? "#71e0f8" : "#dfe8f5";
      this._drawRoundedRect(contX1, contY1, contX2, contY2, 10, this.ctx.fillStyle, "", 0);
      this.ctx.fillStyle = "#21183c";
      this.ctx.font = "700 14px 'Segoe UI', Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("Continuous", (contX1 + contX2) / 2, contY1 + 23);

      // Levels button
      const lvlX1 = contX2 + gap;
      const lvlY1 = modeY;
      const lvlX2 = lvlX1 + modeW;
      const lvlY2 = lvlY1 + modeH;
      this.ctx.fillStyle = this.playMode === "levels" ? "#ffe17c" : "#f3f0df";
      this._drawRoundedRect(lvlX1, lvlY1, lvlX2, lvlY2, 10, this.ctx.fillStyle, "", 0);
      this.ctx.fillStyle = "#21183c";
      this.ctx.fillText("Play By Levels", (lvlX1 + lvlX2) / 2, lvlY1 + 23);
      this.modeButtonBounds = { continuous: [contX1, contY1, contX2, contY2], levels: [lvlX1, lvlY1, lvlX2, lvlY2] };

      // level quick selector immediately below mode buttons
      if (this.playMode === "levels") {
        this.levelButtonBounds = [];
        const baseLX = contX1;
        const baseLY = lvlY2 + 12;
        const cardW = 46;
        const gap2 = 10;
        for (let i = 1; i <= 3; i += 1) {
          const x1 = baseLX + (i - 1) * (cardW + gap2);
          const y1 = baseLY;
          const x2 = x1 + cardW;
          const y2 = y1 + 40;
          this.ctx.fillStyle = this.levelNumber === i ? "#a9e07a" : "#ffffff";
          this._drawRoundedRect(x1, y1, x2, y2, 8, this.ctx.fillStyle, "", 0);
          this.ctx.fillStyle = "#21183c";
          this.ctx.font = "700 16px 'Segoe UI', Arial";
          this.ctx.fillText("L" + i, (x1 + x2) / 2, y1 + 26);
          this.levelButtonBounds.push([x1, y1, x2, y2]);
        }
      } else {
        this.levelButtonBounds = null;
      }
    } else {
      this.modeButtonBounds = null;
      this.levelButtonBounds = null;
    }

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

    // draw level exit door when in levels mode
    if (this.playMode === "levels" && this.levelDoor) {
      const d = this.levelDoor;
      const drawX = d.x;
      const drawY = d.y + cameraOffsetY;
      this.ctx.save();
      this.ctx.fillStyle = "#6b3a1a";
      this.ctx.strokeStyle = "#321a0c";
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(drawX - d.w / 2, drawY - d.h / 2, d.w, d.h);
      this.ctx.strokeRect(drawX - d.w / 2, drawY - d.h / 2, d.w, d.h);
      // small keyhole
      this.ctx.fillStyle = "#f2d36b";
      this.ctx.beginPath();
      this.ctx.arc(drawX, drawY - 4, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillRect(drawX - 2, drawY - 2, 4, 8);
      this.ctx.restore();
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

  _drawScreenBackdrop(width, height, options = {}) {
    const inset = options.inset ?? Math.max(18, Math.round(Math.min(width, height) * 0.028));
    const outerFill = options.outerFill ?? "#080413";
    const panelFill = options.panelFill ?? outerFill;
    const panelStroke = options.panelStroke ?? "rgba(255,255,255,0.14)";
    const radius = options.radius ?? 30;
    const panelX1 = inset;
    const panelY1 = inset;
    const panelX2 = width - inset;
    const panelY2 = height - inset;

    this.ctx.fillStyle = outerFill;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.save();
    this.ctx.shadowColor = options.shadowColor ?? "rgba(0, 0, 0, 0.4)";
    this.ctx.shadowBlur = options.shadowBlur ?? 34;
    this.ctx.shadowOffsetY = options.shadowOffsetY ?? 10;
    this._drawRoundedRect(panelX1, panelY1, panelX2, panelY2, radius, panelFill, panelStroke, 1.2);
    this.ctx.restore();

    return { x1: panelX1, y1: panelY1, x2: panelX2, y2: panelY2, inset };
  }

  _drawHomeLandingScreen(width, height, time = 0) {
    const background = this.ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#1e0d3a");
    background.addColorStop(0.18, "#3b1863");
    background.addColorStop(0.46, "#6b2e8d");
    background.addColorStop(0.72, "#d13b8e");
    background.addColorStop(0.88, "#ff8c5d");
    background.addColorStop(1, "#ffc42b");
    const frame = this._drawScreenBackdrop(width, height, {
      outerFill: "#090015",
      panelFill: background,
      panelStroke: "rgba(255,255,255,0.16)",
      radius: 30,
    });

    const stars = [
      [0.08, 0.1, 1.2], [0.15, 0.23, 1.0], [0.19, 0.08, 1.6], [0.24, 0.31, 1.1],
      [0.35, 0.06, 1.3], [0.47, 0.14, 1.0], [0.52, 0.27, 1.1], [0.62, 0.08, 1.5],
      [0.71, 0.18, 1.0], [0.8, 0.06, 1.3], [0.89, 0.15, 1.0], [0.93, 0.24, 1.2],
      [0.12, 0.82, 1.0], [0.28, 0.77, 1.2], [0.49, 0.84, 1.0], [0.67, 0.79, 1.1],
    ];
    this.ctx.fillStyle = "rgba(255, 242, 193, 0.92)";
    for (const [sx, sy, size] of stars) {
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.save();
    this.ctx.translate(width * 0.07, height * 0.15);
    this.ctx.rotate(-0.16);
    const streak = this.ctx.createLinearGradient(0, 0, width * 0.19, height * 0.05);
    streak.addColorStop(0, "rgba(255,255,255,0)");
    streak.addColorStop(0.44, "rgba(255,255,255,0.35)");
    streak.addColorStop(1, "rgba(255,230,158,0.95)");
    this.ctx.strokeStyle = streak;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(width * 0.18, height * 0.08);
    this.ctx.stroke();
    this.ctx.restore();

    const glowCx = width * 0.5;
    const glowCy = height * 0.57;
    const glow = this.ctx.createRadialGradient(glowCx, glowCy, 18, glowCx, glowCy, Math.max(width, height) * 0.15);
    glow.addColorStop(0, "rgba(255, 248, 199, 0.95)");
    glow.addColorStop(0.4, "rgba(255, 215, 96, 0.72)");
    glow.addColorStop(1, "rgba(255, 180, 68, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(glowCx, glowCy, Math.max(92, Math.min(width, height) * 0.11), 0, Math.PI * 2);
    this.ctx.fill();

    const cloudBob = Math.sin(time * 0.0011) * 6;
    this._drawHomeCloud(width * 0.79 + Math.sin(time * 0.0007) * 8, height * 0.21 + cloudBob * 0.2, 1.1);
    this._drawHomeCloud(width * 0.84 + Math.sin(time * 0.0009 + 1.7) * 10, height * 0.58 + cloudBob * 0.12, 1.0);
    this._drawHomeCloud(width * 0.03 + Math.sin(time * 0.0008 + 2.8) * 7, height * 0.66 - cloudBob * 0.1, 0.95);

    const roster = this._getHeroRoster();
    const iconY = height * 0.26;
    const iconXs = [width * 0.42, width * 0.5, width * 0.58];
    roster.forEach((hero, index) => {
      const iconX = iconXs[index];
      const floatOffset = Math.sin(time * 0.0012 + index * 1.5) * 10;
      const orb = this.ctx.createRadialGradient(iconX - 8, iconY - 8, 6, iconX, iconY, 54);
      orb.addColorStop(0, hero.glowInner);
      orb.addColorStop(0.55, hero.glowMid);
      orb.addColorStop(1, hero.glowOuter);
      this.ctx.save();
      this.ctx.shadowColor = hero.shadow;
      this.ctx.shadowBlur = 24;
      this.ctx.fillStyle = orb;
      this.ctx.beginPath();
      this.ctx.arc(iconX, iconY + floatOffset * 0.14, 34, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      this.ctx.font = "44px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(hero.emoji, iconX, iconY + 1 + floatOffset * 0.14);
    });

    const titleY = height * 0.42;
    const titleGradient = this.ctx.createLinearGradient(width * 0.33, 0, width * 0.69, 0);
    titleGradient.addColorStop(0, "#96e8ff");
    titleGradient.addColorStop(0.48, "#fff1ef");
    titleGradient.addColorStop(1, "#ffe28a");
    this.ctx.save();
    this.ctx.font = "900 78px Georgia, 'Times New Roman', serif";
    this.ctx.fillStyle = titleGradient;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.shadowColor = "rgba(255,255,255,0.14)";
    this.ctx.shadowBlur = 12;
    this.ctx.fillText("Cloud Catchers", width * 0.5, titleY);
    this.ctx.restore();

    this.ctx.fillStyle = "rgba(248, 238, 244, 0.82)";
    this.ctx.font = "600 12px Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("HOP THE SKY · DODGE THE STARS", width * 0.5, titleY + 34);

    const buttonW = Math.min(width * 0.44, 540);
    const buttonH = 72;
    const buttonX1 = Math.round(width * 0.5 - buttonW / 2);
    const buttonY1 = Math.round(height * 0.61);
    const buttonX2 = buttonX1 + buttonW;
    const buttonY2 = buttonY1 + buttonH;
    this.homeStartButtonBounds = [buttonX1, buttonY1, buttonX2, buttonY2];
    const buttonGradient = this.ctx.createLinearGradient(buttonX1, 0, buttonX2, 0);
    buttonGradient.addColorStop(0, "#9beaff");
    buttonGradient.addColorStop(0.55, "#d6c3ff");
    buttonGradient.addColorStop(1, "#ffe28a");
    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 203, 132, 0.35)";
    this.ctx.shadowBlur = 24;
    this._drawRoundedRect(buttonX1, buttonY1, buttonX2, buttonY2, 999, buttonGradient, "", 0);
    this.ctx.restore();
    this.ctx.fillStyle = "#25183a";
    this.ctx.font = "900 20px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Tap to play", width * 0.5 - 8, buttonY1 + 45);
    this.ctx.font = "900 18px Arial, sans-serif";
    this.ctx.fillText("▶", buttonX2 - 28, buttonY1 + 44);

    this.ctx.fillStyle = "rgba(244, 232, 232, 0.78)";
    this.ctx.font = "600 12px Arial, sans-serif";
    this.ctx.fillText(`BEST ALTITUDE · ${Math.round(this.bestScore || 0)} M`, width * 0.5, buttonY2 + 34);

    this.ctx.fillStyle = "rgba(247, 233, 236, 0.84)";
    this.ctx.font = "500 10px Arial, sans-serif";
    this.ctx.fillText("A DREAMY CLIMBER", width * 0.5, frame.y2 - 18);

    this.modePickerButtonBounds = null;
    this.levelNodeBounds = [];
    this.selectBackButtonBounds = null;
    this.selectButtonBounds = null;
    this.selectCardBounds = [];
  }

  _drawModePickerScreen(width, height) {
    this._drawScreenBackdrop(width, height, {
      outerFill: "#070413",
      panelFill: "rgba(10, 11, 31, 0.98)",
      panelStroke: "rgba(255,255,255,0.12)",
      radius: 28,
      inset: Math.max(20, Math.round(Math.min(width, height) * 0.025)),
    });

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    const modeStars = [
      [0.06, 0.1], [0.19, 0.28], [0.34, 0.13], [0.46, 0.06], [0.63, 0.19], [0.81, 0.11], [0.9, 0.28],
    ];
    for (const [sx, sy] of modeStars) {
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const modalW = Math.min(width * 0.36, 470);
    const modalH = Math.min(height * 0.48, 380);
    const modalX1 = Math.round(width * 0.5 - modalW / 2);
    const modalY1 = Math.round(height * 0.5 - modalH / 2);
    const modalX2 = modalX1 + modalW;
    const modalY2 = modalY1 + modalH;
    this._drawRoundedRect(modalX1, modalY1, modalX2, modalY2, 28, "rgba(23, 23, 52, 0.98)", "rgba(255,255,255,0.12)", 1.1);

    this.ctx.fillStyle = "#f8f5fe";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.font = "900 30px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Pick a mode", modalX1 + 24, modalY1 + 52);

    this.ctx.fillStyle = "rgba(214, 219, 239, 0.74)";
    this.ctx.font = "500 15px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("How do you want to play today?", modalX1 + 24, modalY1 + 80);

    const buttonX1 = modalX1 + 20;
    const buttonX2 = modalX2 - 20;
    const buttonH = 90;
    const buttonGap = 12;
    const originalY1 = modalY1 + 104;
    const levelsY1 = originalY1 + buttonH + buttonGap;

    const drawModeButton = (y1, title, subtitle, symbol, boundsKey) => {
      const y2 = y1 + buttonH;
      this._drawRoundedRect(buttonX1, y1, buttonX2, y2, 20, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.14)", 1.2);
      this.ctx.fillStyle = "rgba(255,255,255,0.08)";
      this.ctx.beginPath();
      this.ctx.arc(buttonX1 + 26, y1 + 46, 20, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#0d1024";
      this.ctx.font = "900 22px Arial, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(symbol, buttonX1 + 26, y1 + 53);
      this.ctx.textAlign = "left";
      this.ctx.fillStyle = "#fbf8ff";
      this.ctx.font = "900 20px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
      this.ctx.fillText(title, buttonX1 + 60, y1 + 39);
      this.ctx.fillStyle = "rgba(226, 231, 244, 0.72)";
      this.ctx.font = "500 13px 'Segoe UI', Arial, sans-serif";
      this.ctx.fillText(subtitle, buttonX1 + 60, y1 + 63);
      this.modePickerButtonBounds[boundsKey] = [buttonX1, y1, buttonX2, y2];
    };

    this.modePickerButtonBounds = {};
    drawModeButton(originalY1, "Original", "Endless climb — the sky has no limit.", "∞", "original");
    drawModeButton(levelsY1, "Levels", "Three biomes · Easy → Medium → Hard.", "🗺", "levels");

    const backY = modalY2 - 22;
    this.selectBackButtonBounds = [modalX1 + 145, backY - 12, modalX2 - 145, backY + 12];
    this.ctx.fillStyle = "rgba(185, 186, 202, 0.72)";
    this.ctx.font = "500 14px 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("← BACK", width * 0.5, backY);

    this.selectButtonBounds = null;
    this.selectCardBounds = [];
    this.levelNodeBounds = [];
  }

  _drawOriginalSelectScreen(width, height) {
    this._drawScreenBackdrop(width, height, {
      outerFill: "#070413",
      panelFill: "rgba(12, 13, 33, 0.98)",
      panelStroke: "rgba(255,255,255,0.12)",
      radius: 28,
      inset: Math.max(20, Math.round(Math.min(width, height) * 0.025)),
    });

    const modalW = Math.min(width * 0.37, 470);
    const modalH = Math.min(height * 0.54, 412);
    const modalX1 = Math.round(width * 0.5 - modalW / 2);
    const modalY1 = Math.round(height * 0.5 - modalH / 2);
    const modalX2 = modalX1 + modalW;
    const modalY2 = modalY1 + modalH;
    this._drawRoundedRect(modalX1, modalY1, modalX2, modalY2, 28, "rgba(27, 27, 57, 0.98)", "rgba(255,255,255,0.12)", 1.1);

    this.ctx.fillStyle = "#f8f5fe";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.font = "900 28px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Choose your catcher", modalX1 + 24, modalY1 + 48);

    this.ctx.fillStyle = "rgba(219, 225, 242, 0.7)";
    this.ctx.font = "500 14px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Use \u2190 \u2192 or drag to move.", modalX1 + 24, modalY1 + 74);
    this.ctx.fillText("Jump cloud to cloud. Avoid the falling stars.", modalX1 + 24, modalY1 + 94);

    const roster = this._getHeroRoster();
    const cardGap = 12;
    const cardTop = modalY1 + 112;
    const cardW = Math.floor((modalW - 56 - cardGap * 2) / 3);
    const cardH = 108;
    const startX = modalX1 + 24;
    this.selectCardBounds = [];

    roster.forEach((hero, index) => {
      const x1 = startX + index * (cardW + cardGap);
      const x2 = x1 + cardW;
      const y2 = cardTop + cardH;
      const selected = index === this.selectedCatcher;
      this.selectCardBounds.push([x1, cardTop, x2, y2]);
      this._drawRoundedRect(x1, cardTop, x2, y2, 20, selected ? "rgba(87, 88, 116, 0.92)" : "rgba(255,255,255,0.06)", selected ? "rgba(255,255,255,0.84)" : "rgba(255,255,255,0.12)", 1.2);
      const orbCx = x1 + cardW / 2;
      const orbCy = cardTop + 37;
      const orb = this.ctx.createRadialGradient(orbCx - 8, orbCy - 8, 6, orbCx, orbCy, 38);
      orb.addColorStop(0, hero.glowInner);
      orb.addColorStop(0.6, hero.glowMid);
      orb.addColorStop(1, hero.glowOuter);
      this.ctx.save();
      this.ctx.shadowColor = hero.shadow;
      this.ctx.shadowBlur = selected ? 22 : 14;
      this.ctx.fillStyle = orb;
      this.ctx.beginPath();
      this.ctx.arc(orbCx, orbCy, 28, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      this.ctx.font = "32px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(hero.emoji, orbCx, orbCy + 1);
      this.ctx.fillStyle = "#fbf8ff";
      this.ctx.font = "900 14px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
      this.ctx.fillText(hero.name, orbCx, cardTop + 85);
    });

    const buttonW = modalW - 44;
    const buttonH = 56;
    const buttonX1 = modalX1 + 22;
    const buttonY1 = modalY2 - 106;
    const buttonX2 = buttonX1 + buttonW;
    const buttonY2 = buttonY1 + buttonH;
    this.selectButtonBounds = [buttonX1, buttonY1, buttonX2, buttonY2];
    const buttonGradient = this.ctx.createLinearGradient(buttonX1, 0, buttonX2, 0);
    buttonGradient.addColorStop(0, "#92e9ff");
    buttonGradient.addColorStop(0.55, "#d8c3ff");
    buttonGradient.addColorStop(1, "#ffe28a");
    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 203, 132, 0.28)";
    this.ctx.shadowBlur = 22;
    this._drawRoundedRect(buttonX1, buttonY1, buttonX2, buttonY2, 18, buttonGradient, "", 0);
    this.ctx.restore();
    this.ctx.fillStyle = "#25183a";
    this.ctx.font = "900 18px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("Start climbing →", modalX1 + modalW / 2, buttonY1 + 36);

    const backY = modalY2 - 24;
    this.selectBackButtonBounds = [modalX1 + 136, backY - 12, modalX2 - 136, backY + 12];
    this.ctx.fillStyle = "rgba(185, 186, 202, 0.72)";
    this.ctx.font = "500 14px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("← BACK", width * 0.5, backY);

    this.ctx.fillStyle = "rgba(232, 237, 247, 0.74)";
    this.ctx.font = "500 13px 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText(`Best altitude: ${Math.round(this.bestScore || 0)} m`, width * 0.5, modalY2 + 28);

    this.modePickerButtonBounds = null;
    this.levelNodeBounds = [];
  }

  _drawLevelsSelectScreen(width, height) {
    const frame = this._drawScreenBackdrop(width, height, {
      outerFill: "#090014",
      panelFill: "rgba(13, 9, 31, 0)",
      panelStroke: "rgba(255,255,255,0.1)",
      radius: 30,
      inset: Math.max(18, Math.round(Math.min(width, height) * 0.024)),
    });

    const panelGrad = this.ctx.createLinearGradient(0, frame.y1, 0, frame.y2);
    panelGrad.addColorStop(0, "#170d39");
    panelGrad.addColorStop(0.34, "#5b26bf");
    panelGrad.addColorStop(0.6, "#cd4ca5");
    panelGrad.addColorStop(0.83, "#f3924b");
    panelGrad.addColorStop(1, "#6db15e");
    this.ctx.save();
    this.ctx.shadowColor = "rgba(0,0,0,0.18)";
    this.ctx.shadowBlur = 14;
    this._drawRoundedRect(frame.x1, frame.y1, frame.x2, frame.y2, 30, panelGrad, "rgba(255,255,255,0.12)", 1.2);
    this.ctx.restore();

    const stars = [
      [0.08, 0.12], [0.16, 0.24], [0.24, 0.07], [0.3, 0.17], [0.42, 0.1], [0.53, 0.22], [0.62, 0.08],
      [0.7, 0.18], [0.8, 0.12], [0.9, 0.09], [0.94, 0.2], [0.12, 0.8], [0.88, 0.72],
    ];
    this.ctx.fillStyle = "rgba(255, 248, 210, 0.72)";
    for (const [sx, sy] of stars) {
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, 1.1, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this._drawHomeCloud(frame.x1 + 5, height * 0.47, 1.18);

    this.ctx.fillStyle = "rgba(255,255,255,0.76)";
    this.ctx.font = "700 13px Arial, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillText("← MODE", frame.x1 + 18, frame.y1 + 26);
    this.selectBackButtonBounds = [frame.x1 + 6, frame.y1 + 8, frame.x1 + 88, frame.y1 + 34];

    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "rgba(255,255,255,0.72)";
    this.ctx.font = "700 12px Arial, sans-serif";
    this.ctx.fillText("WORLD MAP", width * 0.5, frame.y1 + 18);
    this.ctx.fillStyle = "#fff8f1";
    this.ctx.font = "900 22px Georgia, 'Times New Roman', serif";
    this.ctx.fillText("Cloud Catchers", width * 0.5, frame.y1 + 42);
    this.ctx.fillStyle = "rgba(255,255,255,0.72)";
    this.ctx.font = "700 13px Arial, sans-serif";
    this.ctx.fillText(`${this.levelNumber}/3`, frame.x2 - 34, frame.y1 + 22);

    const points = [
      { level: 1, x: frame.x1 + frame.inset * 6.5, y: frame.y2 - frame.inset * 5.2, title: "Meadow Hop", subtitle: "EASY · 400M", icon: "🌿" },
      { level: 2, x: width * 0.49, y: height * 0.48, title: "Cloud Climb", subtitle: "MEDIUM · 1000M", icon: "🔒" },
      { level: 3, x: frame.x2 - frame.inset * 5.5, y: frame.y1 + frame.inset * 4.9, title: "Cosmic Dash", subtitle: "HARD · 1800M", icon: "🔒" },
    ].map((node) => ({
      ...node,
      locked: node.level > Math.max(1, this.highestLevelUnlocked || 1),
    }));

    this.ctx.save();
    this.ctx.setLineDash([22, 16]);
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = 9;
    const pathGradient = this.ctx.createLinearGradient(points[0].x, points[0].y, points[2].x, points[2].y);
    pathGradient.addColorStop(0, "rgba(104, 236, 255, 0.82)");
    pathGradient.addColorStop(0.45, "rgba(164, 198, 255, 0.82)");
    pathGradient.addColorStop(1, "rgba(229, 189, 255, 0.82)");
    this.ctx.strokeStyle = pathGradient;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    this.ctx.lineTo(points[1].x, points[1].y);
    this.ctx.lineTo(points[2].x, points[2].y);
    this.ctx.stroke();
    this.ctx.restore();

    this.levelNodeBounds = [];
    points.forEach((node) => {
      const radius = 38;
      const circleX1 = node.x - radius;
      const circleY1 = node.y - radius;
      const circleX2 = node.x + radius;
      const circleY2 = node.y + radius;
      this.levelNodeBounds.push({ level: node.level, locked: node.locked, bounds: [circleX1, circleY1, circleX2, circleY2] });
      this.ctx.save();
      this.ctx.shadowColor = node.locked ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.34)";
      this.ctx.shadowBlur = node.locked ? 10 : 24;
      this._drawRoundedRect(circleX1, circleY1, circleX2, circleY2, 999, node.locked ? "rgba(24, 25, 55, 0.62)" : "rgba(255,255,255,0.18)", node.locked ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.92)", 1.4);
      this.ctx.restore();

      this.ctx.fillStyle = node.locked ? "rgba(255, 219, 168, 0.72)" : "#f4f9ff";
      this.ctx.font = "900 24px Arial, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(node.locked ? "🔒" : "🔓", node.x, node.y - 3);

      this.ctx.fillStyle = "rgba(255,255,255,0.92)";
      this.ctx.font = "900 11px Arial, sans-serif";
      this.ctx.fillText(`LV ${node.level}`, node.x, node.y + 21);

      const labelY = node.y + radius + 34;
      this.ctx.fillStyle = "#fbf8ff";
      this.ctx.font = "900 17px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
      this.ctx.fillText(node.title, node.x, labelY);
      this.ctx.fillStyle = "rgba(255,255,255,0.78)";
      this.ctx.font = "700 12px Arial, sans-serif";
      this.ctx.fillText(node.subtitle, node.x, labelY + 18);
    });

    this.ctx.fillStyle = "rgba(248, 241, 244, 0.8)";
    this.ctx.font = "700 12px Arial, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("TAP A NODE TO BEGIN", width * 0.5, frame.y2 - 18);

    this.selectButtonBounds = null;
    this.selectCardBounds = [];
    this.modePickerButtonBounds = null;
  }

  drawHomeScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(true);
    this._setSelectShellState(false);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);
    this.selectStage = "mode";
    this._drawHomeLandingScreen(width, height, performance.now());
  }

  drawSelectScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(false);
    this._setSelectShellState(true);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);
    const stage = this.selectStage || "mode";
    if (stage === "original") {
      this._drawOriginalSelectScreen(width, height);
    } else if (stage === "levels") {
      this._drawLevelsSelectScreen(width, height);
    } else {
      this.selectStage = "mode";
      this._drawModePickerScreen(width, height);
    }
  }

  _handleCanvasClick(event) {
    const { x, y } = this._getCanvasPoint(event);

    if (this.gameOver && this.overlayButtonBounds) {
      const home = this.overlayButtonBounds.home;
      const next = this.overlayButtonBounds.next;
      const retry = this.overlayButtonBounds.retry;
      if (home && home[0] <= x && x <= home[2] && home[1] <= y && y <= home[3]) {
        this.levelCompleted = false;
        this.gameOver = false;
        this.onHomeScreen = true;
        this.onSelectScreen = false;
        this._setHomeShellState(true);
        this._setSelectShellState(false);
        this._setGameShellState(false);
        this.drawHomeScreen();
        return;
      }
      if (next && next[0] <= x && x <= next[2] && next[1] <= y && y <= next[3]) {
        this.levelNumber = Math.min(3, this.levelNumber + 1);
        this.levelCompleted = false;
        this.gameOver = false;
        this.playMode = "levels";
        this.onHomeScreen = false;
        this.onSelectScreen = false;
        this._setHomeShellState(false);
        this._setSelectShellState(false);
        this._setGameShellState(true);
        this.startGame();
        this.drawScene();
        return;
      }
      if (retry && retry[0] <= x && x <= retry[2] && retry[1] <= y && y <= retry[3]) {
        this.levelCompleted = false;
        this.gameOver = false;
        this.onHomeScreen = false;
        this.onSelectScreen = false;
        this._setHomeShellState(false);
        this._setSelectShellState(false);
        this._setGameShellState(true);
        this.startGame();
        this.drawScene();
        return;
      }
    }

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
    const stage = this.selectStage || "mode";

    if (stage === "mode") {
      const original = this.modePickerButtonBounds?.original;
      if (original && original[0] <= x && x <= original[2] && original[1] <= y && y <= original[3]) {
        this.playMode = "continuous";
        this.selectStage = "original";
        this._rebuildWorld();
        this.drawSelectScreen();
        return;
      }

      const levels = this.modePickerButtonBounds?.levels;
      if (levels && levels[0] <= x && x <= levels[2] && levels[1] <= y && y <= levels[3]) {
        this.playMode = "levels";
        this.selectStage = "levels";
        this.drawSelectScreen();
        return;
      }

      if (this.selectBackButtonBounds && this.selectBackButtonBounds[0] <= x && x <= this.selectBackButtonBounds[2] && this.selectBackButtonBounds[1] <= y && y <= this.selectBackButtonBounds[3]) {
        this.onHomeScreen = true;
        this.onSelectScreen = false;
        this._setHomeShellState(true);
        this._setSelectShellState(false);
        this._setGameShellState(false);
        this.drawHomeScreen();
      }
      return;
    }

    if (stage === "original") {
      for (let index = 0; index < this.selectCardBounds.length; index += 1) {
        const [x1, y1, x2, y2] = this.selectCardBounds[index];
        if (x1 <= x && x <= x2 && y1 <= y && y <= y2) {
          this.selectedCatcher = index;
          this.selectedAvatarType = this._getSelectedAvatarType();
          if (this.frog) {
            this.frog.setAvatar(this.selectedAvatarType);
          }
          this.drawSelectScreen();
          return;
        }
      }

      if (this.selectButtonBounds && this.selectButtonBounds[0] <= x && x <= this.selectButtonBounds[2] && this.selectButtonBounds[1] <= y && y <= this.selectButtonBounds[3]) {
        this.onHomeScreen = false;
        this.onSelectScreen = false;
        this._setHomeShellState(false);
        this._setSelectShellState(false);
        this._setGameShellState(true);
        this.startGame();
        this.drawScene();
        return;
      }

      if (this.selectBackButtonBounds && this.selectBackButtonBounds[0] <= x && x <= this.selectBackButtonBounds[2] && this.selectBackButtonBounds[1] <= y && y <= this.selectBackButtonBounds[3]) {
        this.selectStage = "mode";
        this.drawSelectScreen();
      }
      return;
    }

    if (stage === "levels") {
      for (const node of this.levelNodeBounds) {
        const [x1, y1, x2, y2] = node.bounds;
        if (x1 <= x && x <= x2 && y1 <= y && y <= y2) {
          if (node.locked) {
            return;
          }
          this.levelNumber = node.level;
          this.onHomeScreen = false;
          this.onSelectScreen = false;
          this._setHomeShellState(false);
          this._setSelectShellState(false);
          this._setGameShellState(true);
          this.startGame();
          this.drawScene();
          return;
        }
      }

      if (this.selectBackButtonBounds && this.selectBackButtonBounds[0] <= x && x <= this.selectBackButtonBounds[2] && this.selectBackButtonBounds[1] <= y && y <= this.selectBackButtonBounds[3]) {
        this.selectStage = "mode";
        this.drawSelectScreen();
      }
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
    // Open the character/mode Select screen instead of starting immediately
    this.onHomeScreen = false;
    this.onSelectScreen = true;
    this.selectStage = "mode";
    this._setHomeShellState(false);
    this._setSelectShellState(true);
    this._setGameShellState(false);
    if (!this.isFullscreen) {
      this.toggleFullscreen(true);
    }
    this.drawSelectScreen();
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
    this.levelCompleted = false;
    this.overlayButtonBounds = null;
    // if playing a level, prepare its layout (coins, door, hazards)
    if (this.playMode === "levels") {
      this._setupLevel(this.levelNumber);
      if (this.frog) {
        this.frog.coinsCollected = 0;
      }
    }
  }

  _updateGame(dt) {
    if (this.gameOver) {
      return;
    }

    this.sequenceTime += dt;
    const [width, height] = this._displaySize();
    const frogAlive = this.frog.update(this.cloudPlatforms, width, height, dt);
    if (!frogAlive) {
      this.endGame(`${this._getAvatarLabel()} fell off! Game Over!`);
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
    const hazardEnabled = this.playMode !== "levels" ? true : Boolean(this.levelConfig && this.levelConfig.stars);
    if (this.frog.jumpBoostFlightActive) {
      this.obstacles = [];
      this.lastHazardSpawn = 0;
    } else {
      this.sequenceTime += dt;
      if (hazardEnabled) {
        this._spawnObstaclesFromSequence();
        this._continuousHazardSpawner(dt);
      }

      const altitudeLift = this.cameraOffsetY || 0;
      const speedBoost = Math.min(6, altitudeLift / 160);
      const remainingObstacles = [];
      for (const obstacle of this.obstacles) {
        obstacle.update(speedBoost);

        if (obstacle.collidesWith(this.frog)) {
          if (this.frog.starShieldTimer > 0 || this.frog.jumpBoostFlightActive) {
            continue;
          }
          this.endGame(`${this._getAvatarLabel()} got hit by a star! Game Over!`);
          return;
        }

        if (obstacle.offScreen(height, this.cameraOffsetY)) {
          this.obstaclesDodged += 1;
          this.analytics.dodgedObstacle();
          const unlocked = this.achievements.check(this.obstaclesDodged, this._getAvatarLabel());
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

    // level completion check
    if (this.playMode === "levels" && this.levelConfig && this.levelDoor) {
      const door = this.levelDoor;
      const frog = this.frog;
      const meetsCoins = (frog.coinsCollected || 0) >= (this.coinsTotal || 0);
      const meetsRows = (frog.currentCloudRow || 0) >= (this.levelConfig.requiredRows || 0);
      const dx = Math.abs((frog.x || 0) - door.x);
      const dy = Math.abs((frog.y || 0) - door.y);
      const inDoorRange = dx < (door.w / 1.5) && dy < (door.h / 1.5);
      if (meetsCoins && meetsRows && inDoorRange) {
        this._completeLevel();
        return;
      }
    }
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

    // Levels end at the door, so do not generate extra clouds in level mode.
    if (this.playMode === "levels") {
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
    if (this.playMode === "levels") {
      return;
    }

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
    if (!this.pendingMessage || (this.playMode === "levels" && !this.levelCompleted)) {
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
    const boxX1 = width / 2 - 260;
    const boxY1 = height / 2 - 110;
    const boxX2 = width / 2 + 260;
    const boxY2 = height / 2 + 110;
    this.overlayButtonBounds = {};
    this.ctx.save();
    this._drawRoundedRect(boxX1, boxY1, boxX2, boxY2, 18, "#ffffff", "#2b5d8a", 3);
    this.ctx.fillStyle = "#2b5d8a";
    this.ctx.font = 'bold 26px Arial, sans-serif';
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    const title = this.levelCompleted ? "Level Complete" : "Game Over";
    this.ctx.fillText(title, width / 2, boxY1 + 40);
    this.ctx.font = '14px Arial, sans-serif';
    this.ctx.fillText(this.gameOverText, width / 2, boxY1 + 80);
    if (this.playMode !== "levels") {
      this.ctx.font = '12px Arial, sans-serif';
      this.ctx.fillText(`Score: ${this.altitudeScore}   Best: ${this.bestScore}`, width / 2, boxY1 + 104);
    }

    const buttonW = 180;
    const buttonH = 38;
    const buttonY = boxY2 - buttonH - 18;
    const homeX1 = width / 2 - buttonW - 12;
    const homeX2 = homeX1 + buttonW;
    const otherX1 = width / 2 + 12;
    const otherX2 = otherX1 + buttonW;

    this._drawRoundedRect(homeX1, buttonY, homeX2, buttonY + buttonH, 12, "#71e0f8", "", 0);
    this.ctx.fillStyle = "#21183c";
    this.ctx.font = '700 14px Arial, sans-serif';
    this.ctx.fillText("Back Home", (homeX1 + homeX2) / 2, buttonY + buttonH / 2);
    this.overlayButtonBounds.home = [homeX1, buttonY, homeX2, buttonY + buttonH];

    if (this.levelCompleted && this.playMode === "levels") {
      if (this.levelNumber < 3) {
        this._drawRoundedRect(otherX1, buttonY, otherX2, buttonY + buttonH, 12, "#ffe17c", "", 0);
        this.ctx.fillStyle = "#21183c";
        this.ctx.fillText("Next Level", (otherX1 + otherX2) / 2, buttonY + buttonH / 2);
        this.overlayButtonBounds.next = [otherX1, buttonY, otherX2, buttonY + buttonH];
      } else {
        this._drawRoundedRect(otherX1, buttonY, otherX2, buttonY + buttonH, 12, "#ffe17c", "", 0);
        this.ctx.fillStyle = "#21183c";
        this.ctx.fillText("Play Again", (otherX1 + otherX2) / 2, buttonY + buttonH / 2);
        this.overlayButtonBounds.retry = [otherX1, buttonY, otherX2, buttonY + buttonH];
      }
    } else {
      this._drawRoundedRect(otherX1, buttonY, otherX2, buttonY + buttonH, 12, "#ffe17c", "", 0);
      this.ctx.fillStyle = "#21183c";
      this.ctx.fillText("Play Again", (otherX1 + otherX2) / 2, buttonY + buttonH / 2);
      this.overlayButtonBounds.retry = [otherX1, buttonY, otherX2, buttonY + buttonH];
    }

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

  _completeLevel() {
    this.gameOver = true;
    this.levelCompleted = true;
    this.gameOverText = `Level ${this.levelNumber} Complete!`;
    this.showMessage(`Level ${this.levelNumber} Complete!`);
    this.highestLevelUnlocked = Math.max(this.highestLevelUnlocked || 1, Math.min(3, this.levelNumber + 1));
    this.dataLayer.save(this.bestScore, this.highestLevelUnlocked);
    if (this.levelDoor && this.frog) {
      this.frog.x = this.levelDoor.x;
      this.frog.y = this.levelDoor.y + this.levelDoor.h * 0.75;
      this.frog.vx = 0;
      this.frog.vy = 0;
      this.frog.onGround = true;
    }
    this.overlayButtonBounds = null;
    this.analytics.data.last_score = this.altitudeScore;
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
    this.dataLayer.save(this.bestScore, this.highestLevelUnlocked);
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
