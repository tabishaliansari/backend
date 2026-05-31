-- =============================================================================
-- PostgreSQL LISTEN/NOTIFY Trigger Function and Trigger
-- Channel: source_status_updates  (shared with source indexing triggers)
--
-- Trigger fires AFTER UPDATE on document_generations when status,
-- progress_percent, or error_message changes.
-- The listener dispatches events keyed by doc_gen_id.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FUNCTION: notify_doc_gen_status_update
-- Fires on document_generations status/progress changes.
-- Publishes to the shared source_status_updates channel.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_doc_gen_status_update()
RETURNS TRIGGER AS $$
DECLARE
    payload TEXT;
BEGIN
    payload := json_build_object(
        'event',            'doc_gen_status_changed',
        'doc_gen_id',       NEW.id,
        'source_id',        NEW.source_id,
        'status',           NEW.status,
        'progress_percent', NEW.progress_percent,
        'error_message',    NEW.error_message
    )::text;

    PERFORM pg_notify('source_status_updates', payload);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- TRIGGER: doc_gen_status_trigger
-- AFTER UPDATE on document_generations — only when meaningful fields change.
-- -----------------------------------------------------------------------------

CREATE TRIGGER doc_gen_status_trigger
AFTER UPDATE ON document_generations
FOR EACH ROW
WHEN (
    OLD.status            IS DISTINCT FROM NEW.status
    OR
    OLD.progress_percent  IS DISTINCT FROM NEW.progress_percent
    OR
    OLD.error_message     IS DISTINCT FROM NEW.error_message
)
EXECUTE FUNCTION notify_doc_gen_status_update();
