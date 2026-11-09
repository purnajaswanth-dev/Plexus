# Plexus — Complete Render Deployment Guide

**Target Application:** Plexus — Cross-Repository Dependency Impact Analyzer & CodeCity  
**Target Platform:** Render (Docker Web Service)  
**Configuration Mode:** Multi-Stage Docker Build (Vite React + Spring Boot 3.2.5 + JRE 21)  

---

## 1. Overview & Cloud Architecture

Plexus runs on Render as a **Docker Web Service (Single Service Architecture)**:
* **Embedded Static Serving:** Embedded Tomcat serves both the pre-built React frontend and static HTML dashboard at `/`, and the REST API at `/api/**`.
* **Zero CORS Configuration:** Because all API calls originate from the same host, cross-origin request issues and CORS preflight delays are completely eliminated.
* **Stateless & Ephemeral:** The application processes repository archives in memory; all persistent state (repositories, nodes, edges, execution paths, layouts) resides in Neon PostgreSQL.
* **Port Binding:** Render assigns a dynamic port via the `$PORT` environment variable. Spring Boot automatically binds to `${PORT:8080}`.

---

## 2. Complete Environment Variables Specification

Configure the following environment variables in the Render Dashboard under **Environment** (or supply them when deploying via Blueprint).

| Environment Variable | Description | Secret? | Mandatory? | Default / Example Format | Where to Obtain It |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SPRING_DATASOURCE_URL` | JDBC Connection URL to Neon PostgreSQL with SSL enabled | **Yes** | **Mandatory** | `jdbc:postgresql://<neon-host>.neon.tech/neondb?sslmode=require` | **Neon Console** &rarr; Project &rarr; Dashboard &rarr; Connection Details &rarr; JDBC |
| `SPRING_DATASOURCE_USERNAME` | Neon database username | **Yes** | **Mandatory** | `neondb_owner` | **Neon Console** &rarr; Connection Details |
| `SPRING_DATASOURCE_PASSWORD` | Neon database user password | **Yes** | **Mandatory** | `<YOUR_NEON_PASSWORD>` | **Neon Console** &rarr; Connection Details &rarr; Show Password |
| `SUPABASE_JWT_ISSUER_URI` | Supabase OAuth2 JWT Issuer URI for token validation | No | **Mandatory** | `https://<project-ref>.supabase.co/auth/v1` | **Supabase Dashboard** &rarr; Project Settings &rarr; API &rarr; Project URL (`+ /auth/v1`) |
| `SUPABASE_JWKS_URI` | Supabase JWKS Endpoint URI for public key token verification | No | **Mandatory** | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` | **Supabase Dashboard** &rarr; Project URL (`+ /auth/v1/.well-known/jwks.json`) |
| `SUPABASE_URL` | Supabase API URL published to frontend client | No | **Mandatory** | `https://<project-ref>.supabase.co` | **Supabase Dashboard** &rarr; Project Settings &rarr; API &rarr; Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase public anonymous API key (also known as `anon` key) | No | **Mandatory** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | **Supabase Dashboard** &rarr; Project Settings &rarr; API &rarr; `anon` `public` key |
| `GITHUB_TOKEN` | GitHub Personal Access Token (classic with `public_repo` or fine-grained) | **Yes** | Optional *(Highly Recommended)* | `ghp_xxxxxxxxxxxxxxxxxxxx` | **GitHub** &rarr; Settings &rarr; Developer Settings &rarr; Personal Access Tokens |
| `PORT` | Dynamic HTTP port assigned by Render | No | Automatic | `10000` (Render assigns automatically) | Automatically provided by Render runtime |
| `JAVA_OPTS` | JVM container memory and tuning options | No | Optional | `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` | Defaults are pre-baked in `Dockerfile` |

> [!IMPORTANT]
> **Never commit real secrets or production `.env` files to Git.** All secrets must be entered directly into Render's secure environment variable manager.

---

## 3. Step-by-Step Deployment Instructions

### Method A: Deploy via Render Web Dashboard (Recommended)

#### Step 1: Connect GitHub Repository
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. In the top-right corner, click **New +** and select **Web Service**.
3. Under **Connect a Git repository**, choose your repository (`plexus` or `dependency-impact-mapper`).

#### Step 2: Configure Service Parameters
Configure the service with the following settings:

* **Name:** `plexus-impact-mapper`
* **Region:** Select the region closest to your Neon database (e.g. `Ohio (US East)` if creating new, or your existing service region `Oregon (US West)`).
* **Branch:** `main` (or your active release branch).
* **Root Directory:** *(leave blank — root of repository)*.
* **Runtime:** Select **Docker**.
* **Dockerfile Path:** `./Dockerfile`
* **Instance Type:** Select **Free** ($0/month, 512 MB RAM, 0.5 CPU).
  > [!NOTE]
  > Plexus is optimized for the **$0/month Free Tier** with hard-coded resource guards (max 150 source files per repo, max 15MB archive, 256MB heap cap, SerialGC, and single-job serialization). See [`docs/FREE_TIER_DEPLOYMENT_LIMITATIONS.md`](file:///c:/Users/sunka/OneDrive/coding/dependency/docs/FREE_TIER_DEPLOYMENT_LIMITATIONS.md) for details.

#### Step 3: Configure Health Check Path
Under **Advanced Settings**:
* **Health Check Path:** `/api/health`
* **Auto-Deploy:** `Yes` (automatically redeploys on push to `main`).

#### Step 4: Add Environment Variables
Scroll to the **Environment Variables** section and click **Add Environment Variable** for each entry:

```text
SPRING_DATASOURCE_URL      = jdbc:postgresql://ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
SPRING_DATASOURCE_USERNAME = neondb_owner
SPRING_DATASOURCE_PASSWORD = <YOUR_NEON_PASSWORD>
SUPABASE_JWT_ISSUER_URI    = https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWKS_URI          = https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_URL               = https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY   = <YOUR_SUPABASE_ANON_KEY>
GITHUB_TOKEN               = <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>
```

#### Step 5: Deploy
1. Click **Create Web Service**.
2. Render will trigger the Docker multi-stage build:
   - Stage 1: Compiles the Vite React frontend.
   - Stage 2: Compiles the Spring Boot backend into `app.jar`.
   - Stage 3: Packages the minimal Eclipse Temurin 21 JRE runtime.
3. Once the build completes, Render validates `GET /api/health` and displays the green **Live** status badge.

---

### Method B: Deploy via Render Blueprint (`render.yaml`)

If you prefer Infrastructure-as-Code:

1. Ensure the provided `render.yaml` is committed in your repository root.
2. In the Render Dashboard, click **Blueprints** &rarr; **New Blueprint Instance**.
3. Connect your repository.
4. Render will parse `render.yaml` and prompt you to input the secret values (`SPRING_DATASOURCE_PASSWORD`, `GITHUB_TOKEN`, etc.) marked with `sync: false`.
5. Click **Apply**. Render configures and provisions the Web Service automatically.

---

## 4. Post-Deployment Verification Checklist

Once the deployment status turns **Live**:

### 1. Verify Application Health Probe
Send an HTTP GET request to the public URL:
```bash
curl -i https://<your-service>.onrender.com/api/health
```
**Expected Response:** `HTTP 200 OK`
```json
{
  "service": "Plexus Dependency Impact Mapper",
  "timestamp": "2026-11-09T18:30:00Z",
  "status": "UP",
  "database": "CONNECTED"
}
```

### 2. Verify System Status Endpoint
```bash
curl -i https://<your-service>.onrender.com/api/settings/status
```
**Expected Response:** `HTTP 200 OK`
```json
{
  "databaseConnected": true,
  "repositoryCount": 2,
  "dependencyCount": 1,
  "githubRateLimit": { ... }
}
```

### 3. Verify Frontend & SPA Deep Linking
1. Open `https://<your-service>.onrender.com/` in your browser.
2. Verify that the login screen or application dashboard loads cleanly.
3. Test direct deep linking by opening `https://<your-service>.onrender.com/repositories` — verify that it renders the application shell without returning a 404.

### 4. Verify Authentication & CodeCity
1. Sign in using your Supabase credentials.
2. Open the **CodeCity** page and select a repository.
3. Confirm that the 3D CodeCity blocks and buildings render smoothly without console errors.

---

## 5. Troubleshooting & Operational Runbook

### Issue 1: Database Connection Timeout / Neon Cold Start
* **Symptom:** Application takes ~10 seconds on first request or health check times out after period of inactivity.
* **Root Cause:** Neon serverless PostgreSQL suspends compute after 5 minutes of inactivity. The first connection triggers a compute resume (wake up).
* **Fix Applied:** In `application.properties`, we configured HikariCP with:
  - `connectionTimeout=30000` (30 seconds)
  - `tcpKeepAlive=true`
  - `keepalive-time=30000`
  - `max-lifetime=180000`
  - Flyway has `connect-retries=10` and `connect-retries-interval=2`.

### Issue 2: Render Out-of-Memory (OOM) Kill
* **Symptom:** Render log displays `Exited with status 137 (Out of memory)`.
* **Root Cause:** JVM allocating heap larger than the container's memory limit.
* **Fix Applied:** The Dockerfile specifies:
  `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError`.
  If deploying on the Free 512MB tier, set the Render environment variable:
  `JAVA_OPTS = -XX:+UseContainerSupport -Xms128m -Xmx350m -XX:+ExitOnOutOfMemoryError`

### Issue 3: GitHub 403 Rate Limit Exceeded
* **Symptom:** Repository indexing fails or `/api/settings/status` shows 0 remaining requests.
* **Fix:** Ensure a valid `GITHUB_TOKEN` is configured in the Render Dashboard environment variables. Unauthenticated limits are 60 req/hr; token-authenticated limits are 5,000 req/hr.

### Issue 4: Free Tier Sleep Mode
* **Notice:** Render Free tier web services automatically spin down after 15 minutes of inactivity. When a new request arrives, Render takes 30–50 seconds to spin up the container. This is normal behavior on Render Free. Upgrading to the **Starter** plan ($7/mo) ensures 24/7 always-on uptime.

