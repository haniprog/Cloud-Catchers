"""
AI search layer for Cloud Catchers.

This module contains the three classical algorithms requested for the game:
- IDS: builds a short playable ascent route by increasing the search depth.
- DLS: performs the bounded traversal used by IDS.
- BFS: validates that the generated route is actually reachable.
"""

import random
from collections import deque


class CloudGraph:
    """
    Graph of cloud platforms arranged as an upward path network.

    Nodes are stored row-by-row from the starting cloud upward so the frog can
    climb vertically through the level.
    """

    def __init__(self, width, ground_y, rows=7, columns=4, row_gap=68, jump_range=185):
        self.width = width
        self.ground_y = ground_y
        self.rows = rows
        self.columns = columns
        self.row_gap = row_gap
        self.jump_range = jump_range
        self.nodes = []
        self.row_lookup = {}
        self.row_nodes = []
        self.row_layouts = []
        self.edges = []

        self._generate_nodes()
        self._build_edges()

    def _generate_nodes(self):
        start_y = self.ground_y - 70

        # Row 0 is the starting cloud the frog begins on.
        self.nodes.append((self.width // 2, start_y))
        self.row_lookup[0] = 0
        self.row_nodes.append([0])
        self.row_layouts.append([self.width // 2])

        node_id = 1
        previous_positions = [self.width // 2]

        # Create each row as a scattered set of clouds, similar to Doodle Jump.
        for row in range(1, self.rows):
            y = start_y - row * self.row_gap
            row_nodes = []

            placed_x = self._make_scattered_positions(previous_positions)
            previous_positions = placed_x[:]
            self.row_layouts.append(placed_x)

            for x in placed_x:
                self.nodes.append((x, y))
                self.row_lookup[node_id] = row
                row_nodes.append(node_id)
                node_id += 1

            self.row_nodes.append(row_nodes)

    def _build_edges(self):
        self.edges = [[] for _ in range(len(self.nodes))]

        for row in range(self.rows - 1):
            for node_id in self.row_nodes[row]:
                x1, _ = self.nodes[node_id]

                # Allow jumps only to the immediate next row above.
                next_row = row + 1
                if next_row < self.rows:
                    for neighbor_id in self.row_nodes[next_row]:
                        x2, _ = self.nodes[neighbor_id]
                        if abs(x2 - x1) <= self.jump_range:
                            self.edges[node_id].append(neighbor_id)

    def add_rows_above(self, count=1):
        """Grow the cloud graph upward by adding new random rows above the current top."""
        for _ in range(count):
            top_y = min(y for _, y in self.nodes)
            y = top_y - self.row_gap
            new_row_index = len(self.row_nodes)
            previous_positions = self.row_layouts[-1] if self.row_layouts else [self.width // 2]
            placed_x = self._make_scattered_positions(previous_positions)
            self.row_layouts.append(placed_x)
            row_nodes = []

            for x in placed_x:
                node_id = len(self.nodes)
                self.nodes.append((x, y))
                self.row_lookup[node_id] = new_row_index
                row_nodes.append(node_id)

            self.row_nodes.append(row_nodes)

        # Rebuild adjacency so new rows can be used immediately.
        self._build_edges()

    def _make_scattered_positions(self, previous_positions):
        """Create scattered cloud positions for the next row while preserving reachability."""
        margin = 60
        allowed_min = margin
        allowed_max = self.width - margin
        min_spacing = 85

        def reachable(x_value):
            return any(abs(x_value - previous_x) <= self.jump_range for previous_x in previous_positions)

        def clamp(x_value):
            return max(allowed_min, min(allowed_max, int(x_value)))

        def far_enough(candidate, positions):
            return all(abs(candidate - existing) >= min_spacing for existing in positions)

        positions = []

        # Guarantee one reachable child for every cloud in the row below.
        for parent_x in previous_positions:
            candidate = None
            for _ in range(20):
                delta = random.randint(-(self.jump_range - 45), self.jump_range - 45)
                trial = clamp(parent_x + delta)
                if reachable(trial) and far_enough(trial, positions):
                    candidate = trial
                    break

            if candidate is None:
                direction = -1 if random.random() < 0.5 else 1
                candidate = clamp(parent_x + direction * max(60, self.jump_range // 2 - 15))

            if far_enough(candidate, positions):
                positions.append(candidate)

        # Add a few extra scattered clouds, but keep them reachable from the row below.
        target_count = random.randint(max(2, len(previous_positions)), max(2, self.columns))
        attempts = 0
        while len(positions) < target_count and attempts < 200:
            attempts += 1
            if random.random() < 0.5:
                parent_x = random.choice(previous_positions)
                candidate = clamp(parent_x + random.randint(-(self.jump_range - 45), self.jump_range - 45))
            else:
                candidate = random.randint(allowed_min, allowed_max)

            if not reachable(candidate):
                nearest_prev = min(previous_positions, key=lambda previous_x: abs(previous_x - candidate))
                direction = -1 if candidate > nearest_prev else 1
                candidate = clamp(nearest_prev + direction * random.randint(55, max(60, self.jump_range - 35)))

            if far_enough(candidate, positions):
                positions.append(candidate)

        positions = sorted(dict.fromkeys(int(position) for position in positions))

        # Keep at least two clouds so the climb feels continuous.
        if len(positions) < 2:
            anchor = positions[0] if positions else previous_positions[0]
            fallback = clamp(anchor + random.choice([-1, 1]) * max(80, self.jump_range // 2))
            if far_enough(fallback, positions):
                positions.append(fallback)

        return sorted(positions[:max(2, self.columns)])

    def get_node_position(self, node_id):
        return self.nodes[node_id]

    def get_reachable_nodes(self, node_id):
        return self.edges[node_id]

    def get_row(self, node_id):
        return self.row_lookup[node_id]

    @property
    def start_node(self):
        return 0

    @property
    def goal_row(self):
        return self.rows - 1


class BFSSolver:
    """
    BFS validation layer.

    The generated route is accepted only when BFS can confirm the frog can
    still reach the target cloud chain in the cloud graph.
    """

    def is_sequence_survivable(self, cloud_graph, route):
        if not route:
            return False

        goal = route[-1]
        visited = {route[0]}
        queue = deque([route[0]])

        while queue:
            current = queue.popleft()
            if current == goal:
                return True

            for neighbor in cloud_graph.get_reachable_nodes(current):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        return False


class IDSSequenceGenerator:
    """
    IDS controller for building short playable ascents.

    IDS increases the allowed depth one step at a time, DLS performs the
    bounded search at each depth, and BFS validates the final candidate.
    """

    def __init__(self, cloud_graph):
        self.cloud_graph = cloud_graph
        self.bfs_solver = BFSSolver()
        self.start_cloud = cloud_graph.start_node

    def generate_sequence(self, target_depth, max_attempts=30):
        max_depth = min(target_depth, self.cloud_graph.goal_row)

        # IDS implementation: keep increasing the depth limit until a route is found.
        for depth in range(1, max_depth + 1):
            route = self._depth_limited_search(depth)
            if route and self.bfs_solver.is_sequence_survivable(self.cloud_graph, route):
                return self._build_sequence(route)

        # Fallback sequence used only when the search space is unusually tight.
        route = self._fallback_route()
        return self._build_sequence(route)

    def _depth_limited_search(self, depth_limit):
        target_row = min(depth_limit, self.cloud_graph.goal_row)

        # DLS implementation: explore only up to the current depth limit.
        def recurse(node_id, depth_remaining, path, visited):
            if depth_remaining == 0:
                if self.cloud_graph.get_row(node_id) >= target_row:
                    return path
                return None

            neighbors = sorted(
                self.cloud_graph.get_reachable_nodes(node_id),
                key=lambda neighbor_id: (
                    self.cloud_graph.get_row(neighbor_id),
                    abs(self.cloud_graph.get_node_position(neighbor_id)[0] - self.cloud_graph.width // 2),
                ),
            )

            for neighbor_id in neighbors:
                if neighbor_id in visited:
                    continue
                visited.add(neighbor_id)
                result = recurse(neighbor_id, depth_remaining - 1, path + [neighbor_id], visited)
                if result:
                    return result
                visited.remove(neighbor_id)

            return None

        return recurse(self.start_cloud, depth_limit, [self.start_cloud], {self.start_cloud})

    def _build_sequence(self, route):
        hazards = self._build_hazards(route)
        return {
            "route": route,
            "hazards": hazards,
            "route_depth": len(route) - 1,
        }

    def _build_hazards(self, route):
        route_set = set(route)
        route_top_row = self.cloud_graph.get_row(route[-1])
        candidates = [
            node_id
            for node_id in range(len(self.cloud_graph.nodes))
            if node_id not in route_set and self.cloud_graph.get_row(node_id) <= route_top_row
        ]

        random.shuffle(candidates)
        hazards = []

        # Create more overlapping hazards early so at least two hazards appear
        for index, node_id in enumerate(candidates[: max(2, len(route)) + 1], start=1):
            row = self.cloud_graph.get_row(node_id)
            speed = 3.0 + row * 0.45
            # Spawn times biased toward early overlap; small randomness added
            base = 0.5
            spacing = 0.8
            jitter = random.uniform(-0.2, 0.3)
            spawn_time = max(0.2, round(base + index * spacing + jitter, 2))
            hazards.append((node_id, spawn_time, speed))

        hazards.sort(key=lambda item: item[1])
        return hazards

    def _fallback_route(self):
        route = [self.start_cloud]
        current = self.start_cloud
        visited = {self.start_cloud}

        while self.cloud_graph.get_row(current) < self.cloud_graph.goal_row:
            neighbors = self.cloud_graph.get_reachable_nodes(current)
            next_node = None
            for neighbor in neighbors:
                if neighbor not in visited:
                    next_node = neighbor
                    break

            if next_node is None:
                break

            route.append(next_node)
            visited.add(next_node)
            current = next_node

        return route