-- ============================================================================
-- Migration 0008 — drop photos.
--
-- We synced ~5,900 image metadata rows to power a captions-only Photos view — the
-- fastest-growing, least-used table. Dropping it (minimum-necessary; owner call,
-- 2026-07-04). Image FILES were never stored (they live on Procore); this is only
-- metadata. Re-addable later as a bounded pull (e.g. most-recent 200) if wanted.
-- ============================================================================

DROP VIEW IF EXISTS sitelines_photos;
DROP TABLE IF EXISTS procore_images_master;
