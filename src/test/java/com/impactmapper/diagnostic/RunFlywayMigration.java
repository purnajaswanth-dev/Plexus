package com.impactmapper.diagnostic;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;

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

public class RunFlywayMigration {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("   FLYWAY MIGRATION & SCHEMA VERIFICATION RUN    ");
        System.out.println("=================================================");

        Map<String, String> env = loadEnvFile(new File(".env"));
        String rawUrl = env.get("SPRING_DATASOURCE_URL");
        String username = env.get("SPRING_DATASOURCE_USERNAME");
        String password = env.get("SPRING_DATASOURCE_PASSWORD");

        // Clean URL
        String cleanUrl = rawUrl.replaceAll("([?&])(user|password|channelBinding)=[^&]*&?", "$1")
                                .replaceAll("\\?$", "").replaceAll("&&+", "&");
        if (!cleanUrl.contains("sslmode=")) {
            cleanUrl += (cleanUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }

        System.out.println("[Flyway] Configuring Flyway against Neon...");
        Flyway flyway = Flyway.configure()
                .dataSource(cleanUrl, username, password)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .load();

        System.out.println("\n[Flyway] Inspecting current migration status:");
        for (MigrationInfo info : flyway.info().all()) {
            System.out.printf("  Version: %-4s | Description: %-40s | State: %s%n",
                    info.getVersion(), info.getDescription(), info.getState());
        }

        System.out.println("\n[Flyway] Executing migrate()...");
        int applied = flyway.migrate().migrationsExecuted;
        System.out.println("[Flyway] Migrations executed in this run: " + applied);

        System.out.println("\n[Flyway] Updated migration status:");
        for (MigrationInfo info : flyway.info().all()) {
            System.out.printf("  Version: %-4s | Description: %-40s | State: %s%n",
                    info.getVersion(), info.getDescription(), info.getState());
        }

        // Now inspect the information_schema for repo_dependencies columns
        System.out.println("\n[Schema Verification] Querying information_schema for repo_dependencies columns:");
        Properties props = new Properties();
        if (username != null) props.setProperty("user", username);
        if (password != null) props.setProperty("password", password);

        try (Connection conn = DriverManager.getConnection(cleanUrl, props);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT column_name, data_type, is_nullable " +
                     "FROM information_schema.columns " +
                     "WHERE table_name = 'repo_dependencies' " +
                     "ORDER BY ordinal_position")) {

            while (rs.next()) {
                System.out.printf("  Column: %-20s | Type: %-15s | Nullable: %s%n",
                        rs.getString("column_name"),
                        rs.getString("data_type"),
                        rs.getString("is_nullable"));
            }
        } catch (Exception e) {
            System.err.println("Failed to query information_schema: " + e.getMessage());
        }

        System.out.println("\n[Schema Verification] Complete.");
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
