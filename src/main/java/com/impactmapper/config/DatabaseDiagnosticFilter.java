package com.impactmapper.config;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.sql.DataSource;
import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class DatabaseDiagnosticFilter extends OncePerRequestFilter {

    private final DataSource dataSource;

    @Autowired
    public DatabaseDiagnosticFilter(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        long startTime = System.currentTimeMillis();
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString().substring(0, 8);
        }

        MDC.put("correlationId", correlationId);
        response.setHeader("X-Correlation-ID", correlationId);

        String path = request.getRequestURI();
        String method = request.getMethod();

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            int status = response.getStatus();

            // Safe HikariCP Pool metrics
            int active = -1;
            int idle = -1;
            int pending = -1;
            int total = -1;

            if (dataSource instanceof HikariDataSource hikari) {
                HikariPoolMXBean poolBean = hikari.getHikariPoolMXBean();
                if (poolBean != null) {
                    active = poolBean.getActiveConnections();
                    idle = poolBean.getIdleConnections();
                    pending = poolBean.getThreadsAwaitingConnection();
                    total = poolBean.getTotalConnections();
                }
            }

            // Only log for API requests to avoid noisy static asset logs
            if (path.startsWith("/api/")) {
                if (status >= 400 || duration > 1000) {
                    log.warn("[DB-DIAGNOSTIC] [req={}] [status={}] [{} {}] [duration={}ms] [hikari: active={}, idle={}, pending={}, total={}]",
                            correlationId, status, method, path, duration, active, idle, pending, total);
                } else {
                    log.info("[DB-DIAGNOSTIC] [req={}] [status={}] [{} {}] [duration={}ms] [hikari: active={}, idle={}, pending={}, total={}]",
                            correlationId, status, method, path, duration, active, idle, pending, total);
                }
            }

            MDC.remove("correlationId");
        }
    }
}

