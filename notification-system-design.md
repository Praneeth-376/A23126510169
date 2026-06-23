# Notification System Design

---

## Stage 1 — Core Notification Actions

The system needs to handle two basic things: letting users pull their unread notifications, and letting them mark a notification as read. Keeping these as separate operations makes the API cleaner and easier to extend later.

### Supported Actions

- **Fetch Notifications** — returns a list of unread alerts for a student, ordered from oldest to newest.
- **Mark as Read** — updates a single notification record so it stops showing up as unread.

### REST Endpoints

#### GET /api/v1/notifications

Retrieves the notification list. The request needs an Authorization header carrying a Bearer token, plus a Content-Type of `application/json`. Pretty standard JWT-based auth.

```http
GET /api/v1/notifications
Authorization: Bearer <token>
Content-Type: application/json
```

#### PATCH /api/v1/notifications/:id/read

Marks a specific notification as read. The notification ID goes in the URL — no request body needed, the action is implicit from the route itself.

---

## Stage 2 — Database Design

PostgreSQL is the right call here. The data has a pretty clear relational shape — students and their notifications — and Postgres handles that well. You also get proper foreign key constraints, composite indexes, and ACID guarantees, which matter a lot when you're doing a lot of writes at once (think: a campus-wide alert going out to everyone simultaneously).

### Schema

#### `students`

| Column | Type | Notes |
|---|---|---|
| `student_id` | UUID, PRIMARY KEY | Unique identifier |
| `name` | VARCHAR, NOT NULL | Full name |
| `email` | VARCHAR, UNIQUE, NOT NULL | University email |

#### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PRIMARY KEY | Unique notification ID |
| `student_id` | UUID, FOREIGN KEY → students | Recipient |
| `notification_type` | ENUM | `Event`, `Result`, or `Placement` |
| `message` | TEXT, NOT NULL | Notification content |
| `is_read` | BOOLEAN, DEFAULT false | Read/unread status |
| `created_at` | TIMESTAMP, DEFAULT NOW() | Creation time |

### Scaling Concerns

Once you're past 50k students and millions of notification rows, a few things start to hurt:

1. **Full table scans** — if the right columns aren't indexed, every unread lookup becomes painfully slow.
2. **Write contention** — bulk inserts (e.g. notifying the entire campus) can block concurrent reads on the same pages.
3. **Index bloat** — high-cardinality indexes get expensive to maintain as the table grows. Every insert touches the index tree.

### Mitigation Strategies

- **Composite index** on `(student_id, is_read, created_at)` — narrows query scope significantly.
- **Monthly partitioning** on `created_at` — recent queries only scan the current partition instead of the full table.
- **Read replicas** — offload all SELECT queries to replicas; keep writes on the primary.

### Sample Insert

```sql
INSERT INTO notifications (id, student_id, notification_type, message, is_read, created_at)
VALUES (
  '4471c9c6-211d-452e-9258-4c9f464d88a2',
  'a23126510169',
  'Result',
  'Your result for Semester 4 has been published.',
  false,
  NOW()
);
```

---

## Stage 3 — Query Review

Here's the query the developer wrote:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### Issues

1. **Column naming mismatch** — the schema uses snake_case (`student_id`, `is_read`, `created_at`). Using camelCase here will throw an error in Postgres unless the columns were quoted during creation, which is bad practice.
2. **`SELECT *` in production** — fine for quick testing, but you only need a handful of fields. Pulling everything wastes bandwidth.
3. **No `LIMIT` clause** — if a student has thousands of unread notifications, this query returns all of them in one shot.

### Corrected Query

```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = 'a23126510169'
  AND is_read = false
ORDER BY created_at ASC
LIMIT 20 OFFSET 0;
```

This version matches the actual column names, only fetches what the UI needs, and adds pagination so you're not dumping the entire table to the client.

---

## Stage 4 — Caching with Redis

Hitting the database on every single page load for the notification list is wasteful, especially during peak times like when results drop. Redis sits in front of the DB and keeps the unread notification array in memory, keyed by student ID.

```
Key format: student:cache:<student_id>:notifications
```

### Why This Helps

- **Speed** — in-memory lookups happen in under 10ms versus potentially hundreds of milliseconds for a DB query with joins.
- **DB relief** — during traffic spikes, most requests never reach Postgres at all.

### The Trade-off: Stale Data

The obvious risk is that the cache can go out of sync. If an admin posts a new notification, the student won't see it until the cache refreshes. The fix is to invalidate the cache immediately whenever a new notification is created:

```
DEL student:cache:<student_id>:notifications
```

This forces the next page load to rebuild from the database — it's the Cache-Aside pattern. Simple and effective for this use case.

---

## Stage 5 — Bulk Notification Delivery

The naive approach — looping through 50,000 students and sending each email synchronously — is a non-starter. At even 200ms per send, that's close to 3 hours of a blocked server thread. One SMTP failure midway crashes the whole thing and you have no idea who got the alert.

### The Fix: Message Queues

The solution is to decouple the send operation from the request cycle entirely. The API endpoint publishes a job payload to a message queue (RabbitMQ, Kafka, SQS — whatever fits the stack) and immediately returns HTTP 202 to the caller. Worker processes pick up the job in the background and handle delivery concurrently.

#### Publisher (API Handler)

```python
function notify_all(student_ids, message):
    job = {
        "recipients": student_ids,
        "alert_text": message,
        "timestamp": get_iso_timestamp()
    }
    message_queue.publish("broadcast_notification_exchange", job)
    return HTTP_202_ACCEPTED
```

#### Consumer (Worker Daemon)

```python
function process_broadcast_worker(job):
    for student_id in job.recipients:
        worker_pool.submit(deliver, student_id, job.alert_text)

function deliver(student_id, message):
    try:
        save_to_db(student_id, message)
        push_to_app(student_id, message)
        dispatch_email_with_retry(student_id, message, max_retries=3)
    except NetworkException as err:
        dead_letter_queue.push({
            "student_id": student_id,
            "message": message,
            "error": str(err)
        })
```

Failed deliveries go to a Dead Letter Queue instead of crashing the worker. You can inspect the DLQ, fix the issue, and retry — without touching the successful sends.

---

## Stage 6 — Priority Inbox Sorting

Notifications aren't all equal. A placement alert matters more than an event reminder, so the UI needs to reflect that. The priority weights are:

| Type | Weight |
|---|---|
| Placement | 3 |
| Result | 2 |
| Event | 1 |

When two notifications share the same type, the more recent one should appear first (sorted by timestamp descending).

### Efficient Top-10 Maintenance

Re-sorting the entire list every time a new notification arrives is O(N log N) and doesn't scale. A better approach is a **min-heap capped at 10 elements**:

1. New notification arrives → compute its priority score.
2. If the heap has fewer than 10 items, push it straight in.
3. If the heap is full, compare against the root (the lowest priority item currently in the top 10). If the new one scores higher, pop the root and push the new item in.

This keeps insertion cost at O(log 10), which is effectively constant regardless of how many total notifications exist. The heap always holds the current top 10.

---

## Stage 7 — Frontend Architecture

The React layer splits responsibility across three areas: network data fetching, filter/view state, and interaction tracking (read/unread).

### Read State Tracking

To avoid redundant PATCH requests on every render, the component tracks which notification IDs the user has already seen using a `Set` in local state. Checking membership is O(1), so the read/unread distinction in the UI stays instant. Unread items get bold, high-contrast styling; acknowledged ones are visually muted.

### Priority View + Pagination

Server-side pagination (`page`, `limit`, `notification_type`) handles data volume. When the user switches to Priority Inbox, the current page's data gets passed through the priority weight comparator client-side. This way, even on slow connections, the highest-priority items bubble to the top of whatever page the student is on — across both desktop and mobile layouts.

### Logging

Request hooks fire `info`-level logs on successful API responses and `error`-level logs on failures. Each error log includes enough context (student ID, endpoint, response code) to be actionable. These ship to a remote logging endpoint rather than staying local, so you can monitor issues across sessions.