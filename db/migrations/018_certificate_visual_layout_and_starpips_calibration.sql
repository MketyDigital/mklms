BEGIN;

-- Starpips existing certificates were created before the visual placement editor.
-- Issued certificate IDs use platform_settings.certificate_prefix, so use the
-- platform's proven SPF identity rather than assuming the template prefix is
-- also SPF. This keeps the migration inert in Mkety/enterprise databases.
-- Positions are normalized from the top-left and calibrated against the real
-- Starpips artwork: name in the large blank recipient area, completion date
-- above DATE OF COMPLETION, and certificate ID unobtrusively at lower-left.
UPDATE certificate_templates AS template
SET layout_config_json = jsonb_set(
      COALESCE(template.layout_config_json, '{}'::jsonb),
      '{visualLayout}',
      '{
        "version": 2,
        "name": {"xRatio": 0.18, "yRatio": 0.60, "widthRatio": 0.64, "fontSize": 28, "align": "center"},
        "completionDate": {"xRatio": 0.08, "yRatio": 0.81, "widthRatio": 0.25, "fontSize": 11, "align": "center"},
        "certificateId": {"xRatio": 0.075, "yRatio": 0.93, "widthRatio": 0.20, "fontSize": 9, "align": "left"}
      }'::jsonb,
      TRUE
    ),
    updated_at = NOW()
WHERE template.active = TRUE
  AND template.background_asset_id IS NOT NULL
  AND NOT (COALESCE(template.layout_config_json, '{}'::jsonb) ? 'visualLayout')
  AND EXISTS (
    SELECT 1
    FROM platform_settings AS settings
    WHERE settings.id = 'default'
      AND settings.certificate_prefix = 'SPF'
  );

COMMIT;
