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