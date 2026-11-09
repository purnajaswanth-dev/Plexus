# syntax=docker/dockerfile:1.4
# ==============================================================================
# Plexus — Dependency Impact Analyzer & CodeCity
# Production Multi-Stage Dockerfile for Render / Cloud Containers
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the Vite / React Frontend Bundle
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Build arguments for Vite frontend bundling
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL=""

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install dependencies with frozen lockfile for build reproducibility
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source and configuration
COPY frontend ./

# Run production Vite build (outputs to ../src/main/resources/static/graph-dist)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build the Spring Boot Backend (Fat JAR)
# ------------------------------------------------------------------------------
FROM maven:3.9.6-eclipse-temurin-21-alpine AS backend-builder
WORKDIR /app

# Cache Maven dependencies in an isolated layer
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy Spring Boot backend source code and static templates
COPY src ./src

# Copy the fresh frontend compilation artifact from Stage 1
COPY --from=frontend-builder /app/src/main/resources/static/graph-dist ./src/main/resources/static/graph-dist

# Build the production executable JAR (skipping test execution in Docker build)
RUN mvn clean package -DskipTests -B

# ------------------------------------------------------------------------------
# Stage 3: Secure, Minimal JRE Runtime Container
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime

# Install curl for reliable container health checks
RUN apk add --no-cache curl tzdata

# Security hardening: Create non-root dedicated application user & group
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

# Copy executable jar from backend-builder with non-root ownership
COPY --from=backend-builder --chown=appuser:appgroup /app/target/*.jar app.jar

# Production JVM tuning for container environments:
# - Calibrated for 512MB Render instances (50% max RAM percentage = 256MB heap cap)
# - Metaspace, CodeCache, DirectMemory, and ThreadStack bounds prevent non-heap Linux cgroup OOM kills
# - UseSerialGC eliminates multi-threaded GC card-table overhead on single/fractional CPU containers
# - Overrideable via Render Dashboard environment variable JAVA_OPTS for 2GB+ tiers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -XX:InitialRAMPercentage=25.0 -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=16m -Xss512k -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
ENV PORT=8080

# Expose HTTP port (Render dynamically sets PORT at runtime)
EXPOSE 8080

# Switch to unprivileged non-root user
USER appuser

# Health check probe against dedicated unauthenticated liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health/liveness || exit 1

# Execute Spring Boot application
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]

