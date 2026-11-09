# CODECITY & IMPACT MAPPER — API AUTHORIZATION MATRIX
**System**: Cross-Repo Dependency Impact Mapper & CodeCity Metropolis  
**Security Framework**: Spring Security 6 OAuth2 Resource Server (Supabase RS256 JWT)  
**Branch**: `feature/neon-supabase-multiuser`  
**Date**: November 2026  
**Status**: ACTIVE & ENFORCED

---

## 1. Overview

Every HTTP endpoint exposed by the application is cataloged below, detailing authentication tier, tenancy scoping rules, and error handling for unauthorized or cross-tenant access attempts.

---

## 2. API Authorization Matrix

| Category | HTTP Method | Endpoint Path | Auth Tier | Required Header | Tenant Scope | Unauthenticated (No Token) | Cross-Tenant (IDOR) |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **Public Assets** | `GET` | `/` | Public | None | None | `200 OK` | N/A |
| **Public Assets** | `GET` | `/index.html` | Public | None | None | `200 OK` | N/A |
| **Public Assets** | `GET` | `/css/**` | Public | None | None | `200 OK` | N/A |
| **Public Assets** | `GET` | `/js/**` | Public | None | None | `200 OK` | N/A |
| **Public Assets** | `GET` | `/graph-dist/**` | Public | None | None | `200 OK` | N/A |
| **Public Status** | `GET` | `/api/settings/status` | Public | None | Global system health | `200 OK` | N/A |
| **Public Auth** | `GET` | `/api/auth/config` | Public | None | Returns Supabase project URL & public anon key | `200 OK` | N/A |
| **Actuator** | `GET` | `/actuator/health` | Public | None | Spring Boot health check | `200 OK` | N/A |
| **Actuator** | `GET` | `/actuator/info` | Public | None | App version info | `200 OK` | N/A |
| **Repositories** | `GET` | `/api/repositories` | Protected | `Bearer <JWT>` | Only repositories owned by authenticated user | `401 Unauthorized` | N/A (Filtered out) |
| **Repositories** | `POST` | `/api/repositories` | Protected | `Bearer <JWT>` | Created repository assigned to authenticated user | `401 Unauthorized` | N/A |
| **Repositories** | `GET` | `/api/repositories/{id}` | Protected | `Bearer <JWT>` | Verified owner | `401 Unauthorized` | `404 Not Found` |
| **Repositories** | `DELETE`| `/api/repositories/{id}` | Protected | `Bearer <JWT>` | Verified owner | `401 Unauthorized` | `404 Not Found` |
| **Repositories** | `POST` | `/api/repositories/{id}/reindex` | Protected | `Bearer <JWT>` | Verified owner | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories` | Protected | `Bearer <JWT>` | Repositories owned by user with city summary | `401 Unauthorized` | N/A (Filtered out) |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/city` | Protected | `Bearer <JWT>` | 2D city layout model for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/endpoints` | Protected | `Bearer <JWT>` | Discovered endpoint list for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/apis` | Protected | `Bearer <JWT>` | Filterable API inventory for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/apis/{epId}` | Protected | `Bearer <JWT>` | Detailed API endpoint for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/apis/{epId}/journey` | Protected | `Bearer <JWT>` | Step-by-step route playback for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/execution-routes` | Protected | `Bearer <JWT>` | Execution routes for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/execution-paths/{epId}` | Protected | `Bearer <JWT>` | Static execution path for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/components/{key}` | Protected | `Bearer <JWT>` | Component inspector detail for owned repo | `401 Unauthorized` | `404 Not Found` |
| **CodeCity** | `GET` | `/api/codecity/repositories/{id}/intelligence` | Protected | `Bearer <JWT>` | Hotspots and warnings for owned repo | `401 Unauthorized` | `404 Not Found` |
| **Architecture** | `GET` | `/api/architecture/{id}` | Protected | `Bearer <JWT>` | Dependency hierarchy graph for owned repo | `401 Unauthorized` | `404 Not Found` |
| **Architecture** | `POST` | `/api/architecture/{id}/reindex` | Protected | `Bearer <JWT>` | Trigger architecture AST reindex for owned repo | `401 Unauthorized` | `404 Not Found` |
| **Graph Visuals**| `GET` | `/api/graph/ecosystem` | Protected | `Bearer <JWT>` | Bipartite ecosystem graph of user's repos | `401 Unauthorized` | N/A (Filtered out) |
| **Graph Visuals**| `GET` | `/api/graph/similarity` | Protected | `Bearer <JWT>` | Similarity network of user's repos | `401 Unauthorized` | N/A (Filtered out) |
| **Overview** | `GET` | `/api/overview` | Protected | `Bearer <JWT>` | Health score, stats, metrics for user's repos | `401 Unauthorized` | N/A (Aggregated) |
| **Explorer** | `GET` | `/api/dependencies/libraries` | Protected | `Bearer <JWT>` | Library inventory across user's repos | `401 Unauthorized` | N/A (Filtered out) |
| **Explorer** | `GET` | `/api/dependencies/libraries/{artifact}` | Protected | `Bearer <JWT>` | Library detail within user's repos | `401 Unauthorized` | N/A (Filtered out) |
| **Impact Analysis**| `POST` | `/api/impact/analyze` | Protected | `Bearer <JWT>` | Upgrade risk simulation across user's repos | `401 Unauthorized` | N/A (Scoped) |

---

## 3. Failure Mode Specifications

### 3.1 Unauthenticated Request (`HTTP 401 Unauthorized`)
Returned whenever a request arrives at a protected `/api/**` route without a valid `Authorization: Bearer <token>` header, or when the JWT signature / expiration check fails.
```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication required. Please sign in via Supabase."
}
```

### 3.2 IDOR / Cross-Tenant Request (`HTTP 404 Not Found`)
Returned whenever an authenticated user provides a `repositoryId` that belongs to another user.
```json
{
  "timestamp": "2026-11-08T20:30:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Repository not found with ID: 202"
}
```
*Zero-Disclosure Guarantee*: The response does not indicate whether ID 202 exists in another user's workspace, preventing user enumeration.
