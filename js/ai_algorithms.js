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
    const startY = this.groundY - 70;
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

    if (unique.length < 2) {
      const anchor = unique.length ? unique[0] : previousPositions[0];
      const fallback = clamp(anchor + (Math.random() < 0.5 ? -1 : 1) * Math.max(80, Math.floor(this.jumpRange / 2)));
      if (farEnough(fallback, unique)) {
        unique.push(fallback);
      }
    }

    return unique.slice(0, Math.max(2, this.columns)).sort((left, right) => left - right);
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

class BFSSolver {
  isSequenceSurvivable(cloudGraph, route) {
    if (!route || !route.length) {
      return false;
    }

    const goal = route[route.length - 1];
    const visited = new Set([route[0]]);
    const queue = [route[0]];

    while (queue.length) {
      const current = queue.shift();
      if (current === goal) {
        return true;
      }

      for (const neighbor of cloudGraph.getReachableNodes(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  }
}

class IDSSequenceGenerator {
  constructor(cloudGraph) {
    this.cloudGraph = cloudGraph;
    this.bfsSolver = new BFSSolver();
    this.startCloud = cloudGraph.startNode;
  }

  generateSequence(targetDepth, maxAttempts = 30) {
    const maxDepth = Math.min(targetDepth, this.cloudGraph.goalRow);

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const route = this._depthLimitedSearch(depth);
      if (route && this.bfsSolver.isSequenceSurvivable(this.cloudGraph, route)) {
        return this._buildSequence(route);
      }
    }

    const route = this._fallbackRoute();
    return this._buildSequence(route);
  }

  _depthLimitedSearch(depthLimit) {
    const targetRow = Math.min(depthLimit, this.cloudGraph.goalRow);

    const recurse = (nodeId, depthRemaining, path, visited) => {
      if (depthRemaining === 0) {
        if (this.cloudGraph.getRow(nodeId) >= targetRow) {
          return path;
        }
        return null;
      }

      const neighbors = [...this.cloudGraph.getReachableNodes(nodeId)].sort((left, right) => {
        const leftRow = this.cloudGraph.getRow(left);
        const rightRow = this.cloudGraph.getRow(right);
        const center = Math.floor(this.cloudGraph.width / 2);
        const leftDistance = Math.abs(this.cloudGraph.getNodePosition(left)[0] - center);
        const rightDistance = Math.abs(this.cloudGraph.getNodePosition(right)[0] - center);
        return leftRow - rightRow || leftDistance - rightDistance;
      });

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);
        const result = recurse(neighborId, depthRemaining - 1, [...path, neighborId], visited);
        if (result) {
          return result;
        }
        visited.delete(neighborId);
      }

      return null;
    };

    return recurse(this.startCloud, depthLimit, [this.startCloud], new Set([this.startCloud]));
  }

  _buildSequence(route) {
    return {
      route,
      hazards: this._buildHazards(route),
      route_depth: route.length - 1,
    };
  }

  _buildHazards(route) {
    const routeSet = new Set(route);
    const routeTopRow = this.cloudGraph.getRow(route[route.length - 1]);
    const candidates = [];

    for (let nodeId = 0; nodeId < this.cloudGraph.nodes.length; nodeId += 1) {
      if (!routeSet.has(nodeId) && this.cloudGraph.getRow(nodeId) <= routeTopRow) {
        candidates.push(nodeId);
      }
    }

    this._shuffle(candidates);
    const hazards = [];

    const limit = Math.min(candidates.length, Math.max(2, route.length) + 1);
    for (let index = 0; index < limit; index += 1) {
      const nodeId = candidates[index];
      const row = this.cloudGraph.getRow(nodeId);
      const speed = 3.0 + row * 0.45;
      const base = 0.5;
      const spacing = 0.8;
      const jitter = this._randomRange(-0.2, 0.3);
      const spawnTime = Math.max(0.2, Number((base + (index + 1) * spacing + jitter).toFixed(2)));
      hazards.push([nodeId, spawnTime, speed]);
    }

    hazards.sort((left, right) => left[1] - right[1]);
    return hazards;
  }

  _fallbackRoute() {
    const route = [this.startCloud];
    const visited = new Set([this.startCloud]);
    let current = this.startCloud;

    while (this.cloudGraph.getRow(current) < this.cloudGraph.goalRow) {
      const neighbors = this.cloudGraph.getReachableNodes(current);
      let nextNode = null;

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          nextNode = neighbor;
          break;
        }
      }

      if (nextNode === null) {
        break;
      }

      route.push(nextNode);
      visited.add(nextNode);
      current = nextNode;
    }

    return route;
  }

  _shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = this._randomInt(0, index);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }

  _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }
}
