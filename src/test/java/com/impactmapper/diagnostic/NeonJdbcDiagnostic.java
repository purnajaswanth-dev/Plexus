package com.impactmapper.diagnostic;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

public class NeonJdbcDiagnostic {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("  INDEPENDENT NEON JDBC CONNECTIVITY DIAGNOSTIC  ");
        System.out.println("=================================================");

        Map<String, String> env = loadEnvFile(new File(".env"));
        String rawUrl = env.get("SPRING_DATASOURCE_URL");
        String username = env.get("SPRING_DATASOURCE_USERNAME");
        String password = env.get("SPRING_DATASOURCE_PASSWORD");

        if (rawUrl == null || rawUrl.isBlank()) {
            System.err.println("FATAL: SPRING_DATASOURCE_URL not found in .env");
            return;
        }

        // Safe URL sanitization for logging (strip password and user query params)
        String safeLogUrl = rawUrl.replaceAll("password=[^&]*", "password=***")
                                  .replaceAll("user=[^&]*", "user=***");
        System.out.println("[Config] Target JDBC URL: " + safeLogUrl);
        System.out.println("[Config] Explicit Username configured: " + (username != null && !username.isBlank()));
        System.out.println("[Config] Explicit Password configured: " + (password != null && !password.isBlank()));

        // Test Scenario 1: Exact URL from .env
        System.out.println("\n--- [Scenario 1] Connecting with exact .env configuration ---");
        testConnection(rawUrl, username, password, "Scenario 1 (As configured)");

        // Test Scenario 2: If URL has embedded user/password/channelBinding, test with clean URL + properties
        String cleanUrl = stripQueryParam(rawUrl, "channelBinding");
        cleanUrl = stripQueryParam(cleanUrl, "user");
        cleanUrl = stripQueryParam(cleanUrl, "password");
        if (!cleanUrl.contains("sslmode=")) {
            cleanUrl += (cleanUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }

        System.out.println("\n--- [Scenario 2] Connecting with clean URL (no channelBinding/duplicate params) ---");
        String safeCleanLogUrl = cleanUrl.replaceAll("password=[^&]*", "password=***")
                                         .replaceAll("user=[^&]*", "user=***");
        System.out.println("[Config] Clean JDBC URL: " + safeCleanLogUrl);
        testConnection(cleanUrl, username, password, "Scenario 2 (Clean URL)");
    }

    private static void testConnection(String url, String user, String pass, String scenarioName) {
        long start = System.currentTimeMillis();
        try {
            Class.forName("org.postgresql.Driver");
            Properties props = new Properties();
            if (user != null && !user.isBlank()) {
                props.setProperty("user", user);
            }
            if (pass != null && !pass.isBlank()) {
                props.setProperty("password", pass);
            }
            props.setProperty("connectTimeout", "10");
            props.setProperty("loginTimeout", "10");

            System.out.println("  Initiating connection attempt...");
            try (Connection conn = DriverManager.getConnection(url, props);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT version(), current_database(), current_user")) {

                long elapsed = System.currentTimeMillis() - start;
                System.out.println("  >>> SUCCESS! Connected in " + elapsed + " ms <<<");
                if (rs.next()) {
                    System.out.println("  Database Version: " + rs.getString(1));
                    System.out.println("  Connected DB:     " + rs.getString(2));
                    System.out.println("  Current User:     " + rs.getString(3));
                }

                // Verify the exact query that failed previously
                try (var ps = conn.prepareStatement("DELETE FROM repo_dependencies WHERE repo_id = ?")) {
                    ps.setLong(1, 999999L);
                    int affected = ps.executeUpdate();
                    System.out.println("  [VERIFICATION] Executed 'DELETE FROM repo_dependencies WHERE repo_id = ?' successfully! Rows affected: " + affected);
                }
            }
        } catch (Throwable t) {
            long elapsed = System.currentTimeMillis() - start;
            System.out.println("  >>> FAILED after " + elapsed + " ms <<<");
            categorizeFailure(t);
        }
    }

    private static void categorizeFailure(Throwable t) {
        String msg = t.getMessage() != null ? t.getMessage() : "";
        Throwable cause = t.getCause();
        String causeMsg = cause != null ? cause.getMessage() : "";
        String failureClass = t.getClass().getName();
        String causeClass = cause != null ? cause.getClass().getName() : "None";

        System.out.println("  Exception:   " + failureClass + ": " + msg);
        System.out.println("  Root Cause:  " + causeClass + ": " + causeMsg);

        // Classify the failure point
        if (msg.contains("Connection reset") || causeMsg.contains("Connection reset")) {
            System.out.println("  >>> CLASSIFICATION: POSTGRESQL SSL NEGOTIATION / TCP RESET FAILURE <<<");
            System.out.println("      Evidence: Connection was reset during SSL handshake.");
            System.out.println("      Root cause: Intermediate network/firewall/DPI middlebox or network blocking port 5432.");
        } else if (msg.contains("authentication failed") || msg.contains("password authentication failed")) {
            System.out.println("  >>> CLASSIFICATION: AUTHENTICATION FAILURE (Network & SSL Succeeded!) <<<");
            System.out.println("      Evidence: Reachable, SSL negotiated, but credentials rejected.");
        } else if (msg.contains("Connection refused") || msg.contains("timed out")) {
            System.out.println("  >>> CLASSIFICATION: TCP CONNECTION TIMEOUT / REFUSED <<<");
        } else if (msg.contains("certificate") || msg.contains("PKIX")) {
            System.out.println("  >>> CLASSIFICATION: TLS CERTIFICATE VALIDATION FAILURE <<<");
        } else {
            System.out.println("  >>> CLASSIFICATION: UNEXPECTED FAILURE (" + failureClass + ") <<<");
        }

        // Print truncated stack trace (top 5 lines)
        System.out.println("  Stack Trace Summary:");
        StackTraceElement[] st = t.getStackTrace();
        for (int i = 0; i < Math.min(6, st.length); i++) {
            System.out.println("    at " + st[i]);
        }
        if (cause != null) {
            System.out.println("  Caused by:");
            StackTraceElement[] cst = cause.getStackTrace();
            for (int i = 0; i < Math.min(6, cst.length); i++) {
                System.out.println("    at " + cst[i]);
            }
        }
    }

    private static Map<String, String> loadEnvFile(File file) {
        Map<String, String> map = new HashMap<>();
        if (!file.exists()) return map;
        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int eq = line.indexOf('=');
                if (eq > 0) {
                    String k = line.substring(0, eq).trim();
                    String v = line.substring(eq + 1).trim();
                    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.substring(1, v.length() - 1);
                    }
                    map.put(k, v);
                }
            }
        } catch (Exception e) {
            System.err.println("Warning: failed to read .env: " + e.getMessage());
        }
        return map;
    }

    private static String stripQueryParam(String url, String param) {
        return url.replaceAll("([?&])" + param + "=[^&]*&?", "$1").replaceAll("\\?$", "").replaceAll("&&+", "&");
    }
}

