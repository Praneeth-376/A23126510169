# Notification System Design
# Stage 1
### 1. Core Notification Actions Supported
This platform supports two distinct actions to handle user interaction streams seamlessly:
* **Fetch Alerts:** Retrieve chronological lists of historical unread campus entries.
* **Acknowledge Status:** Update an individual notification entity to prevent redundant views.
### 2. REST API Design Contracts

#### A. Retrieve Notifications Array
* **Method:** `GET`
* **Route:** `/api/v1/notifications`
* **Request Headers:**
  ```json
  {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "Content-Type": "application/json"
  }

# Stage 2

### 1. Persistent Storage Selection & Justification
* **Database Choice:** **PostgreSQL** (Relational Database Management System)
* **Justification:** Relational storage is selected due to the clear entity-relationship mapping between university students and incoming notifications. PostgreSQL handles complex indexing structures (like B-Tree composite indices) with high efficiency, enforces strong data integrity via foreign key constraints, and natively supports transactional isolation guarantees ($ACID$) required to prevent race conditions during heavy write bursts.

---

### 2. Relational Database Schema Architecture

#### Table 1: `students`
Tracks student identity attributes across the campus directory.
* `student_id` (VARCHAR / UUID, PRIMARY KEY): Unique identifier.
* `name` (VARCHAR, NOT NULL): Full name of the candidate.
* `email` (VARCHAR, UNIQUE, NOT NULL): Official university email.

#### Table 2: `notifications`
Stores distinct alert records routed to target recipients.
* `id` (VARCHAR / UUID, PRIMARY KEY): Unique notification ID.
* `student_id` (VARCHAR / UUID, FOREIGN KEY references `students(student_id)`): Recipient identifier.
* `notification_type` (VARCHAR / ENUM): Constrained to `Event`, `Result`, or `Placement`.
* `message` (TEXT, NOT NULL): Detail payload string of the notice.
* `is_read` (BOOLEAN, DEFAULT false): Tracks read status state.
* `created_at` (TIMESTAMP, DEFAULT NOW()): Generation date and time stamp.

---

### 3. Data Volume Scaling Challenges
As the dataset expands over time to scale past 50,000 students and millions of archived notifications, three major performance bottlenecks will emerge:
1. **Read Performance Degradation:** Executing lookup filters on deep, non-indexed tables forces the database engine to perform costly full table scans, spiking CPU usage and slowing query execution times.
2. **Write Lock Contention:** Massive write loops (such as a generic "Notify All" campus alert broadcast) can log lock records inside the same database page block, blocking concurrent read operations.
3. **Index Overhead Expansion:** Maintaining high-cardinality indices across millions of rows dramatically slows down `INSERT` operations because the database engine must recalculate the index trees on every write.

---

### 4. Enterprise Mitigation Solutions
To maintain fast response times at scale, the architecture will implement:
* **Composite B-Tree Indexing:** Implement focused indices covering the exact query keys (e.g., combining `student_id`, `is_read`, and `created_at`) to narrow lookup boundaries to logarithmic space ($O(\log N)$).
* **Horizontal Table Partitioning:** Partition the `notifications` table into time-based logical shards (e.g., monthly partitions) based on the `created_at` value. Queries searching for recent records only scan the current month's partition instead of the whole database.
* **Read-Replica Architecture:** Deploy a primary database instance dedicated exclusively to handling transaction writes (`INSERT`, `PATCH`), while distributing `GET` lookups across horizontally scaled read-replicas.

---

### 5. Production Database Queries

#### A. Insert a New Notification Record
```sql
INSERT INTO notifications (id, student_id, notification_type, message, is_read, created_at)
VALUES ('4471c9c6-211d-452e-9258-4c9f464d88a2', 'a23126510169', 'Result', 'internal', false, NOW());
```
# Stage 3

### 1. Analysis of the Developer's Query
* **Query Evaluated:** ```sql
  SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt ASC;
  # Stage 4

### 1. The Real-Time Cache Strategy Recommendation
* **Proposed Infrastructure Layer:** **In-Memory Caching utilizing Redis**.
* **Implementation Strategy:** Instead of querying the core relational database on every single page load, the system caches the active unread notification payload array in memory. The Redis cache instance stores the dataset using a structured key mapped directly to the individual student ID: `student:cache:a23126510169:notifications`.

---

### 2. Deep-Dive Architectural Trade-offs

#### A. The Advantages (Pros)
* **Sub-Millisecond Retrieval Speed:** Moving queries from physical disk-based table space into volatile RAM memory drops notification read latency from hundreds of milliseconds down to sub-10 milliseconds, improving the user experience.
* **Database Workload Isolation:** Intercepting repetitive read requests at the cache layer prevents the primary relational database from freezing up during peak high-traffic campus rush windows (e.g., when results are released simultaneously).

#### B. The Disadvantages & Mitigation (Cons)
* **Cache Invalidation Complexity:** Introducing a cache introduces the risk of stale data. If an admin posts a new notification, the student will not see it until the cache expires or is updated.
* **Mitigation (Cache-Aside Pattern):** The backend will explicitly trigger a cache eviction (`DEL student:cache:student_id:notifications`) immediately inside the notification generation pipeline whenever a new record is created. This forces the next page load to perform a clean database fetch and rebuild a fresh cache copy.

---

# Stage 5

### 1. Systemic Shortcomings of the Synchronous Code Block
The developer's linear looping pseudocode contains two critical flaws that will cause catastrophic failures when hitting 50,000 student records:
1. **Thread-Blocking Synchronous Throttling:** Processing external email SMTP handshakes and write operations inline inside a single `for` loop blocks the application process. If a single execution takes 200ms, running it 50,000 times will lock up the server for nearly **3 hours**, causing the entire system to time out.
2. **Lack of Fault Tolerance & Atomicity:** If an external third-party email client API fails midway (e.g., at the 200th student), the execution crashes completely. There is no mechanism to recover, retry, or track state, leaving the system in an inconsistent state where some students receive the alert and others do not.

---

### 2. High-Throughput Asynchronous Redesign
To achieve true horizontal scalability, we isolate the execution from the request cycle by decoupling the operation using an asynchronous background **Message Queue System** (such as RabbitMQ, Apache Kafka, or Amazon SQS).

#### Optimized Non-Blocking Pseudocode Blueprint
```python
# 1. API Endpoint Handler (Publisher - Instant Non-Blocking Handshake)
function notify_all(student_ids: array, message: string):
    # Package parameters into an immutable background job payload
    job_payload = {
        "recipients": student_ids,
        "alert_text": message,
        "timestamp": get_iso_timestamp()
    }
    
    # Offload the payload onto an enterprise message exchange immediately
    message_queue.publish("broadcast_notification_exchange", job_payload)
    
    # Instantly return HTTP 202 Accepted to the client dashboard
    return HTTP_STATUS_202_ACCEPTED

# 2. Asynchronous Worker Daemon (Consumer - Highly Concurrent Processing)
function process_broadcast_exchange_worker(job_payload):
    # Distribute operations across a highly concurrent parallel worker pool
    for student_id in job_payload.recipients:
        worker_pool.submit(execute_reliable_delivery, student_id, job_payload.alert_text)

function execute_reliable_delivery(student_id, message):
    try:
        # Step A: Perform persistent database record entry
        save_to_db(student_id, message)
        
        # Step B: Push real-time event to active client via SSE stream layer
        push_to_app(student_id, message)
        
        # Step C: Dispatch external notification with isolated error retry policies
        dispatch_email_with_retry(student_id, message, max_retries=3)
        
    except ExternalNetworkException as network_error:
        # Route isolated network failures straight to a Dead-Letter Queue (DLQ) for retries
        dead_letter_queue.push({
            "student_id": student_id,
            "message": message,
            "error": str(network_error),
            "step": "email_dispatch"
        })

---

## Stage 7

### 1. Frontend Architecture & State Management Approach
The React application architecture isolates state management into three core operational layers: network synchronization hooks, view filter registers, and user interaction trackers. To satisfy the performance rules, notifications are tracked via an optimization state using an explicit local storage-backed `Set` object of viewed `ID` hashes. This allows the UI to instantly distinguish between brand-new unread alerts (rendered with a bold interactive high-contrast indicator bar) and already acknowledged rows in constant $O(1)$ time complexity without forcing redundant database updates.

### 2. Edge-Case Stability & Filter Pagination Flow
The interface addresses data cluttering boundaries by combining server-side pagination query parameters (`page`, `limit`, `notification_type`) with an adaptive client-side sorting algorithm wrapper. When a student toggles into the **Priority Inbox** view, the component captures the active paginated network array and processes it through the priority matrix weight calculator. This ensures that even under restricted network bandwidth, high-priority placement updates bubble up seamlessly to the top of the viewport display across both desktop layouts and mobile view ports.

### 3. Integrated Client-Side Call Stack Logging Matrix
Custom logging handlers are bound directly inside the user request life-cycle hooks. Inbound API stream updates fire off `info` status notifications to the remote logging collection endpoint, while unexpected network dropouts or validation failures trigger explicit `error` logs containing descriptive contextual data fields.