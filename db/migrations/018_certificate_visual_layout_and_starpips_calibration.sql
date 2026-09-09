BEGIN;

-- Starpips existing certificates were created before the visual placement editor.
-- These normalized top-left positions are calibrated against the actual
-- Starpips certificate artwork: name in the large blank name area, completion
-- date above the dedicated DATE OF COMPLETION line, and the ID unobtrusively
-- at the lower-left. Existing explicit v2 layouts are never overwritten.
UPDATE certificate_templates
SET layout_config_json = jsonb_set(
      COALESCE(layout_config_json, '{}'::jsonb),
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
WHERE certificate_prefix = 'SPF'
  AND NOT (COALESCE(layout_config_json, '{}'::jsonb) ? 'visualLayout');

COMMIT;
