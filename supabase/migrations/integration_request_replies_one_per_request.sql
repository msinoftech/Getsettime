-- One superadmin reply per integration request (matches product rule).
--
-- Supabase may show "Query has destructive operations" for the DELETE below.
-- That is expected: the DELETE only removes DUPLICATE rows (same integration_request_id),
-- keeping the earliest reply per request (created_at ASC, then id ASC). Confirm with
-- "Run this query" when you intend to dedupe, then add the unique index.
--
-- Optional: preview rows that would be removed (run alone, then cancel migration run):
-- SELECT r.id, r.integration_request_id, r.subject, r.created_at
-- FROM public.integration_request_replies r
-- WHERE r.id IN (
--   SELECT id FROM (
--     SELECT id,
--       row_number() OVER (
--         PARTITION BY integration_request_id
--         ORDER BY created_at ASC, id ASC
--       ) AS rn
--     FROM public.integration_request_replies
--   ) dup
--   WHERE dup.rn > 1
-- );

DELETE FROM public.integration_request_replies r
WHERE r.id IN (
  SELECT id
  FROM (
    SELECT id,
      row_number() OVER (
        PARTITION BY integration_request_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.integration_request_replies
  ) dup
  WHERE dup.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_request_replies_one_per_request
  ON public.integration_request_replies (integration_request_id);
