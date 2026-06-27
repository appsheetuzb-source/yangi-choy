-- Yangi Choy Postgres performance hotfix indexes.
--
-- Run from the server after DATABASE_URL is available:
--   psql "$DATABASE_URL" -f deploy/postgres-performance-indexes.sql
--
-- Notes:
-- - CREATE INDEX CONCURRENTLY must run outside an explicit transaction.
-- - This script uses psql \gexec so missing optional tables/columns are skipped.
-- - These are expression indexes because the current app compares IDs with btrim().
-- - After data is cleaned/deduplicated, the main *_ID indexes can be promoted to UNIQUE.

WITH desired(index_name, table_name, expression_sql, required_columns) AS (
  VALUES
    ('foydalanuvchi_id_btrim_idx', 'foydalanuvchi', 'btrim("Foydalanuvchi_ID")', ARRAY['Foydalanuvchi_ID']),
    ('foydalanuvchi_pochta_lower_btrim_idx', 'foydalanuvchi', 'lower(btrim("Pochta"))', ARRAY['Pochta']),
    ('foydalanuvchi_telefon_btrim_idx', 'foydalanuvchi', 'btrim("Telefon")', ARRAY['Telefon']),

    ('gazna_id_btrim_idx', 'gazna', 'btrim("Gazna_ID")', ARRAY['Gazna_ID']),

    ('kurs_id_btrim_idx', 'kurs', 'btrim("Kurs_ID")', ARRAY['Kurs_ID']),
    ('kurs_sana_btrim_idx', 'kurs', 'btrim("Sana_1")', ARRAY['Sana_1']),

    ('mahsulot_id_btrim_idx', 'mahsulot', 'btrim("Mahsulot_ID")', ARRAY['Mahsulot_ID']),
    ('mahsulot_ombor_id_btrim_idx', 'mahsulot', 'btrim("Ombor_ID")', ARRAY['Ombor_ID']),

    ('ombor_id_btrim_idx', 'ombor', 'btrim("Ombor_ID")', ARRAY['Ombor_ID']),

    ('mijozlar_id_btrim_idx', 'mijozlar', 'btrim("Mijoz_ID")', ARRAY['Mijoz_ID']),
    ('mijozlar_ism_lower_btrim_idx', 'mijozlar', 'lower(btrim("Ism"))', ARRAY['Ism']),
    ('mijozlar_agent_btrim_idx', 'mijozlar', 'btrim("Agent")', ARRAY['Agent']),

    ('mijozbalans_mijoz_id_btrim_idx', 'mijozbalans', 'btrim("Mijoz_ID")', ARRAY['Mijoz_ID']),

    ('sotuv_id_btrim_idx', 'sotuv', 'btrim("Sotuv_ID")', ARRAY['Sotuv_ID']),
    ('sotuv_mijoz_id_btrim_idx', 'sotuv', 'btrim("Mijoz_ID")', ARRAY['Mijoz_ID']),
    ('sotuv_agent_btrim_idx', 'sotuv', 'btrim("Agent")', ARRAY['Agent']),
    ('sotuv_sana_btrim_idx', 'sotuv', 'btrim("Sana")', ARRAY['Sana']),
    ('sotuv_yil_btrim_idx', 'sotuv', 'btrim("Yil")', ARRAY['Yil']),
    ('sotuv_oy_btrim_idx', 'sotuv', 'btrim("Oy")', ARRAY['Oy']),
    ('sotuv_status_btrim_idx', 'sotuv', 'btrim("Status")', ARRAY['Status']),

    ('sotuv_savat_id_btrim_idx', 'sotuv_savat', 'btrim("Savat_ID")', ARRAY['Savat_ID']),
    ('sotuv_savat_sotuv_id_btrim_idx', 'sotuv_savat', 'btrim("Sotuv_ID")', ARRAY['Sotuv_ID']),
    ('sotuv_savat_mahsulot_id_btrim_idx', 'sotuv_savat', 'btrim("Mahsulot_ID")', ARRAY['Mahsulot_ID']),
    ('sotuv_savat_ombor_id_btrim_idx', 'sotuv_savat', 'btrim("Ombor_ID")', ARRAY['Ombor_ID']),

    ('sotuv_savat_dollar_id_btrim_idx', 'sotuv_savat_dollar', 'btrim("Savat_ID")', ARRAY['Savat_ID']),
    ('sotuv_savat_dollar_sotuv_id_btrim_idx', 'sotuv_savat_dollar', 'btrim("Sotuv_ID")', ARRAY['Sotuv_ID']),
    ('sotuv_savat_dollar_mahsulot_id_btrim_idx', 'sotuv_savat_dollar', 'btrim("Mahsulot_ID")', ARRAY['Mahsulot_ID']),
    ('sotuv_savat_dollar_ombor_id_btrim_idx', 'sotuv_savat_dollar', 'btrim("Ombor_ID")', ARRAY['Ombor_ID']),

    ('s_tolov_id_btrim_idx', 's_tolov', 'btrim("Tolov_ID")', ARRAY['Tolov_ID']),
    ('s_tolov_sotuv_id_btrim_idx', 's_tolov', 'btrim("Sotuv_ID")', ARRAY['Sotuv_ID']),
    ('s_tolov_mijoz_id_btrim_idx', 's_tolov', 'btrim("Mijoz_ID")', ARRAY['Mijoz_ID']),
    ('s_tolov_agent_btrim_idx', 's_tolov', 'btrim("Agent")', ARRAY['Agent']),
    ('s_tolov_gazna_id_btrim_idx', 's_tolov', 'btrim("Gazna_ID")', ARRAY['Gazna_ID']),
    ('s_tolov_gazna_dollar_id_btrim_idx', 's_tolov', 'btrim("Gazna_dollar_ID")', ARRAY['Gazna_dollar_ID']),

    ('taminotchi_id_btrim_idx', 'taminotchi', 'btrim("Taminotchi_ID")', ARRAY['Taminotchi_ID']),
    ('taminotchi_ism_lower_btrim_idx', 'taminotchi', 'lower(btrim("Ism"))', ARRAY['Ism']),

    ('xarid_id_btrim_idx', 'xarid', 'btrim("Xarid_ID")', ARRAY['Xarid_ID']),
    ('xarid_taminotchi_id_btrim_idx', 'xarid', 'btrim("Taminotchi_ID")', ARRAY['Taminotchi_ID']),
    ('xarid_sana_btrim_idx', 'xarid', 'btrim("Sana")', ARRAY['Sana']),
    ('xarid_yil_btrim_idx', 'xarid', 'btrim("Yil")', ARRAY['Yil']),
    ('xarid_oy_btrim_idx', 'xarid', 'btrim("Oy")', ARRAY['Oy']),

    ('xarid_savat_id_btrim_idx', 'xarid_savat', 'btrim("X_Savat")', ARRAY['X_Savat']),
    ('xarid_savat_xarid_id_btrim_idx', 'xarid_savat', 'btrim("Xarid_ID")', ARRAY['Xarid_ID']),
    ('xarid_savat_mahsulot_id_btrim_idx', 'xarid_savat', 'btrim("Mahsulot_ID")', ARRAY['Mahsulot_ID']),

    ('x_tolov_id_btrim_idx', 'x_tolov', 'btrim("X_Tolov_ID")', ARRAY['X_Tolov_ID']),
    ('x_tolov_xarid_id_btrim_idx', 'x_tolov', 'btrim("Xarid_ID")', ARRAY['Xarid_ID']),
    ('x_tolov_taminotchi_id_btrim_idx', 'x_tolov', 'btrim("Taminotchi_ID")', ARRAY['Taminotchi_ID']),
    ('x_tolov_gazna_id_btrim_idx', 'x_tolov', 'btrim("Gazna_ID")', ARRAY['Gazna_ID']),
    ('x_tolov_gazna_dollar_id_btrim_idx', 'x_tolov', 'btrim("Gazna_dollar_ID")', ARRAY['Gazna_dollar_ID']),

    ('xarajat_id_btrim_idx', 'xarajat', 'btrim("Xarajat_ID")', ARRAY['Xarajat_ID']),
    ('xarajat_gazna_id_btrim_idx', 'xarajat', 'btrim("Gazna_ID")', ARRAY['Gazna_ID']),
    ('xarajat_gazna_dollar_id_btrim_idx', 'xarajat', 'btrim("Gazna_dollar_ID")', ARRAY['Gazna_dollar_ID']),
    ('xarajat_sana_btrim_idx', 'xarajat', 'btrim("Sana")', ARRAY['Sana']),

    ('ogohlantirish_id_btrim_idx', 'ogohlantirish', 'btrim("Ogoh_ID")', ARRAY['Ogoh_ID']),
    ('ogohlantirish_mijoz_id_btrim_idx', 'ogohlantirish', 'btrim("Mijoz_ID")', ARRAY['Mijoz_ID']),
    ('ogohlantirish_status_btrim_idx', 'ogohlantirish', 'btrim("Status")', ARRAY['Status'])
)
SELECT format(
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON %I (%s);',
  d.index_name,
  d.table_name,
  d.expression_sql
)
FROM desired d
WHERE to_regclass(format('public.%I', d.table_name)) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(d.required_columns) AS c(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = d.table_name
        AND column_name = c.column_name
    )
  )
ORDER BY d.table_name, d.index_name
\gexec
