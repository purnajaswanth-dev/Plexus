# Plexus — Deployment Architecture Audit & Topology Analysis

**Project:** Plexus (Cross-Repository Dependency Impact Analyzer & CodeCity)  
**Date:** November 2026  
**Auditor:** Senior DevOps & Cloud Infrastructure Architect  
**Target Platform:** Render Cloud Platform (Docker Runtime)  

---

## 1. Executive Summary

This document provides a comprehensive technical audit of the Plexus codebase in preparation for production deployment on Render using Docker. The audit evaluates the backend, frontend, database, security, networking, and deployment topology, identifying all potential deployment blockers and documenting their resolutions.

---

## 2. Complete Project Architecture Audit

### 2.1 Backend Architecture
* **Framework:** Spring Boot 3.2.5 on Java 17/21 LTS (compiled with Java 17 bytecode compatibility, tested on Eclipse Temurin 21).
* **Application Core:** REST API service providing dependency graph computation, impact simulation, repository AST parsing, CodeCity 3D layouts, and multi-user project management.
* **Data Access Layer:** Spring Data JPA with Hibernate 6.4.4.Final.
* **Connection Pooling:** HikariCP 5.0.3 with connection pooling tuned for serverless PostgreSQL (`minimum-idle=1`, `maximum-pool-size=10`, `max-lifetime=180000ms`, `keepalive-time=30000ms`, `connectTimeout=30s`).
* **Schema Migration:** Flyway 9.22.3 with automatic schema baseline and migration on startup (`db/migration/V1__initial_schema.sql`, `V2__architecture_models.sql`, `V3__fix_repo_dependencies_naming.sql`, `V4__architecture_indexes.sql`).
* **Security & Auth:** Spring Security 6.2.4 OAuth2 Resource Server validating Supabase JWT tokens via JSON Web Key Sets (JWKS).
* **AST & Code Analysis:** JavaParser 3.25.9 for in-memory Java code syntax and semantic parsing; OpenPDF 2.0.3 for export reports.

### 2.2 Frontend Architecture
* **Shell Architecture:** Single Page Application (SPA) dashboard shell served via `src/main/resources/static/index.html` with modular CSS token design system and vanilla JavaScript controllers (`js/app.js`, `js/api.js`, `js/state.js`, `js/components.js`, `js/pages/*.js`).
* **Visualization Layer:** Modern React 19 component library (`frontend/src`) utilizing `@xyflow/react` (v12.12.1) and D3.js (v7) for interactive CodeCity and dependency architecture visualizations.
* **Build System:** Vite 8.3.6 bundling React components into `src/main/resources/static/graph-dist/graph-explorer.js` and `graph-explorer.css`.
* **Routing:** Hash-based SPA client routing (`#overview`, `#repositories`, `#explorer`, `#impact`, `#network`, `#settings`, `#codecity`) combined with Spring Boot fallback controller (`SpaForwardingController`) for direct deep linking.

### 2.3 Database Architecture & Neon PostgreSQL
* **Engine:** PostgreSQL 16/18 hosted on Neon Serverless PostgreSQL.
* **Connection Mode:** Pooled JDBC connection with SSL enabled (`sslmode=require`).
* **Flyway Migration Strategy:** Flyway runs automatically on application boot. All migrations V1 through V4 have been verified and applied to the database. Migrations are strictly backward-compatible.
* **Connection Stability:** HikariCP configuration incorporates TCP keepalive (`tcpKeepAlive=true`), socket timeout (`socketTimeout=120`), and query retry logic to withstand Neon compute auto-suspend and cold starts.

### 2.4 Authentication & Authorization Architecture
* **Provider:** Supabase Auth (OAuth2 / OIDC).
* **Token Verification:** Stateless RS256/ES256 cryptographic JWT verification using public keys retrieved from `SUPABASE_JWKS_URI`.
* **Multi-User Isolation:** Every data entity (`RepositoryEntity`, `CodeCityLayoutEntity`, `ArchitectureSnapshotEntity`, etc.) enforces strict per-user multi-tenant isolation keyed by `user_id` extracted from JWT claims (`sub`).
* **Client Handshake:** `AuthController` exposes `GET /api/auth/config` (unauthenticated) to deliver public Supabase credentials (`supabaseUrl`, `supabasePublishableKey`) to the browser, eliminating build-time secret injection.

### 2.5 GitHub API Integration
* **Service:** `GitHubService` communicates with GitHub REST API v3 using Spring `RestClient`.
* **Authentication:** Uses optional `GITHUB_TOKEN` environment variable.
* **Rate Limits:** Unauthenticated requests allow 60 requests/hour; authenticated requests allow 5,000 requests/hour.
* **Health Decoupling:** General application vitality does not depend on GitHub API availability.

### 2.6 CodeCity Visualization Architecture
* **Parsing Engine:** Remote repository archives are downloaded via ZIP stream directly into memory.
* **AST Extraction:** `JavaSourceAnalysisService` analyzes classes, methods, annotations, and call paths without writing any files to local disk.
* **Layout Generation:** `CodeCityService` deterministically maps classes to buildings, packages to districts, and endpoint metrics to city heights and footprints.

### 2.7 Filesystem Audit & Ephemerality
* **Disk Usage:** 100% ephemeral. No files are written to the local container disk.
* **ZIP Processing:** Streamed in memory using `ZipInputStream`.
* **Render Compatibility:** Completely safe for Render ephemeral disk instances without requiring paid persistent volume add-ons.

### 2.8 Ports, Observability & Health Checks
* **Port Binding:** Dynamically binds to `server.port=${PORT:8080}` to support Render's dynamically allocated `$PORT`.
* **Observability:** `DatabaseDiagnosticFilter` logs structured transaction duration and HikariCP connection pool metrics under MDC correlation IDs.
* **Health Probes:**
  - `GET /api/health`: Validates web server and live database connectivity via `connection.isValid(2)`.
  - `GET /api/health/liveness`: Fast non-blocking HTTP 200 response for container orchestration.
  - `GET /api/settings/status`: Detailed system status and repository metrics.

---

## 3. Deployment Topology Selection

### 3.1 Evaluated Topologies

#### Option A: Unified Web Service Container (Single Container)
* **Architecture:** Docker multi-stage build compiles the Vite React application, copies the compiled assets into Spring Boot's `src/main/resources/static/graph-dist/`, and packages a single executable Spring Boot JAR running on Eclipse Temurin 21 JRE Alpine.
* **Serving:** Embedded Tomcat serves both the static web dashboard assets at `/` and the REST API at `/api/**`.

#### Option B: Split Frontend Static Site + Backend Web Service (Two Services)
* **Architecture:** Vite React frontend deployed to Render Static Sites; Spring Boot backend deployed as a separate Render Web Service.

### 3.2 Topology Comparison Matrix

| Evaluation Dimension | Option A: Single Web Service | Option B: Split Frontend + Backend |
| :--- | :--- | :--- |
| **CORS Configuration** | **Zero CORS.** Same-origin requests (`/api/*`). | Requires permissive CORS headers, preflight latency on every request. |
| **Authentication Flow** | Seamless. Supabase tokens and cookies share identical origin. | Cross-site cookie/token constraints; potential browser third-party tracking blocking. |
| **Domain & SSL Management** | 1 custom domain, 1 automatic SSL certificate managed by Render. | 2 domains/subdomains, 2 SSL certificates. |
| **Compute & Hosting Cost** | **50% lower cost.** Fits entirely on 1 Render instance. | Requires 2 separate services; higher monthly platform costs. |
| **Deployment Complexity** | 1 Git commit triggers 1 unified build and deployment. | Coordinated deployments required; risk of frontend-backend version mismatch. |
| **Failure Modes** | Self-contained. Frontend and backend always deploy in sync. | Desynchronized state if one build succeeds and the other fails. |
| **SPA Route Handling** | Handled natively by `SpaForwardingController`. | Requires Render Rewrite/Redirect rules in dashboard. |

### 3.3 Topology Decision: Option A Selected
Option A is unambiguously superior for Plexus. Because the application was designed with unified static asset serving and relative `/api` paths, containerizing both into a single Web Service provides the highest reliability, lowest latency, zero CORS surface area, and lowest operational cost.

---

## 4. Deployment Blockers Identified & Resolutions

| # | Identified Blocker | Impact | Resolution Implemented |
| :- | :--- | :--- | :--- |
| 1 | Hardcoded `server.port=8080` | Render allocates random `$PORT` (e.g. 10000); container would fail to route traffic. | Updated `application.properties` to `server.port=${PORT:8080}`. |
| 2 | Missing decoupled health check | `/api/settings/status` invokes GitHub API; if rate-limited, Render would mark app unhealthy. | Created `HealthController` with lightweight, non-blocking `/api/health` and `/api/health/liveness`. |
| 3 | Abrupt container restarts | Render sends SIGTERM on deployment or scale-down; in-flight indexing requests could terminate mid-transaction. | Configured `server.shutdown=graceful` and `spring.lifecycle.timeout-per-shutdown-phase=30s`. |
| 4 | Client SPA deep link 404s | Direct browser navigation to `/codecity` or `/repositories` would return 404 from Tomcat. | Implemented `SpaForwardingController` forwarding non-API client routes to `forward:/index.html`. |
| 5 | Non-root container security | Running as root violates production container security policies. | Added dedicated `appuser` (UID 10001) / `appgroup` (GID 10001) in Dockerfile. |
| 6 | JVM memory exhaustion | Java inside container might not detect Docker cgroup limits, causing Render OOM kills. | Configured `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError`. |

