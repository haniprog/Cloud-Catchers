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