/**
 * Skill-tree graph definition for DSA and CS theory tracks.
 *
 * Each node represents a learnable topic area. Nodes have:
 *   - prerequisite relationships (DAG — no cycles)
 *   - links to canonical topic IDs (from cs-topics.ts)
 *   - links to free-form card tags (from problem-lists.ts / user cards)
 *
 * The visual skill-tree component (Phase 11) will use this data
 * to render interactive graphs with mastery-based coloring.
 */

// ── Types ───────────────────────────────────────────────────────

export type SkillTreeDomain = "dsa" | "cs";

export type SkillNodeState =
  | "locked"       // prerequisites not met
  | "available"    // unlocked but no cards yet
  | "active"       // has cards, being worked on
  | "weak"         // has cards but poor retention
  | "stable"       // good retention
  | "mastered";    // high retention over time

export interface SkillTreeNode {
  /** Unique node ID within the tree */
  id: string;
  /** Human-readable label */
  label: string;
  /** Which tree this node belongs to */
  domain: SkillTreeDomain;
  /** Node IDs that must be "available" or better before this unlocks */
  prerequisiteNodeIds: string[];
  /** Canonical topic IDs from cs-topics.ts (for CS nodes) */
  linkedTopicIds: string[];
  /** Free-form tags that map cards to this node */
  linkedTags: string[];
  /** Optional short description for hover tooltips */
  description?: string;
}

// ── DSA Skill Tree ──────────────────────────────────────────────

export const DSA_SKILL_TREE: SkillTreeNode[] = [
  // ── Foundation ──
  {
    id: "dsa.arrays-hashing",
    label: "Arrays & Hashing",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["Array", "Hash Table"],
    description: "Array traversal, hash map lookups, frequency counting.",
  },
  {
    id: "dsa.strings",
    label: "Strings",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["String"],
    description: "String manipulation, pattern matching, encoding.",
  },
  {
    id: "dsa.math",
    label: "Math & Geometry",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["Math", "Matrix"],
    description: "Number theory, modular arithmetic, matrix operations.",
  },
  {
    id: "dsa.bit-manipulation",
    label: "Bit Manipulation",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["Bit Manipulation"],
    description: "Bitwise operations, XOR tricks, bit masking.",
  },
  {
    id: "dsa.linked-list",
    label: "Linked Lists",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["Linked List"],
    description: "Singly/doubly linked lists, pointer manipulation.",
  },
  {
    id: "dsa.recursion",
    label: "Recursion",
    domain: "dsa",
    prerequisiteNodeIds: [],
    linkedTopicIds: [],
    linkedTags: ["Recursion"],
    description: "Recursive thinking, base cases, call stack.",
  },

  // ── Level 1 — Requires foundations ──
  {
    id: "dsa.two-pointers",
    label: "Two Pointers",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing"],
    linkedTopicIds: [],
    linkedTags: ["Two Pointers"],
    description: "Converging/diverging pointer techniques on sorted data.",
  },
  {
    id: "dsa.stack",
    label: "Stack",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing"],
    linkedTopicIds: [],
    linkedTags: ["Stack"],
    description: "LIFO operations, monotonic stacks, expression parsing.",
  },
  {
    id: "dsa.binary-search",
    label: "Binary Search",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing"],
    linkedTopicIds: [],
    linkedTags: ["Binary Search"],
    description: "Search on sorted data, search space reduction.",
  },
  {
    id: "dsa.greedy",
    label: "Greedy",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing"],
    linkedTopicIds: [],
    linkedTags: ["Greedy"],
    description: "Locally optimal choices, greedy proofs.",
  },

  // ── Level 2 ──
  {
    id: "dsa.sliding-window",
    label: "Sliding Window",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing", "dsa.two-pointers"],
    linkedTopicIds: [],
    linkedTags: ["Sliding Window"],
    description: "Fixed and variable-size window techniques.",
  },
  {
    id: "dsa.prefix-sum",
    label: "Prefix Sum",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing"],
    linkedTopicIds: [],
    linkedTags: ["Prefix Sum"],
    description: "Cumulative sums for range query optimization.",
  },
  {
    id: "dsa.intervals",
    label: "Intervals",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing", "dsa.greedy"],
    linkedTopicIds: [],
    linkedTags: ["Intervals"],
    description: "Merge, insert, and schedule interval problems.",
  },
  {
    id: "dsa.trees",
    label: "Trees",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.recursion"],
    linkedTopicIds: [],
    linkedTags: ["Tree", "DFS", "BFS"],
    description: "Binary trees, traversals (inorder, preorder, postorder, level-order).",
  },
  {
    id: "dsa.backtracking",
    label: "Backtracking",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.recursion"],
    linkedTopicIds: [],
    linkedTags: ["Backtracking"],
    description: "Exhaustive search with pruning.",
  },
  {
    id: "dsa.dp-1d",
    label: "Dynamic Programming (1D)",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.recursion"],
    linkedTopicIds: [],
    linkedTags: ["DP"],
    description: "Optimal substructure, memoization, tabulation.",
  },

  // ── Level 3 ──
  {
    id: "dsa.bst",
    label: "Binary Search Trees",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.trees"],
    linkedTopicIds: [],
    linkedTags: ["BST"],
    description: "BST properties, balanced trees, AVL/Red-Black basics.",
  },
  {
    id: "dsa.heap",
    label: "Heap / Priority Queue",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.arrays-hashing", "dsa.trees"],
    linkedTopicIds: [],
    linkedTags: ["Heap"],
    description: "Min/max heaps, top-K problems, heap sort.",
  },
  {
    id: "dsa.trie",
    label: "Tries",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.trees", "dsa.strings"],
    linkedTopicIds: [],
    linkedTags: ["Trie"],
    description: "Prefix trees for string search and autocomplete.",
  },
  {
    id: "dsa.graphs",
    label: "Graphs",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.trees", "dsa.recursion"],
    linkedTopicIds: [],
    linkedTags: ["Graph", "BFS", "DFS"],
    description: "Graph traversal (BFS/DFS), representations, connectivity.",
  },
  {
    id: "dsa.dp-2d",
    label: "Dynamic Programming (2D)",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.dp-1d"],
    linkedTopicIds: [],
    linkedTags: ["DP"],
    description: "2D tables, grid DP, subsequence problems.",
  },

  // ── Level 4 — Advanced ──
  {
    id: "dsa.topological-sort",
    label: "Topological Sort",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.graphs"],
    linkedTopicIds: [],
    linkedTags: ["Topological Sort"],
    description: "Ordering DAG nodes, cycle detection, Kahn's algorithm.",
  },
  {
    id: "dsa.union-find",
    label: "Union Find",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.graphs"],
    linkedTopicIds: [],
    linkedTags: ["Union Find"],
    description: "Disjoint set union, path compression, union by rank.",
  },
  {
    id: "dsa.shortest-path",
    label: "Shortest Path",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.graphs"],
    linkedTopicIds: [],
    linkedTags: ["Graph", "BFS", "Dijkstra"],
    description: "Dijkstra, Bellman-Ford, Floyd-Warshall algorithms.",
  },
  {
    id: "dsa.segment-tree",
    label: "Segment Tree / BIT",
    domain: "dsa",
    prerequisiteNodeIds: ["dsa.trees", "dsa.prefix-sum"],
    linkedTopicIds: [],
    linkedTags: ["Segment Tree", "Binary Indexed Tree"],
    description: "Range queries with efficient updates.",
  },
];

// ── CS Theory Skill Tree ────────────────────────────────────────

export const CS_SKILL_TREE: SkillTreeNode[] = [
  // ── OS Track ──
  {
    id: "cs.os-processes",
    label: "Processes & Threads",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["os.processes", "os.threads"],
    linkedTags: ["OS", "Processes", "Threads"],
    description: "Process lifecycle, threading models, IPC.",
  },
  {
    id: "cs.os-sync",
    label: "Synchronization & Deadlocks",
    domain: "cs",
    prerequisiteNodeIds: ["cs.os-processes"],
    linkedTopicIds: ["os.synchronization", "os.deadlocks"],
    linkedTags: ["OS", "Synchronization", "Deadlocks"],
    description: "Mutexes, semaphores, deadlock prevention.",
  },
  {
    id: "cs.os-scheduling",
    label: "CPU Scheduling",
    domain: "cs",
    prerequisiteNodeIds: ["cs.os-processes"],
    linkedTopicIds: ["os.scheduling"],
    linkedTags: ["OS", "Scheduling"],
    description: "Scheduling algorithms and preemption.",
  },
  {
    id: "cs.os-memory",
    label: "Memory & Virtual Memory",
    domain: "cs",
    prerequisiteNodeIds: ["cs.os-processes"],
    linkedTopicIds: ["os.memory-management", "os.virtual-memory", "os.paging"],
    linkedTags: ["OS", "Memory"],
    description: "Paging, segmentation, page replacement algorithms.",
  },
  {
    id: "cs.os-filesystems",
    label: "File Systems & I/O",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["os.file-systems", "os.io"],
    linkedTags: ["OS", "File Systems"],
    description: "File organization, disk scheduling, I/O.",
  },

  // ── CN Track ──
  {
    id: "cs.cn-fundamentals",
    label: "Networking Fundamentals",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["cn.osi-model", "cn.physical-layer", "cn.network-layer"],
    linkedTags: ["Networking", "OSI"],
    description: "OSI/TCP-IP models, IP addressing, routing.",
  },
  {
    id: "cs.cn-transport",
    label: "Transport Layer",
    domain: "cs",
    prerequisiteNodeIds: ["cs.cn-fundamentals"],
    linkedTopicIds: ["cn.transport-layer"],
    linkedTags: ["Networking", "TCP", "UDP"],
    description: "TCP, UDP, flow control, congestion control.",
  },
  {
    id: "cs.cn-application",
    label: "DNS, HTTP & Application Layer",
    domain: "cs",
    prerequisiteNodeIds: ["cs.cn-transport"],
    linkedTopicIds: ["cn.dns", "cn.http", "cn.sockets"],
    linkedTags: ["Networking", "HTTP", "DNS"],
    description: "DNS resolution, HTTP protocol, socket programming.",
  },
  {
    id: "cs.cn-security",
    label: "Network Security",
    domain: "cs",
    prerequisiteNodeIds: ["cs.cn-application"],
    linkedTopicIds: ["cn.network-security"],
    linkedTags: ["Networking", "Security"],
    description: "Encryption, TLS, firewalls, common attacks.",
  },

  // ── DBMS Track ──
  {
    id: "cs.dbms-fundamentals",
    label: "SQL & Relational Model",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["dbms.relational-model", "dbms.sql", "dbms.normalization"],
    linkedTags: ["Database", "SQL"],
    description: "ER modeling, normalization, SQL queries.",
  },
  {
    id: "cs.dbms-transactions",
    label: "Transactions & Indexing",
    domain: "cs",
    prerequisiteNodeIds: ["cs.dbms-fundamentals"],
    linkedTopicIds: ["dbms.acid", "dbms.indexing"],
    linkedTags: ["Database", "Transactions"],
    description: "ACID properties, B-Tree indexes, query optimization.",
  },
  {
    id: "cs.dbms-advanced",
    label: "Concurrency & NoSQL",
    domain: "cs",
    prerequisiteNodeIds: ["cs.dbms-transactions"],
    linkedTopicIds: ["dbms.concurrency", "dbms.nosql"],
    linkedTags: ["Database", "NoSQL"],
    description: "MVCC, isolation levels, document/key-value stores.",
  },

  // ── OOP Track ──
  {
    id: "cs.oop",
    label: "OOP & SOLID",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["oop.fundamentals", "oop.inheritance-polymorphism", "oop.solid"],
    linkedTags: ["OOP", "SOLID"],
    description: "Core OOP concepts and SOLID principles.",
  },
  {
    id: "cs.design-patterns",
    label: "Design Patterns",
    domain: "cs",
    prerequisiteNodeIds: ["cs.oop"],
    linkedTopicIds: ["oop.design-patterns"],
    linkedTags: ["Design Patterns"],
    description: "Creational, structural, behavioral patterns.",
  },

  // ── System Design Track ──
  {
    id: "cs.sd-basics",
    label: "System Design Basics",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["sd.fundamentals", "sd.api-design"],
    linkedTags: ["System Design"],
    description: "Scalability concepts, API design, estimations.",
  },
  {
    id: "cs.sd-scaling",
    label: "Scaling & Load Balancing",
    domain: "cs",
    prerequisiteNodeIds: ["cs.sd-basics"],
    linkedTopicIds: ["sd.load-balancing", "sd.caching", "sd.cdn", "sd.rate-limiting"],
    linkedTags: ["System Design", "Load Balancing", "Caching"],
    description: "Horizontal scaling, caching strategies, CDN, rate limiting.",
  },
  {
    id: "cs.sd-data",
    label: "Data Layer Design",
    domain: "cs",
    prerequisiteNodeIds: ["cs.sd-basics", "cs.dbms-fundamentals"],
    linkedTopicIds: ["sd.databases", "sd.cap-theorem"],
    linkedTags: ["System Design", "Database", "Sharding"],
    description: "Sharding, replication, CAP theorem, consistency models.",
  },
  {
    id: "cs.sd-distributed",
    label: "Distributed Systems",
    domain: "cs",
    prerequisiteNodeIds: ["cs.sd-scaling"],
    linkedTopicIds: ["sd.message-queues", "sd.microservices"],
    linkedTags: ["System Design", "Microservices"],
    description: "Message queues, microservices, event-driven architecture.",
  },

  // ── Web Track ──
  {
    id: "cs.web-apis",
    label: "Web APIs & Auth",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["web.rest", "web.auth", "web.graphql"],
    linkedTags: ["REST", "Auth", "GraphQL"],
    description: "REST design, JWT/OAuth, GraphQL.",
  },
  {
    id: "cs.web-realtime",
    label: "Real-Time & Browser",
    domain: "cs",
    prerequisiteNodeIds: ["cs.web-apis"],
    linkedTopicIds: ["web.websockets", "web.browser"],
    linkedTags: ["WebSockets", "Browser"],
    description: "WebSockets, SSE, browser event loop, rendering.",
  },

  // ── DevOps Track ──
  {
    id: "cs.devops-docker",
    label: "Docker & CI/CD",
    domain: "cs",
    prerequisiteNodeIds: [],
    linkedTopicIds: ["devops.docker", "devops.cicd"],
    linkedTags: ["Docker", "CI/CD"],
    description: "Containerization, pipelines, deployment strategies.",
  },
  {
    id: "cs.devops-k8s",
    label: "Kubernetes & Monitoring",
    domain: "cs",
    prerequisiteNodeIds: ["cs.devops-docker"],
    linkedTopicIds: ["devops.kubernetes", "devops.monitoring", "devops.cloud"],
    linkedTags: ["Kubernetes", "Cloud", "Monitoring"],
    description: "Orchestration, observability, cloud platforms.",
  },
];

// ── Combined export ─────────────────────────────────────────────

export const SKILL_TREE: SkillTreeNode[] = [
  ...DSA_SKILL_TREE,
  ...CS_SKILL_TREE,
];

// ── Helper Functions ────────────────────────────────────────────

/** Get all nodes for a given domain */
export function getSkillTreeByDomain(domain: SkillTreeDomain): SkillTreeNode[] {
  return SKILL_TREE.filter((n) => n.domain === domain);
}

/** Lookup a single node by ID */
export function getNodeById(nodeId: string): SkillTreeNode | undefined {
  return SKILL_TREE.find((n) => n.id === nodeId);
}

/** Get all prerequisite nodes for a given node ID */
export function getPrerequisites(nodeId: string): SkillTreeNode[] {
  const node = getNodeById(nodeId);
  if (!node) return [];
  return node.prerequisiteNodeIds
    .map((id) => getNodeById(id))
    .filter((n): n is SkillTreeNode => n != null);
}

/** Get all nodes that depend on the given node */
export function getDependents(nodeId: string): SkillTreeNode[] {
  return SKILL_TREE.filter((n) => n.prerequisiteNodeIds.includes(nodeId));
}

/** Get all nodes that have no prerequisites (root nodes) */
export function getRootNodes(domain?: SkillTreeDomain): SkillTreeNode[] {
  const nodes = domain ? getSkillTreeByDomain(domain) : SKILL_TREE;
  return nodes.filter((n) => n.prerequisiteNodeIds.length === 0);
}

/**
 * Returns nodes in topological order (prerequisites before dependents).
 * Useful for rendering the tree top-to-bottom.
 */
export function getTopologicalOrder(domain?: SkillTreeDomain): SkillTreeNode[] {
  const nodes = domain ? getSkillTreeByDomain(domain) : SKILL_TREE;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: SkillTreeNode[] = [];

  function visit(node: SkillTreeNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    for (const prereqId of node.prerequisiteNodeIds) {
      const prereq = nodeMap.get(prereqId);
      if (prereq) visit(prereq);
    }

    result.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}
