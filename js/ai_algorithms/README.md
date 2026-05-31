AI Algorithms: BFS, DLS, IDS
=================================

This folder contains the extracted AI algorithm implementations used by Cloud Catchers.

- `graph.js` — `CloudGraph` builds the layered cloud-node graph used by the algorithms.
- `bfs.js` — `BFSSolver` implements Breadth-First Search (BFS) to validate reachability.
- `dls.js` — `DLSSolver` implements Depth-Limited Search (DLS) used by IDS.
- `ids.js` — `IDSSequenceGenerator` orchestrates Iterative Deepening Search and produces
  the route + hazards used by the game.

Overview of how these pieces connect in the game
------------------------------------------------

1. The game builds a `CloudGraph` describing cloud positions and edges between
   reachable clouds.
2. `IDSSequenceGenerator` is created with that `CloudGraph` and is asked to
   `generateSequence(targetDepth)`. IDS will progressively try depth bounds
   starting at 1 and increasing until `targetDepth` (or the top row) is reached.
3. For each depth bound, IDS delegates the search to `DLSSolver.depthLimitedSearch`.
   If DLS returns a candidate route, IDS validates it using `BFSSolver.isSequenceSurvivable`.
4. If the BFS validation passes the route is accepted, converted into a spawn
   `sequence` (route + hazards) and returned to the game loop. Otherwise IDS
   deepens the search and tries again.

Why split these files?
----------------------
Splitting makes each algorithm module easier to reason about, test, and reuse.
Each file includes comments explaining the start and end of the implementation
so it's straightforward to locate the core logic.

Implementation notes
--------------------
- BFS: simple queue-based exploration to check reachability between nodes in the graph.
- DLS: recursive DFS limited by a depth counter; it prefers neighbors that are
  higher (further rows) and more centered horizontally.
- IDS: wraps DLS and BFS to get the completeness of BFS with the memory-efficiency
  of depth-first exploration by trying increasing depth limits until a usable route
  is found.

If you want, I can:
- Move the `CloudGraph` into a separate module (already done) so the game can
  construct graphs without requiring the monolithic file.
- Convert these into ES modules if you'd prefer `import`/`export` syntax and
  switch `html/index.html` to load modules instead of adding globals.
