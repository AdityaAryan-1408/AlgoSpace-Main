/**
 * Canonical CS / Theory / Full-Stack topic registry.
 *
 * Each entry has a stable dot-notation `id` used by:
 *   - cards.topic_ids          (Phase 1)
 *   - goal_topic_items         (Phase 4)
 *   - skill-tree linkedTopicIds (this file's sibling, skill-tree.ts)
 *   - weakness engine           (Phase 3)
 *
 * Adding or removing entries is safe — nothing references these at
 * the database level by foreign key; they are matched by string value.
 */

import type { TopicDomain } from "@/types";

// ── Types ───────────────────────────────────────────────────────

export interface CsTopic {
  /** Canonical dot-notation ID, e.g. "os.threads" */
  id: string;
  /** Parent domain — matches TopicDomain from types */
  domain: TopicDomain;
  /** Human-readable short name */
  label: string;
  /** One-line description */
  description: string;
  /** Optional sub-concepts (display only, not IDs) */
  subtopics?: string[];
}

// ── Operating Systems ───────────────────────────────────────────

const OS_TOPICS: CsTopic[] = [
  {
    id: "os.processes",
    domain: "cs",
    label: "Processes",
    description: "Process lifecycle, creation, termination, IPC mechanisms.",
    subtopics: ["Fork", "Exec", "Pipes", "Shared Memory", "Signals"],
  },
  {
    id: "os.threads",
    domain: "cs",
    label: "Threads",
    description: "User vs kernel threads, multithreading models, thread safety.",
    subtopics: ["Pthreads", "Green Threads", "Thread Pool", "Race Conditions"],
  },
  {
    id: "os.scheduling",
    domain: "cs",
    label: "CPU Scheduling",
    description: "Scheduling algorithms and criteria for process/thread execution.",
    subtopics: ["FCFS", "SJF", "Round Robin", "Priority Scheduling", "Multilevel Queue"],
  },
  {
    id: "os.synchronization",
    domain: "cs",
    label: "Synchronization",
    description: "Mechanisms to coordinate concurrent access to shared resources.",
    subtopics: ["Mutex", "Semaphore", "Monitor", "Spinlock", "Condition Variable"],
  },
  {
    id: "os.deadlocks",
    domain: "cs",
    label: "Deadlocks",
    description: "Conditions, prevention, avoidance, detection, and recovery.",
    subtopics: ["Banker's Algorithm", "Resource Allocation Graph", "Coffman Conditions"],
  },
  {
    id: "os.memory-management",
    domain: "cs",
    label: "Memory Management",
    description: "Memory allocation strategies and management techniques.",
    subtopics: ["Contiguous Allocation", "Fragmentation", "Compaction", "Buddy System"],
  },
  {
    id: "os.virtual-memory",
    domain: "cs",
    label: "Virtual Memory",
    description: "Virtual address spaces, demand paging, and page replacement.",
    subtopics: ["Page Table", "TLB", "Page Fault", "Thrashing", "Working Set"],
  },
  {
    id: "os.paging",
    domain: "cs",
    label: "Paging & Segmentation",
    description: "Memory management schemes for non-contiguous allocation.",
    subtopics: ["Page Replacement (LRU, FIFO, Optimal)", "Segmentation", "Page Size"],
  },
  {
    id: "os.file-systems",
    domain: "cs",
    label: "File Systems",
    description: "File organization, directory structures, and storage management.",
    subtopics: ["Inodes", "FAT", "NTFS", "ext4", "Journaling"],
  },
  {
    id: "os.io",
    domain: "cs",
    label: "I/O Systems",
    description: "Device management, buffering, and I/O scheduling.",
    subtopics: ["DMA", "Interrupts", "Polling", "Disk Scheduling (SCAN, C-SCAN)"],
  },
];

// ── Computer Networks ───────────────────────────────────────────

const CN_TOPICS: CsTopic[] = [
  {
    id: "cn.osi-model",
    domain: "cs",
    label: "OSI & TCP/IP Models",
    description: "Layered network architecture and protocol stacks.",
    subtopics: ["7-Layer OSI", "4-Layer TCP/IP", "Encapsulation", "PDUs"],
  },
  {
    id: "cn.physical-layer",
    domain: "cs",
    label: "Physical & Data Link Layer",
    description: "Signal transmission, framing, error detection, MAC protocols.",
    subtopics: ["Ethernet", "ARP", "MAC Addressing", "CSMA/CD", "Switching"],
  },
  {
    id: "cn.network-layer",
    domain: "cs",
    label: "Network Layer & IP",
    description: "IP addressing, subnetting, routing algorithms.",
    subtopics: ["IPv4", "IPv6", "CIDR", "NAT", "ICMP", "Routing (OSPF, BGP)"],
  },
  {
    id: "cn.transport-layer",
    domain: "cs",
    label: "Transport Layer",
    description: "TCP, UDP, connection management, flow and congestion control.",
    subtopics: ["3-Way Handshake", "Flow Control", "Congestion Control", "TCP vs UDP"],
  },
  {
    id: "cn.dns",
    domain: "cs",
    label: "DNS",
    description: "Domain name resolution, hierarchy, and caching.",
    subtopics: ["Recursive vs Iterative", "DNS Records (A, CNAME, MX)", "TTL"],
  },
  {
    id: "cn.http",
    domain: "cs",
    label: "HTTP & HTTPS",
    description: "Request/response model, methods, status codes, TLS/SSL.",
    subtopics: ["HTTP/1.1", "HTTP/2", "HTTP/3 (QUIC)", "CORS", "Cookies", "TLS Handshake"],
  },
  {
    id: "cn.sockets",
    domain: "cs",
    label: "Sockets & Networking",
    description: "Socket programming, client-server communication patterns.",
    subtopics: ["TCP Sockets", "UDP Sockets", "Multiplexing (select/poll/epoll)"],
  },
  {
    id: "cn.network-security",
    domain: "cs",
    label: "Network Security",
    description: "Encryption, firewalls, common attacks, and defenses.",
    subtopics: ["Symmetric vs Asymmetric Encryption", "Firewalls", "DDoS", "VPN", "SSH"],
  },
];

// ── DBMS ────────────────────────────────────────────────────────

const DBMS_TOPICS: CsTopic[] = [
  {
    id: "dbms.relational-model",
    domain: "database",
    label: "Relational Model",
    description: "Relational algebra, keys, schemas, and ER modeling.",
    subtopics: ["Primary Key", "Foreign Key", "ER Diagrams", "Relational Algebra"],
  },
  {
    id: "dbms.sql",
    domain: "database",
    label: "SQL",
    description: "Structured query language — DML, DDL, aggregations, joins.",
    subtopics: ["SELECT", "JOIN", "GROUP BY", "Subqueries", "Window Functions", "CTEs"],
  },
  {
    id: "dbms.normalization",
    domain: "database",
    label: "Normalization",
    description: "Normal forms and functional dependency analysis.",
    subtopics: ["1NF", "2NF", "3NF", "BCNF", "Denormalization"],
  },
  {
    id: "dbms.acid",
    domain: "database",
    label: "ACID & Transactions",
    description: "Transaction properties, isolation levels, and recovery.",
    subtopics: ["Atomicity", "Consistency", "Isolation", "Durability", "WAL"],
  },
  {
    id: "dbms.indexing",
    domain: "database",
    label: "Indexing",
    description: "B-Trees, hash indexes, covering indexes, query optimization.",
    subtopics: ["B+ Tree", "Hash Index", "Composite Index", "Query Plan (EXPLAIN)"],
  },
  {
    id: "dbms.concurrency",
    domain: "database",
    label: "Concurrency Control",
    description: "Locking, MVCC, and isolation level trade-offs.",
    subtopics: ["2PL", "MVCC", "Optimistic Concurrency", "Read Committed", "Serializable"],
  },
  {
    id: "dbms.nosql",
    domain: "database",
    label: "NoSQL & NewSQL",
    description: "Document, key-value, column-family, and graph databases.",
    subtopics: ["MongoDB", "Redis", "Cassandra", "Neo4j", "CAP Theorem"],
  },
];

// ── System Design ───────────────────────────────────────────────

const SD_TOPICS: CsTopic[] = [
  {
    id: "sd.fundamentals",
    domain: "system-design",
    label: "System Design Fundamentals",
    description: "Core concepts: throughput, latency, availability, consistency.",
    subtopics: ["SLA/SLO", "Horizontal vs Vertical Scaling", "Back-of-the-Envelope"],
  },
  {
    id: "sd.load-balancing",
    domain: "system-design",
    label: "Load Balancing",
    description: "Distributing traffic across servers for reliability and performance.",
    subtopics: ["Round Robin", "Least Connections", "Consistent Hashing", "L4 vs L7"],
  },
  {
    id: "sd.caching",
    domain: "system-design",
    label: "Caching",
    description: "Cache strategies, invalidation, and distributed caching.",
    subtopics: ["Write-Through", "Write-Behind", "Cache-Aside", "LRU", "Redis", "CDN"],
  },
  {
    id: "sd.databases",
    domain: "system-design",
    label: "Database Design & Sharding",
    description: "Schema design, partitioning, replication, and sharding strategies.",
    subtopics: ["Horizontal Sharding", "Replication (Leader/Follower)", "Read Replicas"],
  },
  {
    id: "sd.message-queues",
    domain: "system-design",
    label: "Message Queues & Event Streaming",
    description: "Asynchronous processing, pub/sub, and event-driven architecture.",
    subtopics: ["Kafka", "RabbitMQ", "SQS", "Pub/Sub", "Dead Letter Queue"],
  },
  {
    id: "sd.api-design",
    domain: "system-design",
    label: "API Design",
    description: "RESTful APIs, GraphQL, gRPC, and API gateway patterns.",
    subtopics: ["REST", "GraphQL", "gRPC", "Rate Limiting", "Pagination", "Versioning"],
  },
  {
    id: "sd.microservices",
    domain: "system-design",
    label: "Microservices",
    description: "Service decomposition, communication, and orchestration.",
    subtopics: ["Service Discovery", "Circuit Breaker", "Saga Pattern", "API Gateway"],
  },
  {
    id: "sd.cap-theorem",
    domain: "system-design",
    label: "CAP Theorem & Consistency Models",
    description: "Trade-offs between consistency, availability, and partition tolerance.",
    subtopics: ["Strong Consistency", "Eventual Consistency", "PACELC"],
  },
  {
    id: "sd.cdn",
    domain: "system-design",
    label: "CDN & Edge Computing",
    description: "Content delivery networks and edge caching strategies.",
    subtopics: ["Push vs Pull CDN", "Edge Functions", "Geo-Routing"],
  },
  {
    id: "sd.rate-limiting",
    domain: "system-design",
    label: "Rate Limiting & Throttling",
    description: "Protecting services from abuse and overload.",
    subtopics: ["Token Bucket", "Leaky Bucket", "Sliding Window", "Distributed Rate Limiting"],
  },
];

// ── OOP & Design Patterns ───────────────────────────────────────

const OOP_TOPICS: CsTopic[] = [
  {
    id: "oop.fundamentals",
    domain: "cs",
    label: "OOP Fundamentals",
    description: "Core object-oriented programming concepts.",
    subtopics: ["Classes", "Objects", "Encapsulation", "Abstraction"],
  },
  {
    id: "oop.inheritance-polymorphism",
    domain: "cs",
    label: "Inheritance & Polymorphism",
    description: "Code reuse through inheritance and runtime polymorphism.",
    subtopics: ["Method Overriding", "Abstract Classes", "Interfaces", "Composition vs Inheritance"],
  },
  {
    id: "oop.solid",
    domain: "cs",
    label: "SOLID Principles",
    description: "Five design principles for maintainable object-oriented software.",
    subtopics: ["SRP", "OCP", "LSP", "ISP", "DIP"],
  },
  {
    id: "oop.design-patterns",
    domain: "cs",
    label: "Design Patterns",
    description: "Classic Gang of Four patterns for common design problems.",
    subtopics: [
      "Singleton", "Factory", "Observer", "Strategy",
      "Decorator", "Adapter", "Builder", "Proxy",
    ],
  },
];

// ── DevOps & Cloud ──────────────────────────────────────────────

const DEVOPS_TOPICS: CsTopic[] = [
  {
    id: "devops.docker",
    domain: "devops",
    label: "Docker & Containerization",
    description: "Container images, Dockerfiles, networking, and volumes.",
    subtopics: ["Dockerfile", "Docker Compose", "Layers", "Multi-Stage Builds"],
  },
  {
    id: "devops.kubernetes",
    domain: "devops",
    label: "Kubernetes",
    description: "Container orchestration, pods, services, and deployments.",
    subtopics: ["Pods", "Services", "Deployments", "ConfigMaps", "Helm"],
  },
  {
    id: "devops.cicd",
    domain: "devops",
    label: "CI/CD",
    description: "Continuous integration and deployment pipelines.",
    subtopics: ["GitHub Actions", "Jenkins", "GitLab CI", "Blue/Green Deploys", "Canary"],
  },
  {
    id: "devops.monitoring",
    domain: "devops",
    label: "Monitoring & Observability",
    description: "Logging, metrics, tracing, and alerting for production systems.",
    subtopics: ["Prometheus", "Grafana", "ELK Stack", "OpenTelemetry", "PagerDuty"],
  },
  {
    id: "devops.cloud",
    domain: "cloud",
    label: "Cloud Platforms",
    description: "AWS, GCP, Azure core services and architecture patterns.",
    subtopics: ["EC2/Compute", "S3/Storage", "Lambda/Functions", "IAM", "VPC"],
  },
];

// ── Web & Full-Stack ────────────────────────────────────────────

const WEB_TOPICS: CsTopic[] = [
  {
    id: "web.rest",
    domain: "web",
    label: "REST APIs",
    description: "Representational State Transfer — stateless API design.",
    subtopics: ["HTTP Methods", "Status Codes", "HATEOAS", "OpenAPI/Swagger"],
  },
  {
    id: "web.auth",
    domain: "web",
    label: "Authentication & Authorization",
    description: "Identity verification and access control mechanisms.",
    subtopics: ["JWT", "OAuth 2.0", "Session-Based Auth", "RBAC", "SSO"],
  },
  {
    id: "web.websockets",
    domain: "web",
    label: "WebSockets & Real-Time",
    description: "Full-duplex communication for real-time applications.",
    subtopics: ["Socket.io", "SSE", "Long Polling", "WebRTC"],
  },
  {
    id: "web.graphql",
    domain: "web",
    label: "GraphQL",
    description: "Query language for APIs — schemas, resolvers, subscriptions.",
    subtopics: ["Schema Definition", "Queries", "Mutations", "Subscriptions", "Federation"],
  },
  {
    id: "web.browser",
    domain: "web",
    label: "Browser Internals",
    description: "Rendering pipeline, event loop, and web performance.",
    subtopics: ["DOM", "CSSOM", "Event Loop", "Critical Rendering Path", "Web Workers"],
  },
];

// ── Aggregate Exports ───────────────────────────────────────────

export const CS_TOPICS: CsTopic[] = [
  ...OS_TOPICS,
  ...CN_TOPICS,
  ...DBMS_TOPICS,
  ...SD_TOPICS,
  ...OOP_TOPICS,
  ...DEVOPS_TOPICS,
  ...WEB_TOPICS,
];

// ── Helper Functions ────────────────────────────────────────────

/** Get all topics for a given domain */
export function getTopicsByDomain(domain: string): CsTopic[] {
  return CS_TOPICS.filter((t) => t.domain === domain);
}

/** Lookup a single topic by its canonical ID */
export function getTopicById(topicId: string): CsTopic | undefined {
  return CS_TOPICS.find((t) => t.id === topicId);
}

/** Get all unique domain values present in the registry */
export function getAllDomains(): string[] {
  return [...new Set(CS_TOPICS.map((t) => t.domain))];
}

/** Search topics by label (case-insensitive substring match) */
export function searchTopics(query: string): CsTopic[] {
  const q = query.toLowerCase();
  return CS_TOPICS.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q),
  );
}
