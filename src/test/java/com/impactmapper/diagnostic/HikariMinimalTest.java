package com.impactmapper.diagnostic;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

public class HikariMinimalTest {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("       MINIMAL HIKARICP REPRODUCTION TEST        ");
        System.out.println("=================================================");

        Map<String, String> env = loadEnvFile(new File(".env"));
        String rawUrl = env.get("SPRING_DATASOURCE_URL");
        String username = env.get("SPRING_DATASOURCE_USERNAME");
        String password = env.get("SPRING_DATASOURCE_PASSWORD");

        // Clean URL as stored in .env
        String cleanUrl = rawUrl.replaceAll("([?&])(user|password|channelBinding)=[^&]*&?", "$1")
                                .replaceAll("\\?$", "").replaceAll("&&+", "&");
        if (!cleanUrl.contains("sslmode=")) {
            cleanUrl += (cleanUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }

        System.out.println("[HikariTest] Target URL: " + cleanUrl);
        System.out.println("[HikariTest] Username configured: " + (username != null && !username.isBlank()));
        System.out.println("[HikariTest] Password configured: " + (password != null && !password.isBlank()));

        // Scenario A: Exact configuration matching application.properties
        System.out.println("\n--- Testing HikariConfig exactly matching application.properties ---");
        testHikariConfig(cleanUrl, username, password, false);
    }

    private static void testHikariConfig(String url, String user, String pass, boolean useAlternative) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(user);
        config.setPassword(pass);
        config.setDriverClassName("org.postgresql.Driver");

        // Exact properties from application.properties
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setKeepaliveTime(30000);

        System.out.println("  Starting HikariDataSource...");
        long start = System.currentTimeMillis();
        try (HikariDataSource ds = new HikariDataSource(config)) {
            System.out.println("  HikariDataSource started. Requesting connection from pool...");
            try (Connection conn = ds.getConnection();
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT version(), current_database(), current_user")) {

                long elapsed = System.currentTimeMillis() - start;
                System.out.println("  >>> SUCCESS! Obtained connection from Hikari in " + elapsed + " ms <<<");
                if (rs.next()) {
                    System.out.println("  DB Version: " + rs.getString(1));
                    System.out.println("  DB Name:    " + rs.getString(2));
                    System.out.println("  DB User:    " + rs.getString(3));
                }
            }
        } catch (Throwable t) {
            long elapsed = System.currentTimeMillis() - start;
            System.err.println("  >>> HIKARI FAILED after " + elapsed + " ms <<<");
            System.err.println("  Exception:  " + t.getClass().getName() + ": " + t.getMessage());
            Throwable cause = t.getCause();
            if (cause != null) {
                System.err.println("  Cause:      " + cause.getClass().getName() + ": " + cause.getMessage());
                Throwable root = cause.getCause();
                if (root != null) {
                    System.err.println("  Root Cause: " + root.getClass().getName() + ": " + root.getMessage());
                }
            }
            System.err.println("  Stack Trace Top 10:");
            StackTraceElement[] st = t.getStackTrace();
            for (int i = 0; i < Math.min(10, st.length); i++) {
                System.err.println("    at " + st[i]);
            }
            if (cause != null) {
                System.err.println("  Cause Stack Trace Top 10:");
                StackTraceElement[] cst = cause.getStackTrace();
                for (int i = 0; i < Math.min(10, cst.length); i++) {
                    System.err.println("    at " + cst[i]);
                }
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
}
