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
  constructor(canvas, cloudGraph) {
    this.canvas = canvas;
    this.cloudGraph = cloudGraph;
    this.x = cloudGraph.nodes[0][0];
    this.y = cloudGraph.nodes[0][1];
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.currentCloud = 0;
    this.currentCloudRow = 0;
  }

  reset() {
    this.x = this.cloudGraph.nodes[0][0];
    this.y = this.cloudGraph.nodes[0][1];
    this.vx = 0;
    this.vy = -14;
    this.onGround = false;
    this.currentCloud = 0;
    this.currentCloudRow = 0;
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

  jump() {
    return;
  }

  update(cloudPlatforms, width, height) {
    this.x += this.vx;
    this.x = clamp(this.x, GameConfig.PLAYER_W / 2, width - GameConfig.PLAYER_W / 2);

    this.vy += 0.8;
    this.y += this.vy;

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
        (cloud.row === this.currentCloudRow || cloud.row === this.currentCloudRow + 1)
      ) {
        this.y = cloud.y - 40;
        this.vy = -14;
        this.onGround = false;
        this.currentCloud = index;
        this.currentCloudRow = cloud.row;
        cloud.touch();
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

  draw(ctx) {
    this.drawAt(ctx, this.x, this.y);
  }

  drawAt(ctx, x, y) {
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
}

class CloudPlatform {
  constructor(x, y, cloudId, row) {
    this.x = x;
    this.y = y;
    this.cloudId = cloudId;
    this.row = row;
    this.disappearTimer = null;
    this.disappearDelay = Math.min(5.0, Math.max(1.2, 2.6 - row * 0.18));
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

  draw(ctx) {
    if (!this.isVisible()) {
      return;
    }

    ctx.save();
    const alpha = this.disappearTimer === null ? 1 : Math.max(0, Math.min(1, this.disappearTimer / this.disappearDelay));
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";

    ctx.beginPath();
    ctx.ellipse(this.x - 22, this.y + 3, 22, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(this.x, this.y - 2, 26, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(this.x + 24, this.y + 4, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
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

  offScreen(height) {
    return this.y > height + 50;
  }

  collidesWith(frog) {
    const dx = Math.abs(this.x - frog.x);
    const dy = Math.abs(this.y - frog.y);
    return dx < 25 && dy < 30;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 84, 0.85)";
    ctx.shadowBlur = 18;
    const glow = ctx.createRadialGradient(this.x, this.y + 6, 6, this.x, this.y + 6, 28);
    glow.addColorStop(0, "rgba(255, 247, 168, 0.95)");
    glow.addColorStop(0.45, "rgba(255, 208, 66, 0.6)");
    glow.addColorStop(1, "rgba(255, 208, 66, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y + 6, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffcf3f";
    ctx.strokeStyle = "#f29a00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 18);
    ctx.lineTo(this.x + 7, this.y - 2);
    ctx.lineTo(this.x + 24, this.y - 2);
    ctx.lineTo(this.x + 11, this.y + 9);
    ctx.lineTo(this.x + 16, this.y + 26);
    ctx.lineTo(this.x, this.y + 16);
    ctx.lineTo(this.x - 16, this.y + 26);
    ctx.lineTo(this.x - 11, this.y + 9);
    ctx.lineTo(this.x - 24, this.y - 2);
    ctx.lineTo(this.x - 7, this.y - 2);
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
    this.selectCardBounds = [];
    this.obstacles = [];
    this.cloudPlatforms = [];
    this.obstaclesDodged = 0;
    this.sequence = null;
    this.sequenceTime = 0;
    this.lastHazardSpawn = 0;
    this.hazardSpawnInterval = 1.6;
    this.spawnedObstacles = new Set();
    this.previewFrames = 0;

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

  _displaySize() {
    return [this.canvas.width || 1230, this.canvas.height || 712];
  }

  _rebuildWorld() {
    const [width, height] = this._displaySize();
    const bottomGap = GameConfig.HEIGHT - GameConfig.GROUND_Y;
    const groundY = Math.max(80, height - bottomGap);

    this.cloudGraph = new CloudGraph(
      width,
      groundY,
      GameConfig.NUM_CLOUD_ROWS,
      GameConfig.NUM_CLOUD_COLUMNS,
      GameConfig.CLOUD_ROW_GAP,
      GameConfig.CLOUD_JUMP_RANGE,
    );
    this.sequenceGenerator = new IDSSequenceGenerator(this.cloudGraph);
    this.frog = new Frog(this.canvas, this.cloudGraph);
    this.cloudPlatforms = this.cloudGraph.nodes.map((cloudPos, index) => new CloudPlatform(cloudPos[0], cloudPos[1], index, this.cloudGraph.getRow(index)));
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

  drawScene() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(false);
    this._setSelectShellState(false);
    this._setGameShellState(true);
    this.ctx.clearRect(0, 0, width, height);
    this._drawGameGradient(width, height);
    this._drawGameClouds(width, height);

    const groundY = Math.min(height - 80, GameConfig.GROUND_Y);
    this.ctx.fillStyle = "#2f8f4a";
    this.ctx.fillRect(0, groundY, width, height - groundY);

    for (const cloud of this.cloudPlatforms) {
      cloud.draw(this.ctx);
    }

    for (const obstacle of this.obstacles) {
      obstacle.draw(this.ctx);
    }

    if (this.previewFrames > 0) {
      this._drawPreviewHazard(width, height);
      this._drawPreviewFrog(width, height);
    } else if (this.frog) {
      this.frog.draw(this.ctx);
    }

    this.updateUi();
    this._drawOverlayMessage();
    if (this.gameOver) {
      this._drawGameOverOverlay();
    }
  }

  _drawPreviewFrog(width, height) {
    if (!this.frog) {
      return;
    }

    const previewX = width * 0.52;
    const previewY = height * 0.46;
    this.frog.drawAt(this.ctx, previewX, previewY);
  }

  _drawPreviewHazard(width, height) {
    const x = width * 0.14;
    const y = height * 0.28;
    const obstacle = new FallingObstacle(x, 0);
    obstacle.y = y;
    obstacle.draw(this.ctx);
  }

  _drawGameClouds(width, height) {
    const specs = [
      [Math.floor(width * 0.12), Math.floor(height * 0.18), 1.0],
      [Math.floor(width * 0.28), Math.floor(height * 0.08), 0.95],
      [Math.floor(width * 0.55), Math.floor(height * 0.12), 0.9],
      [Math.floor(width * 0.82), Math.floor(height * 0.18), 0.85],
      [Math.floor(width * 0.87), Math.floor(height * 0.43), 1.0],
      [Math.floor(width * 0.74), Math.floor(height * 0.63), 1.15],
    ];

    this.ctx.fillStyle = "#ffffff";
    for (const [x, y, scale] of specs) {
      const rx = Math.round(28 * scale);
      const ry = Math.round(17 * scale);
      this.ctx.beginPath();
      this.ctx.ellipse(x - rx * 0.5, y + 2, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.ellipse(x + rx * 0.4, y - 6, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.ellipse(x + rx * 1.2, y + 2, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
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

  drawHomeScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(true);
    this._setSelectShellState(false);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);

    const artWidth = 1230;
    const artHeight = 712;
    const scale = Math.max(width / artWidth, height / artHeight);
    const drawWidth = artWidth * scale;
    const drawHeight = artHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);
    this._drawHomeScreenArt(artWidth, artHeight);
    this.ctx.restore();
  }

  _drawHomeScreenArt(width, height) {
    const skyStops = [
      [0.00, "#2b1658"],
      [0.16, "#3f1f7a"],
      [0.36, "#6e2c8d"],
      [0.58, "#ae2f8e"],
      [0.80, "#f04e9a"],
      [1.00, "#ffb14b"],
    ];
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    for (const [stop, color] of skyStops) {
      gradient.addColorStop(stop, color);
    }
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.fillStyle = "rgba(255,255,255,0.95)";
    this.ctx.beginPath();
    this.ctx.arc(-16, height * 0.26, 54, 0, Math.PI * 2);
    this.ctx.arc(18, height * 0.26 + 4, 42, 0, Math.PI * 2);
    this.ctx.arc(58, height * 0.26 + 8, 33, 0, Math.PI * 2);
    this.ctx.fill();

    this._drawHomeCloud(width * 0.12, height * 0.77, 1.05);
    this._drawHomeCloud(width * 0.92, height * 0.68, 1.10);
    this._drawHomeCloud(width * 0.47, height * 0.70, 0.30);

    this.ctx.save();
    this.ctx.translate(width * 0.17, height * 0.09);
    this.ctx.rotate(-0.14);
    const shooting = this.ctx.createLinearGradient(0, 0, 120, 80);
    shooting.addColorStop(0, "rgba(255,255,255,0)");
    shooting.addColorStop(0.4, "rgba(255,255,255,0.45)");
    shooting.addColorStop(1, "#fff7d1");
    this.ctx.strokeStyle = shooting;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(122, 84);
    this.ctx.stroke();
    this.ctx.restore();

    const sparkles = [
      [0.07, 0.13, 1.8], [0.30, 0.36, 1.2], [0.50, 0.12, 1.4], [0.79, 0.23, 1.0],
      [0.88, 0.07, 1.6], [0.63, 0.29, 0.9], [0.18, 0.83, 1.2]
    ];
    this.ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const [sx, sy, size] of sparkles) {
      this.ctx.beginPath();
      this.ctx.arc(width * sx, height * sy, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const titleY = height * 0.50;
    const titleGradient = this.ctx.createLinearGradient(width * 0.18, 0, width * 0.82, 0);
    titleGradient.addColorStop(0, "#7ed8ff");
    titleGradient.addColorStop(0.5, "#fff4e8");
    titleGradient.addColorStop(1, "#ffe28a");

    this.ctx.save();
    this.ctx.font = "700 88px Georgia, 'Times New Roman', serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = "rgba(50, 18, 78, 0.18)";
    this.ctx.fillStyle = titleGradient;
    this.ctx.strokeText("Cloud Catchers", width * 0.5, titleY);
    this.ctx.fillText("Cloud Catchers", width * 0.5, titleY);
    this.ctx.restore();

    this.ctx.fillStyle = "#f4e8f7";
    this.ctx.font = "bold 14px Arial, sans-serif";
    this.ctx.fillText("HOP THE SKY · DODGE THE STARS", width * 0.5, height * 0.565);

    const mascotY = height * 0.19;
    this.ctx.font = "46px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    this.ctx.fillText("🐸", width * 0.39, mascotY);
    this.ctx.fillText("🐰", width * 0.50, mascotY);
    this.ctx.fillText("🐱", width * 0.61, mascotY);

    const sunCx = width * 0.5;
    const sunCy = height * 0.65;
    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 227, 121, 0.82)";
    this.ctx.shadowBlur = 36;
    const sunGlow = this.ctx.createRadialGradient(sunCx, sunCy, 12, sunCx, sunCy, 70);
    sunGlow.addColorStop(0, "rgba(255,255,221,0.95)");
    sunGlow.addColorStop(0.45, "rgba(255,232,98,0.8)");
    sunGlow.addColorStop(0.8, "rgba(255,190,79,0.22)");
    sunGlow.addColorStop(1, "rgba(255,190,79,0)");
    this.ctx.fillStyle = sunGlow;
    this.ctx.beginPath();
    this.ctx.arc(sunCx, sunCy, 70, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    const buttonX1 = width * 0.26;
    const buttonY1 = height * 0.69;
    const buttonX2 = width * 0.74;
    const buttonY2 = height * 0.78;
    const buttonGradient = this.ctx.createLinearGradient(buttonX1, 0, buttonX2, 0);
    buttonGradient.addColorStop(0, "#98e7ff");
    buttonGradient.addColorStop(0.48, "#d7c7ff");
    buttonGradient.addColorStop(1, "#ffe19a");

    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 223, 112, 0.5)";
    this.ctx.shadowBlur = 30;
    this._drawRoundedRect(buttonX1, buttonY1, buttonX2, buttonY2, 22, buttonGradient, "", 0);
    this.ctx.restore();

    this.ctx.fillStyle = "#11152c";
    this.ctx.font = "700 32px Arial, sans-serif";
    this.ctx.fillText("Tap to play ▶", width * 0.5, height * 0.725);

    this.ctx.fillStyle = "rgba(255, 240, 247, 0.9)";
    this.ctx.font = "500 13px Arial, sans-serif";
    this.ctx.fillText(`BEST ALTITUDE · ${this.bestScore} M`, width * 0.5, height * 0.83);
  }

  drawSelectScreen() {
    const [width, height] = this._displaySize();
    this._setHomeShellState(false);
    this._setSelectShellState(true);
    this._setGameShellState(false);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = SELECT_THEME.page_bg;
    this.ctx.fillRect(0, 0, width, height);

    const panelW = Math.floor(Math.min(460, width * 0.32));
    const panelH = Math.floor(Math.min(396, height * 0.55));
    const panelX1 = Math.floor(width / 2 - panelW / 2);
    const panelY1 = Math.floor(height / 2 - panelH / 2 - 6);
    const panelX2 = panelX1 + panelW;
    const panelY2 = panelY1 + panelH;

    this._drawRoundedRect(panelX1, panelY1, panelX2, panelY2, 26, SELECT_THEME.panel_fill, SELECT_THEME.panel_outline, 2);

    this.ctx.textAlign = "center";
    this.ctx.fillStyle = SELECT_THEME.title_fill;
    this.ctx.font = SELECT_THEME.title_font;
    this.ctx.fillText("Choose your catcher", Math.floor(width / 2), panelY1 + 38);

    const cardW = 128;
    const cardH = 108;
    const gap = 12;
    const totalW = cardW * 3 + gap * 2;
    const cardsX1 = Math.floor(width / 2 - totalW / 2);
    const cardY1 = panelY1 + 82;
    this.selectCardBounds = [];

    const catchers = [["Mochi", "🐸"], ["Pip", "🐰"], ["Luna", "🐱"]];
    catchers.forEach(([name, emoji], index) => {
      const x1 = cardsX1 + index * (cardW + gap);
      const x2 = x1 + cardW;
      const y1 = cardY1;
      const y2 = y1 + cardH;
      this.selectCardBounds.push([x1, y1, x2, y2]);

      const selected = index === this.selectedCatcher;
      const fill = selected ? SELECT_THEME.card_selected_fill : SELECT_THEME.card_fill;
      const outline = selected ? SELECT_THEME.card_selected_outline : SELECT_THEME.card_outline;
      this._drawRoundedRect(x1, y1, x2, y2, 18, fill, outline, 2);
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = SELECT_THEME.emoji_font;
      this.ctx.fillText(emoji, x1 + cardW / 2, y1 + 34);
      this.ctx.fillStyle = SELECT_THEME.label_fill;
      this.ctx.font = SELECT_THEME.card_name_font;
      this.ctx.fillText(name, x1 + cardW / 2, y2 - 24);
    });

    this.ctx.fillStyle = SELECT_THEME.instruction_fill;
    this.ctx.font = SELECT_THEME.instruction_font;
    this.ctx.fillText("Use ← → or drag to move.\nJump cloud to cloud. Avoid the falling stars.", Math.floor(width / 2), panelY1 + 238);

    const buttonW = Math.floor(panelW * 0.92);
    const buttonH = 58;
    const buttonX1 = Math.floor(width / 2 - buttonW / 2);
    const buttonY1 = panelY1 + 271;
    const buttonX2 = buttonX1 + buttonW;
    const buttonY2 = buttonY1 + buttonH;
    this._drawRoundedRect(buttonX1, buttonY1, buttonX2, buttonY2, 18, SELECT_THEME.button_left, "", 0);
    this._drawRoundedRect(buttonX1 + Math.floor(buttonW * 0.45), buttonY1, buttonX2, buttonY2, 18, SELECT_THEME.button_right, "", 0);
    this.ctx.fillStyle = SELECT_THEME.button_text;
    this.ctx.font = SELECT_THEME.button_font;
    this.ctx.fillText("Start climbing →", Math.floor(width / 2), buttonY1 + buttonH / 2 + 6);

    this.ctx.fillStyle = SELECT_THEME.footer_fill;
    this.ctx.font = SELECT_THEME.footer_font;
    this.ctx.fillText(`Best altitude: ${this.bestScore} m`, Math.floor(width / 2), panelY1 + 361);
  }

  _handleCanvasClick(event) {
    const { offsetX: x, offsetY: y } = event;

    if (this.onHomeScreen && !this.gameOver) {
      this.beginGame();
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
        this.drawSelectScreen();
        return;
      }
    }

    const [width, height] = this._displaySize();
    const panelW = Math.floor(Math.min(460, width * 0.32));
    const panelH = Math.floor(Math.min(396, height * 0.55));
    const panelY1 = Math.floor(height / 2 - panelH / 2 - 20);
    const panelY2 = panelY1 + panelH;
    const buttonW = Math.floor(panelW * 0.92);
    const buttonH = 60;
    const buttonX1 = Math.floor(width / 2 - buttonW / 2);
    const buttonY1 = panelY1 + 271;
    const buttonX2 = buttonX1 + buttonW;
    const buttonY2 = buttonY1 + buttonH;

    if (buttonX1 <= x && x <= buttonX2 && buttonY1 <= y && y <= buttonY2) {
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
    this.pointerX = event.offsetX;
    this._setFrogFromPointer(this.pointerX);
  }

  _onPointerMove(event) {
    if (!this.pointerDragging) {
      return;
    }

    this.pointerX = event.offsetX;
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
    if (this.onHomeScreen) {
      this.onHomeScreen = false;
      this.onSelectScreen = true;
      this._setHomeShellState(false);
      this._setSelectShellState(true);
      this.drawSelectScreen();
      return;
    }

    this.onSelectScreen = false;
    this._setSelectShellState(false);
    this._setGameShellState(true);
    if (!this.isFullscreen) {
      this.toggleFullscreen(true);
    }
    this.drawScene();
    this.startGame();
  }

  startGame() {
    this.analytics.newGame();
    this.obstaclesDodged = 0;
    this.gameOver = false;
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
    const frogAlive = this.frog.update(this.cloudPlatforms, width, height);
    if (!frogAlive) {
      this.endGame("Frog fell off! Game Over!");
      return;
    }

    for (const cloud of this.cloudPlatforms) {
      cloud.update(dt);
    }

    const cameraThreshold = 180;
    if (this.frog.y < cameraThreshold) {
      const dy = cameraThreshold - this.frog.y;

      this.cloudPlatforms.forEach((cloud) => {
        cloud.y += dy;
      });

      this.obstacles.forEach((obstacle) => {
        obstacle.y += dy;
      });

      this.cloudGraph.nodes = this.cloudGraph.nodes.map(([x, y]) => [x, y + dy]);
      this.frog.y = cameraThreshold;
    }

    this._ensureCloudContinuity();
    this._spawnObstaclesFromSequence();
    this._continuousHazardSpawner(dt);

    const speedBoost = this.frog.currentCloudRow * 0.18;
    const remainingObstacles = [];
    for (const obstacle of this.obstacles) {
      obstacle.update(speedBoost);

      if (obstacle.collidesWith(this.frog)) {
        this.endGame("Hit by a star! Game Over!");
        return;
      }

      if (obstacle.offScreen(height)) {
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
    const frogRow = this.frog?.currentCloudRow || 0;
    const interval = Math.max(0.35, this.hazardSpawnInterval - frogRow * 0.12);
    this.lastHazardSpawn += dt;

    if (this.obstacles.length < 2 || this.lastHazardSpawn >= interval) {
      const candidates = [];
      for (let index = 0; index < this.cloudGraph.nodes.length; index += 1) {
        if (this.cloudGraph.getRow(index) >= frogRow) {
          candidates.push(index);
        }
      }

      if (candidates.length) {
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        const [cx] = this.cloudGraph.getNodePosition(choice);
        const speed = 3.0 + this.cloudGraph.getRow(choice) * 0.45 + frogRow * 0.08;
        this.obstacles.push(new FallingObstacle(cx, speed));
      }

      this.lastHazardSpawn = 0;
    }
  }

  _ensureCloudContinuity() {
    if (!this.cloudPlatforms.length) {
      return;
    }

    let currentTop = Math.min(...this.cloudPlatforms.map((cloud) => cloud.y));
    const topThreshold = 120;

    while (currentTop > topThreshold) {
      const beforeCount = this.cloudGraph.nodes.length;
      this.cloudGraph.addRowsAbove(1);

      for (let nodeId = beforeCount; nodeId < this.cloudGraph.nodes.length; nodeId += 1) {
        const [cloudX, cloudY] = this.cloudGraph.getNodePosition(nodeId);
        this.cloudPlatforms.push(new CloudPlatform(cloudX, cloudY, nodeId, this.cloudGraph.getRow(nodeId)));
      }

      currentTop = Math.min(...this.cloudPlatforms.map((cloud) => cloud.y));
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

    const altitude = this.frog?.currentCloudRow != null ? Math.max(0, Math.trunc(this.frog.currentCloudRow * 10)) : 0;
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
    this.ctx.fillText(`Score: ${this.obstaclesDodged}   Best: ${this.bestScore}`, width / 2, height / 2 + 40);
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
    this.analytics.data.last_score = this.obstaclesDodged;
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
