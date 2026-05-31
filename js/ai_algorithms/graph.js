// CloudGraph: constructs a layered graph of cloud nodes used by the AI
// Start: CloudGraph class definition
// End: CloudGraph class definition
class CloudGraph {
  constructor(width, groundY, rows = 7, columns = 4, rowGap = 68, jumpRange = 185) {
    this.width = width;
    this.groundY = groundY;
    this.rows = rows;
    this.columns = columns;
    this.rowGap = rowGap;
    this.jumpRange = jumpRange;
    this.nodes = [];
    this.rowLookup = {};
    this.rowNodes = [];
    this.rowLayouts = [];
    this.edges = [];

    this._generateNodes();
    this._buildEdges();
  }

  _generateNodes() {
    // keep the first cloud row well above the ground band
    const startY = this.groundY - 110;
    this.nodes.push([Math.floor(this.width / 2), startY]);
    this.rowLookup[0] = 0;
    this.rowNodes.push([0]);
    this.rowLayouts.push([Math.floor(this.width / 2)]);

    let nodeId = 1;
    let previousPositions = [Math.floor(this.width / 2)];

    for (let row = 1; row < this.rows; row += 1) {
      const y = startY - row * this.rowGap;
      const rowNodes = [];
      const placedX = this._makeScatteredPositions(previousPositions);
      previousPositions = [...placedX];
      this.rowLayouts.push(placedX);

      for (const x of placedX) {
        this.nodes.push([x, y]);
        this.rowLookup[nodeId] = row;
        rowNodes.push(nodeId);
        nodeId += 1;
      }

      this.rowNodes.push(rowNodes);
    }
  }

  _buildEdges() {
    this.edges = Array.from({ length: this.nodes.length }, () => []);

    for (let row = 0; row < this.rows - 1; row += 1) {
      for (const nodeId of this.rowNodes[row]) {
        const [x1] = this.nodes[nodeId];
        const nextRow = row + 1;
        if (nextRow >= this.rows) {
          continue;
        }

        for (const neighborId of this.rowNodes[nextRow]) {
          const [x2] = this.nodes[neighborId];
          if (Math.abs(x2 - x1) <= this.jumpRange) {
            this.edges[nodeId].push(neighborId);
          }
        }
      }
    }
  }

  addRowsAbove(count = 1) {
    for (let index = 0; index < count; index += 1) {
      const topY = Math.min(...this.nodes.map((node) => node[1]));
      const y = topY - this.rowGap;
      const newRowIndex = this.rowNodes.length;
      const previousPositions = this.rowLayouts.length ? this.rowLayouts[this.rowLayouts.length - 1] : [Math.floor(this.width / 2)];
      const placedX = this._makeScatteredPositions(previousPositions);
      this.rowLayouts.push(placedX);
      const rowNodes = [];

      for (const x of placedX) {
        const nodeId = this.nodes.length;
        this.nodes.push([x, y]);
        this.rowLookup[nodeId] = newRowIndex;
        rowNodes.push(nodeId);
      }

      this.rowNodes.push(rowNodes);
    }

    this._buildEdges();
  }

  _makeScatteredPositions(previousPositions) {
    const margin = 60;
    const allowedMin = margin;
    const allowedMax = this.width - margin;
    const minSpacing = 85;

    const reachable = (xValue) => previousPositions.some((previousX) => Math.abs(xValue - previousX) <= this.jumpRange);
    const clamp = (xValue) => Math.max(allowedMin, Math.min(allowedMax, Math.trunc(xValue)));
    const farEnough = (candidate, positions) => positions.every((existing) => Math.abs(candidate - existing) >= minSpacing);

    const positions = [];
    const row = this.rowLayouts.length;

    if (this.columns === 1 && previousPositions.length === 1) {
      const parentX = previousPositions[0];
      const maxShift = Math.max(80, Math.floor(this.jumpRange * 0.75));
      const minShift = Math.min(maxShift - 20, Math.max(40, Math.floor(maxShift * 0.45)));
      const preferredDirection = row % 2 === 0 ? -1 : 1;
      const direction = Math.random() < 0.75 ? preferredDirection : -preferredDirection;
      const edgeBias = Math.random() < 0.35 ? (direction * this._randomInt(12, 40)) : 0;
      const shift = this._randomInt(minShift, maxShift);
      const candidate = clamp(parentX + direction * shift + edgeBias);
      return [candidate];
    }

    for (const parentX of previousPositions) {
      let candidate = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const delta = this._randomInt(-(this.jumpRange - 45), this.jumpRange - 45);
        const trial = clamp(parentX + delta);
        if (reachable(trial) && farEnough(trial, positions)) {
          candidate = trial;
          break;
        }
      }

      if (candidate === null) {
        const direction = Math.random() < 0.5 ? -1 : 1;
        candidate = clamp(parentX + direction * Math.max(60, Math.floor(this.jumpRange / 2) - 15));
      }

      if (farEnough(candidate, positions)) {
        positions.push(candidate);
      }
    }

    const targetCount = this._randomInt(Math.max(2, previousPositions.length), Math.max(2, this.columns));
    let attempts = 0;
    while (positions.length < targetCount && attempts < 200) {
      attempts += 1;
      let candidate;

      if (Math.random() < 0.5) {
        const parentX = previousPositions[this._randomInt(0, previousPositions.length - 1)];
        candidate = clamp(parentX + this._randomInt(-(this.jumpRange - 45), this.jumpRange - 45));
      } else {
        candidate = this._randomInt(allowedMin, allowedMax);
      }

      if (!reachable(candidate)) {
        const nearestPrev = previousPositions.reduce((best, current) => Math.abs(current - candidate) < Math.abs(best - candidate) ? current : best, previousPositions[0]);
        const direction = candidate > nearestPrev ? -1 : 1;
        candidate = clamp(nearestPrev + direction * this._randomInt(55, Math.max(60, this.jumpRange - 35)));
      }

      if (farEnough(candidate, positions)) {
        positions.push(candidate);
      }
    }

    const unique = [...new Set(positions.map((position) => Math.trunc(position)))].sort((left, right) => left - right);

    if (unique.length < Math.max(1, this.columns)) {
      const anchor = unique.length ? unique[0] : previousPositions[0];
      const fallback = clamp(anchor + (Math.random() < 0.5 ? -1 : 1) * Math.max(80, Math.floor(this.jumpRange / 2)));
      if (farEnough(fallback, unique)) {
        unique.push(fallback);
      }
    }

    return unique.slice(0, Math.max(1, this.columns)).sort((left, right) => left - right);
  }

  _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getNodePosition(nodeId) {
    return this.nodes[nodeId];
  }

  getReachableNodes(nodeId) {
    return this.edges[nodeId] || [];
  }

  getRow(nodeId) {
    return this.rowLookup[nodeId];
  }

  get startNode() {
    return 0;
  }

  get goalRow() {
    return this.rows - 1;
  }
}

// expose to global scope so non-module code can use it
window.CloudGraph = CloudGraph;
