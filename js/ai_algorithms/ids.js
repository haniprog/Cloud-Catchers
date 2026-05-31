// IDSSequenceGenerator: Iterative Deepening Search orchestrator.
// It uses DLSSolver to attempt increasing depth bounds and BFSSolver
// to validate that the candidate route is truly reachable in the graph.
// Start: IDSSequenceGenerator class definition
// End: IDSSequenceGenerator class definition
class IDSSequenceGenerator {
  constructor(cloudGraph) {
    this.cloudGraph = cloudGraph;
    this.bfsSolver = new BFSSolver();
    this.dlsSolver = new DLSSolver();
    this.startCloud = cloudGraph.startNode;
  }

  // Attempt progressive depth bounds until a survivable route is found.
  generateSequence(targetDepth, maxAttempts = 30) {
    const maxDepth = Math.min(targetDepth, this.cloudGraph.goalRow);

    // IDS starts here: try depth 1, then 2, then deeper until targetDepth
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const route = this._depthLimitedSearch(depth);
      if (route && this.bfsSolver.isSequenceSurvivable(this.cloudGraph, route)) {
        return this._buildSequence(route);
      }
    }

    // IDS ends with a fallback route if no depth-limited route survives
    const route = this._fallbackRoute();
    return this._buildSequence(route);
  }

  _depthLimitedSearch(depthLimit) {
    // delegate core DLS logic to DLSSolver
    return this.dlsSolver.depthLimitedSearch(this.cloudGraph, this.startCloud, depthLimit);
  }

  _buildSequence(route) {
    // Convert accepted route into the spawn sequence used by the game
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

window.IDSSequenceGenerator = IDSSequenceGenerator;
