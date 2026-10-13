# QuickNotes System Architecture

## Requirements

### Functional

- Users can register, sign in, and access only their own notes and tags.
- Users can create, list, view, edit, and delete notes.
- Users can create tags and associate tags with notes.
- The API validates input, paginates lists, and returns consistent errors.

### Non-functional

- Scale to 1 million registered users and support horizontal app-server
  scaling.
- Keep common note reads responsive and maintain availability during an
  individual app-server or worker failure.
- Protect credentials and data in transit and at rest; enforce tenant isolation.
- Back up durable data and make asynchronous work retryable and observable.

## Capacity estimate

Assumptions: 1 million registered users; 20% daily active (200,000); each active
user performs 20 note reads and 2 note writes daily. Average stored note
including indexes/metadata is estimated at 2 KB, with 100 notes per user and a
10% annual growth allowance.

- Reads: `200,000 × 20 / 86,400 ≈ 46` requests/second average. Use roughly
  `460 reads/second` as a 10× peak planning target.
- Writes: `200,000 × 2 / 86,400 ≈ 4.6` requests/second average. Plan for about
  `46 writes/second` at peak.
- Storage: `1,000,000 × 100 × 2 KB ≈ 200 GB` for note records before replicas
  and backups. With 10% annual growth, first-year growth is about 20 GB,
  bringing the estimate to approximately 220 GB of primary note data at year
  end. User, tag, index, replica, and backup storage are additional.

These are starting estimates; production metrics should validate the activity,
note-size, and peak-to-average assumptions.

## Architecture diagram

```text
                         +------------------+
                         |       DNS        |
                         +--------+---------+
                                  |
+--------+    +------------------v---+     +-----------------+
| Client |--->| CDN / static web app |---->| Load balancer   |
+--------+    +----------------------+     +--------+--------+
                                                   / \
                                      +------------+  +------------+
                                      |                          |
                              +-------v------+           +-------v------+
                              | App server 1 |           | App server 2 |
                              +---+-------+--+           +--+-------+---+
                                  |       |                 |       |
                                  |       +--------+--------+       |
                                  |                |                |
                           +------v------+  +------v------+         |
                           | Cache       |  | Primary DB  |<--------+
                           +-------------+  +------+------+
                                                   |
                                            replication
                                                   |
                                            +------v------+
                                            | Read replica|
                                            +-------------+

                       App servers --enqueue--> +-------+
                                                | Queue |
                                                +---+---+
                                                    |
                                                +---v---+
                                                | Worker|
                                                +---+---+
                                                    |
                                         +----------v---------+
                                         | DB / email / other |
                                         | async integrations |
                                         +--------------------+
```

## Component responsibilities

- **Client:** Renders the interface and sends authenticated requests while
  keeping server-side authorization authoritative.
- **DNS:** Resolves the public service hostname to the edge entry point.
- **CDN:** Serves static assets near users and reduces origin traffic and
  latency.
- **Load balancer:** Distributes API traffic and health-checks app instances.
- **App servers:** Validate/authenticate requests and execute API business
  logic; multiple stateless instances support horizontal scaling.
- **Cache:** Speeds up frequently read, safely cacheable data and reduces
  database load; writes invalidate or refresh affected entries.
- **Primary database:** Provides the authoritative durable copy and accepts
  transactional writes.
- **Read replica:** Serves eligible read traffic and reduces pressure on the
  primary, with an understood replication lag.
- **Queue:** Buffers asynchronous jobs, separating request latency from slow
  work and absorbing temporary bursts.
- **Worker:** Processes queued tasks such as notifications and cleanup with
  retries and idempotency.

## Request flows

### `GET /notes`

1. The client resolves `api.quicknotes.example` via DNS and sends an HTTPS
   request through the CDN/edge and load balancer.
2. The load balancer selects a healthy app server; the app validates the
   access token and derives the user's identity.
3. The app checks the cache for the user's requested page/filter. A cache hit
   returns the authorized result.
4. On a miss, the app queries the read replica with a user-scoped,
   cursor-paginated query (or the primary if fresh read-after-write data is
   required).
5. The app caches an appropriate result, serializes the response, and returns
   `200 OK` through the load balancer to the client.

### `POST /notes`

1. The client sends an authenticated HTTPS request with the note JSON through
   the edge and load balancer.
2. The app server validates the token and payload, checks authorization, and
   starts a database transaction.
3. The app inserts the note into the primary database with the authenticated
   user as owner; associated tags, if any, are checked and written in the same
   transaction.
4. The app commits, invalidates affected user-note cache entries, and enqueues
   any asynchronous follow-up work (such as indexing or notification).
5. The app returns `201 Created` and the created note. The queue/worker
   processes background work independently of the response.

## Trade-offs and availability

1. **Read replica vs. read-after-write consistency:** Replicas scale reads but
   can lag. Route a user's immediate post-write read to the primary or return
   the newly created record directly; use replicas for normal list reads.
2. **Cache speed vs. invalidation complexity:** Caching reduces database load
   but risks stale data. Use short TTLs, user-scoped keys, and invalidate
   relevant keys after successful writes; avoid caching sensitive responses
   across users.
3. **Asynchronous work vs. immediate completion:** A queue keeps user-facing
   requests fast, but work is eventually consistent. Make jobs idempotent,
   retry transient failures, and route poison messages to a dead-letter queue.

No single machine is the only service entry point: DNS is hosted redundantly,
the CDN/load-balancer tier is deployed across availability zones, and at least
two health-checked stateless app servers serve traffic. The database uses
automated backups and a cross-zone read replica with a documented failover
procedure; queues are replicated, and workers run as multiple replaceable
instances. Monitoring and tested recovery procedures are required because
replicas and redundancy reduce but do not eliminate failure risk.
