# Plexus — Render Free Tier ($0/Month) Deployment & Operational Limitations

**Target Platform:** Render Cloud Platform (Free Web Service Tier)
**Hosting Budget:** **$0.00 / month (Zero Budget Constraint)**
**Container Memory Limit:** **512 MB RAM**
**CPU Allocation:** **0.5 Shared vCPU**
**Document Revision:** November 2026

---

## 1. Executive Summary & Philosophy

Plexus is designed to run reliably under the strict resource constraints of **Render Free tier (512 MB RAM, 0.5 CPU)** without requiring any paid cloud infrastructure.

To achieve production stability under a 512 MB memory boundary, Plexus enforces strict **resource budgets, serialization limits, and defensive early rejection** before expensive computations (such as JavaParser AST parsing and 3D spatial geometry layout) can exhaust container memory.

---

## 2. Hard Enforced Free-Tier Resource Limits

The following limits are enforced automatically by the application and are configurable via environment variables or `application.properties`:

| Resource Metric | Default Limit | Configuration Property | Behavior When Exceeded |
| :--- | :---: | :--- | :--- |
| **Max Analyzable Source Files** | **150 files** | `plexus.indexing.max-source-files` | Early rejection before download; repo marked `FAILED_RESOURCE_LIMIT`; returns `HTTP 422`. |
| **Max Compressed Archive Size** | **15 MB** | `plexus.indexing.max-archive-size-bytes` | Download aborted stream-level; memory released; returns `HTTP 422`. |
| **Max Individual File Size** | **1 MB** | `plexus.indexing.max-file-size-bytes` | ZIP extraction halted; memory released; returns `HTTP 422`. |
| **Max Total Extracted Source Size**| **10 MB** | `plexus.indexing.max-extracted-size-bytes`| Extraction halted; memory released; returns `HTTP 422`. |
| **Concurrent Indexing Jobs** | **1 job** | `globalIndexingSemaphore = 1` | Immediate rejection with `HTTP 429 Too Many Requests` (`Retry-After`). |
| **Concurrent Architecture Analysis**| **1 job** | `globalAnalysisSemaphore = 1` | Rejection with `HTTP 429` or in-flight deduplication for identical repository. |
| **Tomcat Worker Threads** | **20 threads** | `server.tomcat.threads.max` | Requests queued; bounds thread stack reservation to $\le 10\text{ MB}$. |
| **In-Memory City Models Cache** | **3 snapshots** | Bounded LRU Cache | Eldest snapshot automatically evicted when size > 3. |
| **In-Memory Intelligence Cache** | **3 snapshots** | Bounded LRU Cache | Eldest snapshot automatically evicted when size > 3. |

---

## 3. Supported Repository Profiles vs. Unsupported Repositories

### Supported Repositories (Safe for 512 MB Free Tier)
* **Microservices and focused services:** 10 to 120 source files (`.java`, `.js`, `.ts`).
* **Typical Spring Boot starter/sample applications:** Controllers, services, repositories, and domain models up to 150 classes.
* **Modern Single Page Applications (SPAs):** React, Vue, or Angular frontend repos without checked-in `node_modules` or `dist/` folders.
* **Libraries and modular utilities:** Focused domain libraries with clean dependency manifests.

### Unsupported Repositories (Requires Modular Decomposition or Upgraded Plan)
* **Large enterprise monorepos:** Repositories with hundreds of thousands of lines of code or > 150 source files (e.g. Spring Framework, Hibernate ORM, Kubernetes).
* **Repositories with committed build artifacts:** Repositories containing large `.jar`, `.war`, `.tar.gz`, or database `.sql` dumps exceeding 15 MB.
* **Massive generated codebases:** Projects containing thousands of gRPC, protobuf, or OpenAPI generated stubs.

---

## 4. How Users Should Respond to Oversized Repositories

When a repository exceeds free-tier limits, Plexus will **not crash or become unresponsive**. Instead, it gracefully stops processing and displays a structured error:

```json
{
  "error": "RESOURCE_LIMIT_EXCEEDED",
  "limitType": "MAX_SOURCE_FILES",
  "actualValue": 342,
  "limitValue": 150,
  "unit": "files",
  "message": "Repository exceeds free-tier limit of 150 source files (found 342 files). To run reliably within Render Free 512MB RAM, repositories must have 150 or fewer source files."
}
```

### User Action Steps:
1. **Analyze Sub-Modules:** If analyzing a multi-module Maven/Gradle repository, index specific sub-module repositories or focused service branches.
2. **Exclude Non-Source Assets:** Ensure binary assets, database dumps, and large sample data files are removed from the Git tree or placed in `.gitignore`.
3. **Self-Hosted / Local Docker Execution:** For analyzing monolithic codebases (> 150 files), users can run Plexus locally using the provided Docker container with increased RAM (`docker run -m 2g -e JAVA_OPTS="-Xmx1500m" ...`).

---

## 5. Render Free Platform Operational Characteristics

Users and developers must be aware of the built-in behaviors of the Render Free platform:

### 1. Inactivity Spin-Down (Sleep Mode)
* **Behavior:** Render spins down free web services after **15 minutes of inactivity**.
* **Impact:** The next incoming HTTP request after sleep triggers a cold start.
* **Expected Cold Start Duration:** **35 to 50 seconds** (container provisioning + Temurin 21 JRE initialization + Spring Boot context startup).
* **Mitigation:** The frontend displays an animated loading splash screen with clear connectivity status.

### 2. Neon Serverless PostgreSQL Sleep Mode
* **Behavior:** Neon Serverless PostgreSQL suspends compute endpoints after **5 minutes of idle time**.
* **Impact:** The first database query after compute suspension takes **2 to 4 seconds** to wake up the Postgres compute engine.
* **Mitigation:** HikariCP is configured with a 30-second connection timeout, and Flyway retries connection attempts up to 10 times at 2-second intervals.

### 3. Shared Fractional CPU (0.5 vCPU)
* **Behavior:** Compute performance is throttled during intense CPU bursts.
* **Impact:** AST parsing of 100+ files may take **4 to 8 seconds** of CPU time.
* **Mitigation:** Single-job serialization (`Semaphore(1)`) prevents concurrent CPU starvation.

---

## 6. Zero-Budget Deployment Checklist

When deploying to Render Free:
- [x] Set service plan to **Free** in Render Dashboard or `render.yaml` (`plan: free`).
- [x] Ensure `JAVA_OPTS` matches the free-tier profile:
  ```bash
  -XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -XX:InitialRAMPercentage=25.0 -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=16m -Xss512k -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom
  ```
- [x] Health check path set to `/api/health`.
- [x] Database URL configured with SSL mode enabled (`?sslmode=require`).
- [x] Supabase authentication keys configured.
- [x] GitHub Personal Access Token configured to avoid public rate-limiting (60 req/hr).
