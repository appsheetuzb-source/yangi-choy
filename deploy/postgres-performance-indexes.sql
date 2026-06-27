-- Yangi Choy Postgres performance hotfix indexes.
--
-- Run from the server after DATABASE_URL is available:
--   psql "$DATABASE_URL" -f deploy/postgres-performance-indexes.sql
--
-- Important:
-- - CREATE INDEX CONCURRENTLY must run outside an explicit transaction.
-- - These are expression indexes because the current app compares IDs with btrim().
-- - After data is cleaned/deduplicated, the main *_ID indexes can be promoted to UNIQUE.
-- - If an optional migrated table/column is missing, remove that specific line and rerun.

CREATE INDEX CONCURRENTLY IF NOT EXISTS foydalanuvchi_id_btrim_idx
  ON foydalanuvchi (btrim("Foydalanuvchi_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS foydalanuvchi_login_lower_btrim_idx
  ON foydalanuvchi (lower(btrim("Login")));
CREATE INDEX CONCURRENTLY IF NOT EXISTS foydalanuvchi_pochta_lower_btrim_idx
  ON foydalanuvchi (lower(btrim("Pochta")));
CREATE INDEX CONCURRENTLY IF NOT EXISTS foydalanuvchi_telefon_btrim_idx
  ON foydalanuvchi (btrim("Telefon"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS gazna_id_btrim_idx
  ON gazna (btrim("Gazna_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS kurs_id_btrim_idx
  ON kurs (btrim("Kurs_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS kurs_sana_btrim_idx
  ON kurs (btrim("Sana_1"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS mahsulot_id_btrim_idx
  ON mahsulot (btrim("Mahsulot_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS mahsulot_ombor_id_btrim_idx
  ON mahsulot (btrim("Ombor_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS ombor_id_btrim_idx
  ON ombor (btrim("Ombor_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS mijozlar_id_btrim_idx
  ON mijozlar (btrim("Mijoz_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS mijozlar_nomi_lower_btrim_idx
  ON mijozlar (lower(btrim("Nomi")));

CREATE INDEX CONCURRENTLY IF NOT EXISTS mijozbalans_mijoz_id_btrim_idx
  ON mijozbalans (btrim("Mijoz_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_id_btrim_idx
  ON sotuv (btrim("Sotuv_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_mijoz_id_btrim_idx
  ON sotuv (btrim("Mijoz_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_gazna_id_btrim_idx
  ON sotuv (btrim("Gazna_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_foydalanuvchi_id_btrim_idx
  ON sotuv (btrim("Foydalanuvchi_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_sana_btrim_idx
  ON sotuv (btrim("Sana"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_status_btrim_idx
  ON sotuv (btrim("Status"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_id_btrim_idx
  ON sotuv_savat (btrim("Savat_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_sotuv_id_btrim_idx
  ON sotuv_savat (btrim("Sotuv_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_mahsulot_id_btrim_idx
  ON sotuv_savat (btrim("Mahsulot_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_ombor_id_btrim_idx
  ON sotuv_savat (btrim("Ombor_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_dollar_id_btrim_idx
  ON sotuv_savat_dollar (btrim("Savat_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_dollar_sotuv_id_btrim_idx
  ON sotuv_savat_dollar (btrim("Sotuv_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_dollar_mahsulot_id_btrim_idx
  ON sotuv_savat_dollar (btrim("Mahsulot_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS sotuv_savat_dollar_ombor_id_btrim_idx
  ON sotuv_savat_dollar (btrim("Ombor_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS s_tolov_id_btrim_idx
  ON s_tolov (btrim("Tolov_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS s_tolov_sotuv_id_btrim_idx
  ON s_tolov (btrim("Sotuv_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS s_tolov_mijoz_id_btrim_idx
  ON s_tolov (btrim("Mijoz_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS s_tolov_gazna_id_btrim_idx
  ON s_tolov (btrim("Gazna_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS taminotchi_id_btrim_idx
  ON taminotchi (btrim("Taminotchi_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS taminotchi_nomi_lower_btrim_idx
  ON taminotchi (lower(btrim("Nomi")));

CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_id_btrim_idx
  ON xarid (btrim("Xarid_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_taminotchi_id_btrim_idx
  ON xarid (btrim("Taminotchi_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_sana_btrim_idx
  ON xarid (btrim("Sana"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_savat_id_btrim_idx
  ON xarid_savat (btrim("X_Savat"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_savat_xarid_id_btrim_idx
  ON xarid_savat (btrim("Xarid_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarid_savat_mahsulot_id_btrim_idx
  ON xarid_savat (btrim("Mahsulot_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS x_tolov_id_btrim_idx
  ON x_tolov (btrim("X_Tolov_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS x_tolov_xarid_id_btrim_idx
  ON x_tolov (btrim("Xarid_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS x_tolov_taminotchi_id_btrim_idx
  ON x_tolov (btrim("Taminotchi_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS x_tolov_gazna_id_btrim_idx
  ON x_tolov (btrim("Gazna_ID"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS xarajat_id_btrim_idx
  ON xarajat (btrim("Xarajat_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarajat_gazna_id_btrim_idx
  ON xarajat (btrim("Gazna_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS xarajat_sana_btrim_idx
  ON xarajat (btrim("Sana"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS ogohlantirish_id_btrim_idx
  ON ogohlantirish (btrim("Ogoh_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS ogohlantirish_mijoz_id_btrim_idx
  ON ogohlantirish (btrim("Mijoz_ID"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS ogohlantirish_status_btrim_idx
  ON ogohlantirish (btrim("Status"));
