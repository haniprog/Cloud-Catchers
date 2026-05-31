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
    this.audio = new SoundEffects();
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
    this.audio?.playStart();
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
    // AI-generated route planner used to build the obstacle sequence for this world.
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
      // The same IDS/BFS sequence generator is reused here so level mode still respects the same route rules.
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
        name: "Hannah",
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
        name: "Kristal",
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
        name: "Mariella",
        tagline: "Curious climber",
        emoji: "🐱",
        face: "#ffd46d",
        glowInner: "rgba(255, 241, 179, 0.92)",
        glowMid: "rgba(255, 161, 72, 0.8)",
        glowOuter: "rgba(191, 104, 46, 0.42)",
        shadow: "rgba(255, 180, 92, 0.68)",
      },
      {
        avatarType: "fox",
        name: "Myles",
        tagline: "Quick and sly",
        emoji: "🦊",
        face: "#ffb36b",
        glowInner: "rgba(255, 230, 180, 0.95)",
        glowMid: "rgba(255, 164, 84, 0.82)",
        glowOuter: "rgba(186, 89, 33, 0.42)",
        shadow: "rgba(255, 164, 96, 0.68)",
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
      fox: "Fox",
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
    const dockBottomLeft = panelOptions.dock === "bottom-left";
    const dockBottomRight = panelOptions.dock === "bottom-right";
    const docked = dockBottomLeft || dockBottomRight;
    const compact = docked || width < 1160;
    const panelW = docked ? Math.min(width * 0.26, 300) : (compact ? Math.min(width * 0.86, 750) : Math.min(width * 0.42, 760));
    const panelH = docked ? Math.min(height * 0.20, 166) : (compact ? Math.min(height * 0.58, 410) : Math.min(height * 0.63, 470));
    const panelX1 = dockBottomLeft ? 24 : (dockBottomRight ? Math.floor(width - panelW - 28) : (compact ? Math.floor(width * 0.07) : Math.floor(width - panelW - width * 0.03)));
    const panelY1 = docked ? Math.floor(height - panelH - 28) : (compact ? Math.floor(height * 0.22) : Math.floor(height * 0.18));
    const panelX2 = Math.floor(panelX1 + panelW);
    const panelY2 = Math.floor(panelY1 + panelH);

    this._drawRoundedRect(panelX1, panelY1, panelX2, panelY2, 30, dockBottomLeft ? "rgba(18, 22, 46, 0.78)" : "rgba(27, 33, 71, 0.54)", "rgba(255,255,255,0.16)", 1.5);

    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillStyle = "#f5f3fb";
    this.ctx.font = docked ? "900 16px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif" : "900 22px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
    this.ctx.fillText("Choose your catcher", panelX1 + (docked ? 16 : 28), panelY1 + (docked ? 26 : 46));

    this.ctx.fillStyle = "rgba(216, 224, 240, 0.72)";
    this.ctx.font = docked ? "500 10px 'Segoe UI', Arial, sans-serif" : "500 12px 'Segoe UI', Arial, sans-serif";
    this.ctx.textAlign = "right";
    const heroes = this._getHeroRoster();
    this.ctx.fillText(`${heroes.length} HEROES`, panelX2 - (docked ? 14 : 26), panelY1 + (docked ? 23 : 43));

    if (docked) {
      const cardGap = 8;
      const cardTop = panelY1 + 34;
      const cardW = Math.floor((panelW - 40 - cardGap) / 2);
      const cardH = Math.floor((panelH - 52 - cardGap) / 2);
      const cardsX1 = panelX1 + 14;
      this.selectCardBounds = [];

      heroes.forEach((hero, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x1 = cardsX1 + column * (cardW + cardGap);
        const y1 = cardTop + row * (cardH + cardGap);
        const x2 = x1 + cardW;
        const y2 = y1 + cardH;
        const selected = index === selectedCatcher;
        this.selectCardBounds.push([x1, y1, x2, y2]);
        this._drawRoundedRect(x1, y1, x2, y2, 12, selected ? "rgba(87, 88, 116, 0.96)" : "rgba(255,255,255,0.06)", selected ? "rgba(255,255,255,0.84)" : "rgba(255,255,255,0.12)", 1.1);
        const orbCx = x1 + 18;
        const orbCy = y1 + cardH / 2;
        const orb = this.ctx.createRadialGradient(orbCx - 4, orbCy - 4, 4, orbCx, orbCy, 22);
        orb.addColorStop(0, hero.glowInner);
        orb.addColorStop(0.6, hero.glowMid);
        orb.addColorStop(1, hero.glowOuter);
        this.ctx.save();
        this.ctx.shadowColor = hero.shadow;
        this.ctx.shadowBlur = selected ? 14 : 9;
        this.ctx.fillStyle = orb;
        this.ctx.beginPath();
        this.ctx.arc(orbCx, orbCy, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        this.ctx.font = "16px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText(hero.emoji, orbCx, orbCy + 1);
        this.ctx.fillStyle = "#fbf8ff";
        this.ctx.font = "900 11px 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.fillText(hero.name, x1 + 34, y1 + 18);
      });

      this.selectButtonBounds = null;
      this.modeButtonBounds = null;
      this.levelButtonBounds = null;
      return;
    }

    const cardGap = compact ? 14 : 12;
    const cardY1 = panelY1 + 68;
    const cardH = compact ? Math.min(150, panelH * 0.43) : Math.min(165, panelH * 0.43);
    const cardW = Math.floor((panelW - 56 - cardGap * (heroes.length - 1)) / heroes.length);
    const cardsX1 = panelX1 + 28;
    this.selectCardBounds = [];

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

}
