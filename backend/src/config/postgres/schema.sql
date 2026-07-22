-- =============================================================================
-- PIP — PostgreSQL operational-data schema (Sprint 2A)
--
-- Covers the four source datasets (order, payment, api-log, terminal-events)
-- plus the dimension/relationship/operational tables from the finalized
-- architecture review. This file is NOT executed automatically — run it
-- manually against pip_db when ready:
--
--   psql -h localhost -U postgres -d pip_db -f schema.sql
--
-- Firestore remains the system of record for incidents/investigations/etc.
-- This schema is an additional, separate datastore for operational payment
-- data. No cross-database foreign keys are possible or attempted.
-- =============================================================================


-- =============================================================================
-- DIMENSIONS
-- =============================================================================

-- No source file provides merchant attributes beyond the bare ID — descriptive
-- columns below are placeholders for future enrichment (onboarding data, admin
-- UI, etc.) and are nullable until such a source exists.
CREATE TABLE merchant (
    merchant_id     VARCHAR(64) PRIMARY KEY,
    merchant_type   VARCHAR(32),                    -- e.g. 'RETAIL' | 'FLEET_OPERATOR' — see TODO below
    name            VARCHAR(255),
    status          VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN merchant.merchant_type IS
    'TODO: terminal_events samples showed two distinct merchant_id values in the same file — '
    'one matching the retail merchant seen in order/payment, one that looked like a platform/fleet '
    'identifier. merchant_type is a placeholder to eventually distinguish these; not confirmed against full data.';

CREATE TABLE store (
    store_id        VARCHAR(64) PRIMARY KEY,
    merchant_id     VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE terminal (
    terminal_id     VARCHAR(64) PRIMARY KEY,
    merchant_id     VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),  -- owning/fleet merchant
    store_id        VARCHAR(64) REFERENCES store(store_id),                -- nullable: deployment location, if known
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Human-readable "TC" terminal codes seen in payment.terminal_code (a JSON
-- array). This is a DIFFERENT identifier namespace from the hex terminal_id
-- used everywhere else — no confirmed mapping between the two exists yet.
CREATE TABLE terminal_code (
    terminal_code   VARCHAR(64) PRIMARY KEY,
    terminal_id     VARCHAR(64),  -- TODO: no FK — crosswalk to terminal.terminal_id never verified against real data
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN terminal_code.terminal_id IS
    'TODO: unverified crosswalk. terminal_code ("TC000088"-style) and terminal.terminal_id (hex-style) '
    'are two distinct namespaces observed in the source data; no join was ever confirmed between them. '
    'Do not add a FOREIGN KEY constraint here until that mapping is validated.';


-- =============================================================================
-- OPERATIONAL — import lineage (created before fact tables so they can FK to it)
-- =============================================================================

CREATE TABLE import_jobs (
    import_job_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_type     VARCHAR(32) NOT NULL,   -- 'order' | 'payment' | 'api_log' | 'terminal_event'
    source_file_name VARCHAR(255) NOT NULL,
    file_checksum    VARCHAR(64),            -- sha256 hex, for re-run idempotency
    status           VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING | RUNNING | SUCCEEDED | FAILED
    row_count        INTEGER,
    error_count      INTEGER,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sprint 3C fix: a blanket UNIQUE(file_checksum) blocked ever retrying a file
-- whose first attempt failed (e.g. every row rejected by a not-yet-populated
-- dimension FK) — "SUCCEEDED" here means the ETL process ran to completion,
-- not that every row succeeded, so a fully-failed run still counted as a
-- taken checksum forever. A partial index only reserves the checksum once a
-- run has actually completed cleanly (status SUCCEEDED and zero row errors),
-- so a genuine retry after fixing an upstream data problem is still allowed,
-- while an already-clean file can never be silently reimported/duplicated.
CREATE UNIQUE INDEX uq_import_jobs_checksum_on_clean_success
    ON import_jobs (file_checksum)
    WHERE status = 'SUCCEEDED' AND COALESCE(error_count, 0) = 0;

-- Persistent row-level failure tracking (Sprint 3A.5). Every row-level
-- failure the ETL framework encounters (CSV parse error, transform error,
-- validation error, or an insert that failed even after batch fallback) is
-- recorded here instead of only being logged to the console.
CREATE TABLE import_errors (
    error_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    import_job_id  BIGINT REFERENCES import_jobs(import_job_id),
    dataset        VARCHAR(32) NOT NULL,
    row_number     INTEGER NOT NULL,
    error_type     VARCHAR(32) NOT NULL,  -- 'CSV_PARSE' | 'TRANSFORM' | 'VALIDATION' | 'INSERT'
    error_message  TEXT NOT NULL,
    raw_row        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_errors_import_job_id ON import_errors(import_job_id);
CREATE INDEX idx_import_errors_dataset ON import_errors(dataset);
CREATE INDEX idx_import_errors_error_type ON import_errors(error_type);
CREATE INDEX idx_import_errors_raw_row_gin ON import_errors USING GIN (raw_row);


-- =============================================================================
-- FACT — orders
-- =============================================================================

CREATE TABLE orders (
    order_id                  VARCHAR(64) PRIMARY KEY,
    merchant_id               VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),
    terminal_id               VARCHAR(64) REFERENCES terminal(terminal_id),
    reference_id              VARCHAR(128),   -- shape inconsistent in samples (short numeric vs long ID) — kept as free text
    currency_code             VARCHAR(8),     -- empty in every sample seen; distinct from `currency` below
    meta_data                 JSONB,
    order_date                TIMESTAMPTZ,    -- renamed from source column `date` (reserved-word collision)
    order_status              VARCHAR(32) NOT NULL,
    currency                  VARCHAR(3),     -- ISO 4217 numeric code observed (e.g. '208'); stored as text, not assumed numeric
    campaign_amount            BIGINT,
    shipping_amount            BIGINT,
    regular_amount              BIGINT,
    total_amount               BIGINT NOT NULL,
    customer_id                VARCHAR(64),
    billing_address_id         VARCHAR(64),
    shipping_address_id        VARCHAR(64),
    billing_phone_number_id    VARCHAR(64),
    shipping_phone_number_id   VARCHAR(64),
    billing_email_entry_id     VARCHAR(64),
    shipping_email_entry_id    VARCHAR(64),
    control_functions          JSONB,
    billing_name               VARCHAR(255),
    shipping_name               VARCHAR(255),
    company                    VARCHAR(255),
    created_at                 TIMESTAMPTZ NOT NULL,
    updated_at                 TIMESTAMPTZ,
    created_by                 VARCHAR(64),
    updated_by                 VARCHAR(64),
    comments                   TEXT,
    originated_by              VARCHAR(64),
    import_job_id               BIGINT REFERENCES import_jobs(import_job_id)
);


-- =============================================================================
-- FACT — payments (aggregate) + payment_events (lifecycle log)
--
-- Sprint 9C.3 — Payment Domain Model Implementation. Prior to this sprint,
-- `payments` held one row per source CSV row (i.e. one row per gateway
-- callback), which meant a single logical payment with multiple lifecycle
-- updates produced multiple, PK-colliding rows — the root cause of the
-- Sprint 9C migration slowdown. The approved architecture (locked in
-- Sprint 9C.2/9C.2A) splits this into two tables:
--
--   payments        — one row per logical payment. A PURE derived aggregate:
--                      every column (besides payment_id) is computed from
--                      that payment's full payment_events history, never
--                      written directly from a CSV row. See the aggregation
--                      rules documented above CREATE TABLE payment_events.
--   payment_events   — append-only lifecycle log, one row per source CSV
--                      row / gateway callback, mirroring the full original
--                      row shape. entry_id (already unique per row in the
--                      source data) is its natural primary key — no
--                      invented surrogate key. This is the ONLY table ETL
--                      writes to directly (importFile()/batchInsert is
--                      single-table-per-row) — payments is (re)computed from
--                      it by a separate aggregation step.
--
-- Current Status Derivation Rule (must be implemented identically by ETL,
-- Correlation Engine, Incident Detection, AI Investigation, and the REST
-- API — no component may substitute a different ordering or tie-breaker):
--   1. Collect all payment_events rows for a payment_id.
--   2. ORDER BY event_timestamp DESC, entry_id DESC.
--   3. The first row after sorting is authoritative — its payment_status and
--      event_timestamp become payments.current_status/current_status_at.
-- This DESC "find the latest" sort is distinct from the Timeline's ASC
-- chronological-narrative sort — the two must never be conflated.
-- =============================================================================

CREATE TABLE payments (
    payment_id              VARCHAR(64) PRIMARY KEY,
    order_id                VARCHAR(64) REFERENCES orders(order_id),
    amount                  BIGINT NOT NULL,
    merchant_id             VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),
    checkout_id             VARCHAR(64),
    currency                VARCHAR(3),
    payment_type            VARCHAR(32) NOT NULL,   -- only 'PURCHASE' observed in samples; see TODO below
    payment_method           VARCHAR(32),
    payee_phone_number       VARCHAR(32),
    created_at               TIMESTAMPTZ NOT NULL,   -- MIN(payment_events.event_timestamp) for this payment_id — true business origination time, derived the same way current_status_at derives MAX. No longer the source CSV row's own created_at (see payment_events.created_at for that).
    transaction_id           VARCHAR(64),   -- confirmed stable across a payment's lifecycle (Sprint 9C.2A)
    voided                   BOOLEAN NOT NULL DEFAULT false,
    void_requested_at        TIMESTAMPTZ,
    void_status               VARCHAR(32),
    store_id                 VARCHAR(64) REFERENCES store(store_id),
    card_brand                VARCHAR(32),   -- denormalized: first non-empty/non-UNKNOWN value seen across this payment's events (NOT "latest wins" — confirmed via evidence, Sprint 9C.2A)
    purchase_payment_id      VARCHAR(64) REFERENCES payments(payment_id),
    reference_payment_id     VARCHAR(64) REFERENCES payments(payment_id),
    originated_by            VARCHAR(64),
    import_job_id             BIGINT REFERENCES import_jobs(import_job_id),   -- most recent import job whose event touched this aggregate
    current_status            VARCHAR(32),   -- derived via the Current Status Derivation Rule — never written directly by ETL
    current_status_at         TIMESTAMPTZ    -- event_timestamp of the payment_events row selected by the Current Status Derivation Rule
);

COMMENT ON COLUMN payments.payment_type IS
    'TODO: every sampled row (incl. one full-file check of ~690k rows) showed only PURCHASE. '
    'purchase_payment_id/reference_payment_id imply REFUND/VOID types exist elsewhere but were never observed.';

COMMENT ON COLUMN payments.created_at IS
    'Sprint 9C.3: MIN(payment_events.event_timestamp) for this payment_id — true business origination time, '
    'derived the same way current_status_at derives MAX. No longer the source CSV row''s own created_at.';

COMMENT ON COLUMN payments.current_status IS
    'Derived via the Current Status Derivation Rule from payment_events — never written directly by ETL.';

COMMENT ON COLUMN payments.current_status_at IS
    'event_timestamp of the payment_events row selected by the Current Status Derivation Rule.';


-- =============================================================================
-- FACT — payment_events (append-only lifecycle log; one row per source CSV
-- row / gateway callback for a payment. Mirrors the FULL original row shape
-- ("every CSV row -> one Payment Event") because payments is a PURE derived
-- aggregate over this table — there is no other path through which CSV data
-- reaches payments (importFile()/batchInsert is single-table-per-row, and
-- importManager.js is never modified). See the Current Status Derivation
-- Rule documented above CREATE TABLE payments.
--
-- Aggregation (payments column <- payment_events derivation), all computed
-- fresh from full event history, never incrementally patched per-file:
--   current_status, current_status_at  <- Current Status Derivation Rule
--                                          (ORDER BY event_timestamp DESC, entry_id DESC; first row wins)
--   created_at                         <- MIN(event_timestamp)
--   card_brand                        <- first non-empty/non-UNKNOWN value seen, ORDER BY event_timestamp ASC, entry_id ASC
--   every other payments column        <- copied from the "current" event (the
--                                          same row selected by the Current
--                                          Status Derivation Rule) — confirmed
--                                          stable across a payment's lifecycle
--                                          (Sprint 9C.2A), so the latest
--                                          observation is authoritative.
-- =============================================================================

CREATE TABLE payment_events (
    entry_id                 VARCHAR(64) PRIMARY KEY,   -- natural key, already unique per row (confirmed Sprint 9C.1/9C.2A) — no invented surrogate key
    payment_id               VARCHAR(64) NOT NULL,   -- deliberately NO FK to payments(payment_id): payments is derived FROM payment_events (Stage B runs after Stage A), so an event for a brand-new payment_id must be insertable before any payments row exists for it — an FK in this direction would make first-time ingestion impossible
    payment_status           VARCHAR(32) NOT NULL,
    event_timestamp          TIMESTAMPTZ NOT NULL,   -- renamed from source `last_updated_at` — the authoritative moment this lifecycle state took effect
    created_at               TIMESTAMPTZ NOT NULL,   -- the source CSV row's own `created_at` — when this specific event record was created upstream (NOT payments.created_at)
    order_id                 VARCHAR(64),
    amount                   BIGINT,
    merchant_id              VARCHAR(64),
    checkout_id              VARCHAR(64),
    currency                 VARCHAR(3),
    payment_type             VARCHAR(32),
    payment_method           VARCHAR(32),
    payee_phone_number       VARCHAR(32),
    transaction_id           VARCHAR(64),
    voided                   BOOLEAN,
    void_requested_at        TIMESTAMPTZ,
    void_status              VARCHAR(32),
    store_id                 VARCHAR(64),
    card_brand               VARCHAR(32),
    purchase_payment_id      VARCHAR(64),
    reference_payment_id     VARCHAR(64),
    originated_by            VARCHAR(64),
    external_request_id      VARCHAR(64),
    external_request_json    JSONB,
    external_response_json   JSONB,
    request_id               VARCHAR(64),   -- TODO: confirmed NOT to crosswalk to api_logs.request_id/gateway_request_id (Sprint 9C.2A: 0/500 matches) — do not assume a join
    created_by               VARCHAR(64),
    status_message             TEXT,   -- renamed from source `user_message_id` — confirmed human-readable status/decline message, never an identifier. Sprint 9C.4A dry run: widened from VARCHAR(64) to TEXT after real production data hit the 64-char cap (e.g. "Transaction declined - Suspected fraudulent activity detected by issuer." = 72 chars) — free-text messages have no reliable max length, same treatment as terminal_message.
    terminal_message          TEXT,
    terminal_codes_raw        JSONB,   -- renamed from source `terminal_code`; raw per-event array, e.g. ["TC000088","TC000090"]. Normalized form would live in payment_terminal_code (currently unpopulated by any importer).
    import_job_id             BIGINT REFERENCES import_jobs(import_job_id)
);

COMMENT ON TABLE payment_events IS
    'Append-only payment lifecycle log — one row per source CSV row / gateway callback, '
    'mirroring the full original row shape. payments is a PURE derived aggregate over this table. '
    'See the Current Status Derivation Rule documented above CREATE TABLE payments.';

COMMENT ON COLUMN payment_events.request_id IS
    'TODO: confirmed NOT to crosswalk to api_logs.request_id/gateway_request_id (Sprint 9C.2A: 0/500 matches against 36,737 real api_logs rows). Do not design anything assuming this join exists.';


-- =============================================================================
-- RELATIONSHIP — payment_terminal_code (normalizes payments.terminal_code_raw)
-- =============================================================================

CREATE TABLE payment_terminal_code (
    payment_id      VARCHAR(64) NOT NULL REFERENCES payments(payment_id),
    terminal_code   VARCHAR(64) NOT NULL REFERENCES terminal_code(terminal_code),
    position        SMALLINT NOT NULL DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (payment_id, terminal_code)
);


-- =============================================================================
-- FACT — api_logs
-- =============================================================================

CREATE TABLE api_logs (
    request_id              VARCHAR(64) PRIMARY KEY,
    request_data             JSONB,
    request_data_mapped      JSONB,
    response_data            JSONB,
    response_data_mapped     JSONB,
    merchant_id              VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),
    partner_id               VARCHAR(64),
    api_key                  VARCHAR(128),
    api_url                  TEXT,
    request_ts               TIMESTAMPTZ NOT NULL,
    response_ts              TIMESTAMPTZ,
    call_type                VARCHAR(16),
    gateway_header           TEXT,
    gateway_request_id       VARCHAR(64),   -- TODO: often equals request_id in samples — possibly redundant, unverified
    status                   VARCHAR(16),
    ip                       VARCHAR(128),  -- may hold a comma-separated proxy chain (client IP, load balancer IP)
    origin                   TEXT,
    query                    JSONB,
    request_time_taken       NUMERIC(12,5),
    status_code              SMALLINT,
    terminal_id              VARCHAR(64) REFERENCES terminal(terminal_id),
    order_id                 VARCHAR(64) REFERENCES orders(order_id),
    payment_id               VARCHAR(64) REFERENCES payments(payment_id),
    version                  VARCHAR(16),
    import_job_id            BIGINT REFERENCES import_jobs(import_job_id)
);

COMMENT ON COLUMN api_logs.gateway_request_id IS
    'TODO: no FK — often equal to request_id in samples but not confirmed to always match. Possibly redundant.';


-- =============================================================================
-- FACT — terminal_events
-- =============================================================================

CREATE TABLE terminal_events (
    event_id            VARCHAR(64) PRIMARY KEY,
    terminal_id         VARCHAR(64) NOT NULL REFERENCES terminal(terminal_id),
    event               VARCHAR(32) NOT NULL,
    event_body          JSONB,   -- shape varies entirely by `event` type (heartbeat, battery, tx-status, etc.) — JSONB is intentional, not a modeling gap
    legacy_timestamp    TIMESTAMPTZ,  -- renamed from source column `timestamp` (reserved-word collision); empty in every sample seen — verify before dropping
    merchant_id         VARCHAR(64) NOT NULL REFERENCES merchant(merchant_id),
    transaction_id      VARCHAR(64),  -- TODO: no FK — see comment below
    order_id            VARCHAR(64) REFERENCES orders(order_id),
    reference_id        VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL,
    event_timestamp     TIMESTAMPTZ,
    created_by          VARCHAR(64),
    import_job_id       BIGINT REFERENCES import_jobs(import_job_id)
);

COMMENT ON COLUMN terminal_events.transaction_id IS
    'TODO: no FK to payments.payment_id — inferred only from matching ID-suffix patterns in samples, never joined/confirmed against real data.';

COMMENT ON COLUMN terminal_events.merchant_id IS
    'Samples showed two distinct merchant_id values across terminal_events rows (retail merchant on order-linked '
    'events vs. a different value on heartbeat/battery events) — FK is enforced since both are still valid merchant '
    'rows, but the dual-namespace semantics need clarification before relying on this column for merchant-level reporting.';


-- =============================================================================
-- INDEXES — requested columns
-- =============================================================================

-- merchant_id
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_api_logs_merchant_id ON api_logs(merchant_id);
CREATE INDEX idx_terminal_events_merchant_id ON terminal_events(merchant_id);
CREATE INDEX idx_terminal_merchant_id ON terminal(merchant_id);
CREATE INDEX idx_store_merchant_id ON store(merchant_id);

-- terminal_id
CREATE INDEX idx_orders_terminal_id ON orders(terminal_id);
CREATE INDEX idx_api_logs_terminal_id ON api_logs(terminal_id);
CREATE INDEX idx_terminal_events_terminal_id ON terminal_events(terminal_id);
CREATE INDEX idx_terminal_code_terminal_id ON terminal_code(terminal_id);

-- store_id
CREATE INDEX idx_payments_store_id ON payments(store_id);
CREATE INDEX idx_terminal_store_id ON terminal(store_id);

-- order_id
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_api_logs_order_id ON api_logs(order_id);
CREATE INDEX idx_terminal_events_order_id ON terminal_events(order_id);

-- payment_id
CREATE INDEX idx_api_logs_payment_id ON api_logs(payment_id);

-- created_at
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_terminal_events_created_at ON terminal_events(created_at);

-- request_ts
CREATE INDEX idx_api_logs_request_ts ON api_logs(request_ts);

-- event_timestamp
CREATE INDEX idx_terminal_events_event_timestamp ON terminal_events(event_timestamp);

-- current_status / order_status / payment_status (payment_events)
CREATE INDEX idx_payments_current_status ON payments(current_status);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_payment_events_payment_status ON payment_events(payment_status);

-- payment_events — payment_id / event_timestamp / import_job_id
CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX idx_payment_events_payment_id_event_ts_entry_id
    ON payment_events(payment_id, event_timestamp DESC, entry_id DESC);   -- exact Current Status Derivation Rule order
CREATE INDEX idx_payment_events_event_timestamp ON payment_events(event_timestamp);
CREATE INDEX idx_payment_events_import_job_id ON payment_events(import_job_id);


-- =============================================================================
-- INDEXES — GIN, for JSONB columns
-- =============================================================================

CREATE INDEX idx_orders_meta_data_gin ON orders USING GIN (meta_data);
CREATE INDEX idx_orders_control_functions_gin ON orders USING GIN (control_functions);

CREATE INDEX idx_payment_events_external_request_json_gin ON payment_events USING GIN (external_request_json);
CREATE INDEX idx_payment_events_external_response_json_gin ON payment_events USING GIN (external_response_json);
CREATE INDEX idx_payment_events_terminal_codes_raw_gin ON payment_events USING GIN (terminal_codes_raw);

CREATE INDEX idx_api_logs_request_data_gin ON api_logs USING GIN (request_data);
CREATE INDEX idx_api_logs_request_data_mapped_gin ON api_logs USING GIN (request_data_mapped);
CREATE INDEX idx_api_logs_response_data_gin ON api_logs USING GIN (response_data);
CREATE INDEX idx_api_logs_response_data_mapped_gin ON api_logs USING GIN (response_data_mapped);
CREATE INDEX idx_api_logs_query_gin ON api_logs USING GIN (query);

CREATE INDEX idx_terminal_events_event_body_gin ON terminal_events USING GIN (event_body);


-- =============================================================================
-- INDEXES — composite, for cross-entity timeline reconstruction
-- (carried over from the Sprint 1 enterprise review; not in the requested
-- column list above but directly supports "reconstruct everything that
-- happened to this order/payment in time order", the stated goal of this
-- platform)
-- =============================================================================

CREATE INDEX idx_payments_order_id_created_at ON payments(order_id, created_at);
CREATE INDEX idx_api_logs_order_id_request_ts ON api_logs(order_id, request_ts);
CREATE INDEX idx_api_logs_payment_id_request_ts ON api_logs(payment_id, request_ts);
CREATE INDEX idx_terminal_events_order_id_event_timestamp ON terminal_events(order_id, event_timestamp);
CREATE INDEX idx_terminal_events_terminal_id_event_timestamp ON terminal_events(terminal_id, event_timestamp);
