-- =============================================================================
-- Teardown: Drop triggers and trigger functions for doc gen status
-- Run manually (mirror of source_status_triggers_teardown.sql).
-- =============================================================================

DROP TRIGGER IF EXISTS doc_gen_status_trigger ON document_generations;
DROP FUNCTION IF EXISTS notify_doc_gen_status_update();
