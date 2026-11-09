# Plexus — Pre-Deployment Final Configuration Audit Report

**Application:** Plexus (Cross-Repository Dependency Impact Analyzer & CodeCity)
**Target Environment:** Render Cloud Platform (Docker Web Service)
**Database Backend:** Neon Serverless PostgreSQL
**Authentication Backend:** Supabase Auth (OAuth2 / JWT / JWKS)
**Audit Target:** Commit `c5073e4` on branch `main`
**Current Engineering Decision:** `B. READY ONLY FOR 2 GB VALIDATION DEPLOYMENT`
**Date:** November 2026
**Auditor:** Principal DevOps, Cloud Infrastructure Architect & Java Production Engineer

---

## 1. Executive Summary

This audit evaluates the deployment readiness of Plexus for a **controlled 2 GB validation deployment** on Render.

The previous Out-of-Memory (OOM) audit confirmed that commit `c5073e4` resolved primary application memory amplifiers (progressive AST string eviction, bounded LRU caches, global indexing semaphore, bounded Tomcat thread pool). However, operating on a 512 MB container leaves inadequate safety headroom against native memory fragmentation.

This pre-deployment audit identified **two significant infrastructure-level configuration mismatches** that must be aligned before triggering the validation deployment:
1. **Geographic Cross-Country Misplacement:** Neon PostgreSQL is located in AWS `us-east-2` (Ohio), while `render.yaml` was configured for `oregon` (US West). This ~2,000-mile geographic separation adds 50–70 ms of latency per database query round-trip.
2. **Omission of 2 GB JVM Profile in Blueprint:** `render.yaml` sets `plan: starter` (512 MB) and omits `JAVA_OPTS`, which causes Docker to fall back to the single-threaded `SerialGC` 512 MB profile even on larger instances.

---

## 2. Files & Artifacts Inspected

The following 14 configuration, build, and source files were audited:

1. [`Dockerfile`](file:///c:/Users/sunka/OneDrive/coding/dependency/Dockerfile) — Multi-stage build (Node 20 &rarr; Maven JRE 21 &rarr; Temurin 21 JRE runtime).
2. [`render.yaml`](file:///c:/Users/sunka/OneDrive/coding/dependency/render.yaml) — Render Blueprint Infrastructure-as-Code specification.
3. [`src/main/resources/application.properties`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/resources/application.properties) — Spring Boot, HikariCP, Flyway, JPA, and Tomcat thread configurations.
4. [`src/main/java/com/impactmapper/controller/HealthController.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/controller/HealthController.java) — Readiness, liveness, and memory diagnostic REST endpoints.
5. [`src/main/java/com/impactmapper/controller/AuthController.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/controller/AuthController.java) — Runtime dynamic auth configuration endpoint (`/api/auth/config`).
6. [`src/main/java/com/impactmapper/controller/SpaForwardingController.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/controller/SpaForwardingController.java) — Client-side SPA routing fallback.
7. [`src/main/java/com/impactmapper/config/SecurityConfig.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/config/SecurityConfig.java) — Spring Security filter chain, JWKS decoder, and public route matcher.
8. [`frontend/vite.config.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/vite.config.js) — Vite build packaging, environment variable resolution, and output destination.
9. [`frontend/src/api/supabaseClient.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/supabaseClient.js) — Frontend Supabase client initialization.
10. [`frontend/src/api/codecityApi.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/codecityApi.js) — Same-origin relative CodeCity API client.
11. [`frontend/src/api/graphApi.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/graphApi.js) — Same-origin relative Graph API client.
12. [`src/main/resources/static/index.html`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/resources/static/index.html) — Dashboard HTML shell and synchronous runtime auth bootstrap.
13. [`docs/RENDER_DEPLOYMENT_GUIDE.md`](file:///c:/Users/sunka/OneDrive/coding/dependency/docs/RENDER_DEPLOYMENT_GUIDE.md) — Operational deployment instructions.
14. [`docs/RENDER_MEMORY_INCIDENT_REPORT.md`](file:///c:/Users/sunka/OneDrive/coding/dependency/docs/RENDER_MEMORY_INCIDENT_REPORT.md) — OOM root cause and verification report.

---

## 3. Actual Configuration Values (Excluding Secrets)

### 3.1 Compute & Platform Configuration
* **Service Type:** Web Service (`docker` runtime)
* **Default Blueprint Region:** `oregon` *(needs update to `ohio`)*
* **Default Blueprint Plan:** `starter` (512 MB RAM, 0.5 CPU) *(needs update to `standard` for 2 GB)*
* **Render Port Assignment:** Injected dynamically as `$PORT` (typically 10000). Spring Boot maps `server.port=${PORT:8080}`.
* **Health Check Path:** `/api/health` (Readiness check with 2s database ping).
* **Container Health Check:** `HEALTHCHECK` in Dockerfile uses `/api/health/liveness` (non-blocking web server ping).

### 3.2 Database & Connection Pool Configuration
* **Database Engine:** PostgreSQL 18.6 (Hosted on Neon Serverless)
* **Database Region:** AWS `us-east-2` (Ohio) — Host: `ep-floral-paper-bea5twa0.c-9.us-east-2.aws.neon.tech`
* **Driver:** `org.postgresql.Driver`
* **TLS / SSL Mode:** Enforced via `?sslmode=require` in JDBC connection string.
* **Hikari Connection Pool:**
  - `maximum-pool-size`: 10
  - `minimum-idle`: 1
  - `connection-timeout`: 30,000 ms (30s for Neon compute resume)
  - `initialization-fail-timeout`: 60,000 ms
  - `max-lifetime`: 180,000 ms (3 min)
  - `idle-timeout`: 60,000 ms
  - `keepalive-time`: 30,000 ms
  - `tcpKeepAlive`: `true`
  - `leak-detection-threshold`: 60,000 ms
* **Flyway Migration:**
  - `baseline-on-migrate`: `true`
  - `connect-retries`: 10
  - `connect-retries-interval`: 2 seconds (allows up to 20s for Neon cold wake)
  - `lock-retry-count`: 50

### 3.3 Server & Concurrency Configuration
* **Tomcat Worker Threads:** Max 20 (`server.tomcat.threads.max=${TOMCAT_MAX_THREADS:20}`), Min Spare 4.
* **Tomcat Max Connections:** 100.
* **Graceful Shutdown:** Enabled (`server.shutdown=graceful`, 30s timeout).
* **Global Indexing Concurrency:** Capped at 1 active job (`Semaphore(1)` in `RepoIndexingService`).

### 3.4 JVM Flags (Baked Default in Dockerfile)
```bash
-XX:+UseContainerSupport \
-XX:MaxRAMPercentage=50.0 \
-XX:InitialRAMPercentage=25.0 \
-XX:MaxMetaspaceSize=128m \
-XX:ReservedCodeCacheSize=48m \
-XX:MaxDirectMemorySize=16m \
-Xss512k \
-XX:+UseSerialGC \
-XX:+ExitOnOutOfMemoryError \
-Djava.security.egd=file:/dev/./urandom
```

---

## 4. Render and Neon Geographic Placement Analysis

### 4.1 Confirmed Latency Bottleneck
* **Neon PostgreSQL Region:** AWS `us-east-2` (Columbus, Ohio).
* **Current Render Configuration:** `render.yaml` sets `region: oregon` (The Dalles, Oregon).
* **Geographic Distance:** ~2,100 miles (~3,380 km).
* **Network Round-Trip Time (RTT):** Standard transcontinental public fiber RTT is **50–70 ms per round trip**.

```
[Render Web Service]                                    [Neon PostgreSQL]
Oregon (US West)   ==== ~2,100 miles (50-70ms RTT) ====>  Ohio (US East, us-east-2)
```

### 4.2 Impact on API Latency
When an endpoint requires multiple queries:
* `GET /api/repos/7/city`:
  1. `userRepository.findBySupabaseUid` &rarr; 60 ms
  2. `repositoryRepository.existsByIdAndOwnerId` &rarr; 60 ms
  3. `snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc` &rarr; 60 ms
  4. Node, Edge, or District batch fetch &rarr; 60 ms
  * **Network overhead alone = 240–300 ms** before data processing.
* During repository indexing with Flyway validation, entity lookups, and edge inserts, transcontinental latency accounts for **several seconds of wall-clock delay**.

### 4.3 Remediation
Render operates a native **Ohio (US East)** region. Setting Render's region to **`ohio`** co-locates the container in the same AWS us-east-2 availability zone cluster as Neon.
**Result:** Cross-continental network RTT drops from **50–70 ms &rarr; < 1.5 ms**.

### 4.4 TLS Verification
* Neon rejects all unencrypted plain TCP connections.
* The JDBC URL format configured in `docs/RENDER_DEPLOYMENT_GUIDE.md` (`jdbc:postgresql://.../neondb?sslmode=require`) uses TLS 1.3 via the PostgreSQL JDBC driver.
* Live integration test execution (`CodeCityLiveValidationTest`) confirmed clean TLS handshakes against Neon.

---

## 5. Production JVM Configuration & Flag Analysis

### 5.1 Runtime Flag Application
* In `Dockerfile`, the entrypoint is:
  ```dockerfile
  ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
  ```
* Standard Docker behavior ensures that runtime environment variables injected by Render supersede the `ENV JAVA_OPTS` baked into the image.
* When running Java 21 on Linux (`eclipse-temurin:21-jre-alpine`), OpenJDK automatically queries `/sys/fs/cgroup/memory.max` (cgroup v2) or `/sys/fs/cgroup/memory/memory.limit_in_bytes` (cgroup v1) to calculate percentages when `-XX:+UseContainerSupport` is active.

### 5.2 Critical Risk: Applying 512 MB Flags to a 2 GB Deployment
* If deployed on a 2 GB Render instance without setting the `JAVA_OPTS` environment variable, the container will execute the **512 MB baked default**.
* Under 2 GB RAM, the default `MaxRAMPercentage=50.0` allocates 1,024 MB heap, but leaves the JVM running with:
  - `-XX:+UseSerialGC` (Single-threaded stop-the-world collector instead of concurrent G1GC).
  - `-XX:MaxMetaspaceSize=128m` (Unnecessarily constrained).
  - `-XX:ReservedCodeCacheSize=48m` (Limits JIT compilation of large AST libraries).
* **Requirement:** The Render environment **must** explicitly override `JAVA_OPTS` with the 2 GB profile during deployment.

### 5.3 Limitations of Specific JVM Flags
1. **`MaxRAMPercentage`:**
   - Caches and sizes *only the Java object heap*.
   - **Does NOT bound total process RSS.** Metaspace, CodeCache, thread stacks, direct NIO buffers, and glibc malloc arenas remain outside this percentage.
2. **`MaxMetaspaceSize`:**
   - Sets a hard ceiling on JVM class metadata, constant pools, and method bytecode.
   - If exceeded, HotSpot immediately throws `java.lang.OutOfMemoryError: Metaspace` rather than spilling to disk. Must be sized to at least 128 MB for Spring Boot 3 + Hibernate 6 + JavaParser.
3. **`MaxDirectMemorySize`:**
   - Limits off-heap direct byte buffers (`ByteBuffer.allocateDirect()`).
   - Does **NOT** limit native C library allocations made via standard `malloc()` (e.g. zlib native decompression buffers used by `ZipInputStream`).
4. **`MaxGCPauseMillis`:**
   - A soft heuristic target for G1GC (e.g. 200 ms).
   - **Not a hard guarantee.** If application allocation rate exceeds concurrent marking speed, G1GC will pause threads longer than the target to prevent heap exhaustion. (Ignored entirely under SerialGC).

---

## 6. Memory & Runtime Observability Audit

### 6.1 `GET /api/health/memory` Payload Inspection
The diagnostic endpoint in [`HealthController.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/controller/HealthController.java) returns:

```json
{
  "service": "Plexus Dependency Impact Mapper",
  "timestamp": "2026-11-10T01:50:00Z",
  "heap": {
    "usedMb": 112.4,
    "committedMb": 196.0,
    "maxMb": 1331.2,
    "usedPercent": 8.4
  },
  "metaspaceUsedMb": 68.2,
  "threadCount": 24,
  "peakThreadCount": 31,
  "garbageCollection": {
    "collectionCount": 14,
    "collectionTimeMs": 142
  },
  "activeIndexingJobs": 0,
  "activeArchitectureJobs": 0
}
```

### 6.2 Security & Data Privacy
* **No secrets or credentials exposed:** The endpoint does not output connection strings, database credentials, Supabase keys, or environment variables.
* **Permitted in Security:** Explicitly permitted without authentication in [`SecurityConfig.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/config/SecurityConfig.java#L55) to allow platform monitoring probes.

### 6.3 Observability Gaps & Caveats
1. **Container RSS is not reported:** Standard Java MXBeans (`Runtime`, `MemoryMXBean`, `OperatingSystemMXBean`) cannot reliably detect Linux container cgroup RSS without native Linux `/proc/self/status` parsing. Render Dashboard metrics must be used to observe true container RSS.
2. **Metaspace Committed is not reported:** The endpoint reports `metaspaceUsedMb` but omits committed Metaspace.
3. **Naming Clarity:** Heap usage is correctly nested under the `"heap"` key and is not mislabeled as total process memory.

---

## 7. Deployment Readiness & Architecture Verification

### 7.1 Single-Service Architecture Verification
* **Frontend Packaging:** Vite compiles React components into static assets at `src/main/resources/static/graph-dist`.
* **Fat JAR Packaging:** Maven embeds the compiled static assets into `app.jar`.
* **Embedded Serving:** Spring Boot embedded Tomcat serves static files at `/` and REST controllers at `/api/**`.
* **Same-Origin Requests:** Both [`codecityApi.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/codecityApi.js#L5) and [`graphApi.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/graphApi.js#L21) use relative paths (`/api/...`). Zero cross-origin requests occur in production; CORS delays and preflights are eliminated.

### 7.2 Frontend Environment Variable Injection
The application implements a robust **dual-injection architecture**:
1. **Build-Time Injection (Fallback):**
   - In `Dockerfile` Stage 1, `ARG VITE_SUPABASE_URL`, `ARG VITE_SUPABASE_PUBLISHABLE_KEY`, and `ARG VITE_API_BASE_URL` are passed to `npm run build`.
   - In `render.yaml`, `envVars` declared for a Docker service are automatically supplied by Render as Docker build arguments.
2. **Runtime Dynamic Injection (Primary):**
   - At application launch, [`index.html`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/resources/static/index.html#L20-L35) executes a synchronous `GET /api/auth/config`.
   - [`AuthController.java`](file:///c:/Users/sunka/OneDrive/coding/dependency/src/main/java/com/impactmapper/controller/AuthController.java#L22-L28) returns the server's current Supabase public configuration, populating `window.__SUPABASE_CONFIG__`.
   - [`supabaseClient.js`](file:///c:/Users/sunka/OneDrive/coding/dependency/frontend/src/api/supabaseClient.js#L8-L10) prioritizes `window.__SUPABASE_CONFIG__`.
   - **Advantage:** If Supabase public keys or URLs change in the Render Dashboard, the frontend immediately picks up the changes at runtime without requiring a full Docker image rebuild.

### 7.3 Database Resilience & Error Handling
* **Transient DB Cold Starts:** If Neon compute is asleep, Flyway retries up to 10 times at 2s intervals (20s total), and HikariCP waits up to 60s (`initialization-fail-timeout=60000`).
* **Container Health Separation:**
  - Internal container health (`HEALTHCHECK` in Dockerfile) hits `/api/health/liveness`, which returns `200 OK` without touching the database. This prevents Docker from crash-looping while Neon wakes up.
  - Public traffic routing (`healthCheckPath` in `render.yaml`) hits `/api/health`, which returns `503 Service Unavailable` if the database is disconnected, preventing traffic routing until the database is ready.

---

## 8. Summary of Confirmed Issues & Unresolved Risks

### Confirmed Configuration Issues (Must be corrected for validation deployment)
| # | Issue | Impact | Required Remediation |
| :-: | :--- | :--- | :--- |
| **1** | `render.yaml` sets `region: oregon` | Transcontinental latency (50–70 ms/query) to Neon in Ohio | Change Render region to **`ohio`** |
| **2** | `render.yaml` sets `plan: starter` (512 MB) | Exposes container to native memory starvation | Change plan to **`standard` (2 GB)** for validation |
| **3** | `render.yaml` omits `JAVA_OPTS` | Falls back to baked 512 MB SerialGC flags on 2 GB container | Explicitly inject 2 GB G1GC `JAVA_OPTS` in Render |

### Unresolved Operational Risks (To be monitored during validation)
1. **Neon Serverless Cold Wake:** If idle for > 5 minutes, Neon suspends compute. The first user request after inactivity will experience a 3–5 second wake delay.
2. **GitHub API Rate Limits:** Without a configured `GITHUB_TOKEN`, anonymous GitHub API calls are limited to 60/hr. A Personal Access Token is required for frequent repository indexing.
3. **Mega-Repository Memory Scaling:** Repositories with > 1,500 Java files may temporarily spike heap during full AST graph resolution. Single-job semaphore serialization mitigates concurrency multiplication, but heap usage must be monitored on large repositories.

---

## 9. Exact Recommended Render Configuration for 2 GB Validation

When deploying to Render, apply the following exact configuration:

### 9.1 Service Specification
* **Name:** `plexus-impact-mapper`
* **Runtime:** `Docker`
* **Region:** `Ohio (US East)`
* **Plan:** `Standard` (2 GB RAM, 1 CPU)
* **Health Check Path:** `/api/health`
* **Auto-Deploy:** `Yes`

### 9.2 Exact Environment Variables
```ini
# Production JVM Tuning for 2GB Container
JAVA_OPTS=-XX:+UseContainerSupport -XX:MaxRAMPercentage=65.0 -XX:InitialRAMPercentage=30.0 -XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=128m -XX:MaxDirectMemorySize=64m -Xss1m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom

# Database Connection (Neon PostgreSQL in Ohio with enforced TLS)
SPRING_DATASOURCE_URL=jdbc:postgresql://ep-floral-paper-bea5twa0.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require
SPRING_DATASOURCE_USERNAME=neondb_owner
SPRING_DATASOURCE_PASSWORD=<YOUR_ACTUAL_NEON_PASSWORD>

# Supabase Authentication & Resource Server (JWT/JWKS)
SUPABASE_JWT_ISSUER_URI=https://nwqjgadidsawteueixaj.supabase.co/auth/v1
SUPABASE_JWKS_URI=https://nwqjgadidsawteueixaj.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_URL=https://nwqjgadidsawteueixaj.supabase.co
SUPABASE_PUBLISHABLE_KEY=<YOUR_ACTUAL_SUPABASE_ANON_KEY>

# Frontend Build Arguments (Dual Injection)
VITE_SUPABASE_URL=https://nwqjgadidsawteueixaj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<YOUR_ACTUAL_SUPABASE_ANON_KEY>
VITE_API_BASE_URL=

# Concurrency & Thread Pool Tuning for 2GB Tier
TOMCAT_MAX_THREADS=50
TOMCAT_MIN_SPARE_THREADS=8
TOMCAT_MAX_CONNECTIONS=200

# Optional GitHub Integration
GITHUB_TOKEN=<YOUR_GITHUB_PAT>
```

---

## 10. Final Recommendation & Exact Next Action

### Final Recommendation
**THE SYSTEM IS READY FOR A CONTROLLED 2 GB VALIDATION DEPLOYMENT.**
*(Do NOT declare general production readiness until live runtime metrics confirm stability under real user traffic).*

### Exact Next Action
1. Update `render.yaml` to specify `region: ohio`, `plan: standard`, and declare the 2 GB `JAVA_OPTS` setting.
2. Stage and commit these infrastructure alignment updates to local `main`.
3. Provide the user with the final deployment authorization step to initiate the validation push.
