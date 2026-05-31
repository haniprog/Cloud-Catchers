class CloudCatcherGameFlowExtensions {
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

    // Algorithm output starts here: create the route/hazard plan that drives the upcoming run.
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

    // Algorithm output ends here: the generated hazards are turned into live falling stars.
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

for (const key of Object.getOwnPropertyNames(CloudCatcherGameFlowExtensions.prototype)) {
  if (key !== "constructor") {
    Object.defineProperty(
      CloudCatcherGame.prototype,
      key,
      Object.getOwnPropertyDescriptor(CloudCatcherGameFlowExtensions.prototype, key),
    );
  }
}

