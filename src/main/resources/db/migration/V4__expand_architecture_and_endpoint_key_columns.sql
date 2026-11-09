-- V4__expand_architecture_and_endpoint_key_columns.sql
-- Expand architecture, endpoint, and execution step key columns to TEXT to avoid truncation of long identifiers and file paths.

ALTER TABLE architecture_nodes
    ALTER COLUMN node_key TYPE TEXT,
    ALTER COLUMN name TYPE TEXT,
    ALTER COLUMN file_path TYPE TEXT,
    ALTER COLUMN package_or_module TYPE TEXT;

ALTER TABLE architecture_edges
    ALTER COLUMN source_node_key TYPE TEXT,
    ALTER COLUMN target_node_key TYPE TEXT;

ALTER TABLE code_endpoints
    ALTER COLUMN route_path TYPE TEXT,
    ALTER COLUMN controller_class TYPE TEXT,
    ALTER COLUMN handler_method TYPE TEXT,
    ALTER COLUMN source_file TYPE TEXT,
    ALTER COLUMN node_key TYPE TEXT;

ALTER TABLE static_execution_steps
    ALTER COLUMN source_component_key TYPE TEXT,
    ALTER COLUMN source_component_name TYPE TEXT,
    ALTER COLUMN target_component_key TYPE TEXT,
    ALTER COLUMN target_component_name TYPE TEXT;

