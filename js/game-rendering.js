class CloudCatcherGameRenderingExtensions {
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
    // ground slides down with the camera once the character reaches the center of the screen
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
    const iconStartX = width * 0.34;
    const iconStepX = width * 0.11;
    roster.forEach((hero, index) => {
      const iconX = iconStartX + iconStepX * index;
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
    const cardW = Math.floor((modalW - 56 - cardGap * (roster.length - 1)) / roster.length);
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

    this._drawHeroPanel(width, height, this.selectedCatcher, { showModeOptions: false, dock: "bottom-right" });

    this.selectButtonBounds = null;
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
}

for (const key of Object.getOwnPropertyNames(CloudCatcherGameRenderingExtensions.prototype)) {
  if (key !== "constructor") {
    Object.defineProperty(
      CloudCatcherGame.prototype,
      key,
      Object.getOwnPropertyDescriptor(CloudCatcherGameRenderingExtensions.prototype, key),
    );
  }
}

