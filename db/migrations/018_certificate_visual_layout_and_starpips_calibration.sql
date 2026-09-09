BEGIN;

-- Starpips existing certificates were created before the visual placement editor.
-- Calibrate only SPF-prefixed templates that do not already have an explicit v2 layout.
UPDATE certificate_templates
SET layout_config_json = jsonb_set(
      COALESCE(layout_config_json, '{}'::jsonb),
      '{visualLayout}',
      '{
        "version": 2,
        "name": {"xRatio": 0.19, "yRatio": 0.405, "widthRatio": 0.62, "fontSize": 28, "align": "center"},
        "completionDate": {"xRatio": 0.39, "yRatio": 0.735, "widthRatio": 0.22, "fontSize": 11, "align": "center"},
        "certificateId": {"xRatio": 0.035, "yRatio": 0.93, "widthRatio": 0.22, "fontSize": 9, "align": "left"}
      }'::jsonb,
      TRUE
    ),
    updated_at = NOW()
WHERE certificate_prefix = 'SPF'
  AND NOT (COALESCE(layout_config_json, '{}'::jsonb) ? 'visualLayout');

COMMIT;
