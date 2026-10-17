import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";

export type D1PlatformSettingsRow = {
  id: string;
  organization_name: string;
  product_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  support_name: string | null;
  support_email: string | null;
  public_base_url: string;
  timezone: string;
  locale: string;
  access_provider: string;
  claim_verification_strategy: string;
  storage_provider: string;
  media_provider: string;
  email_provider: string;
  notification_provider: string;
  access_code_prefix: string;
  certificate_prefix: string;
  completion_community_url: string | null;
};

export class D1PlatformSettingsStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async read(): Promise<D1PlatformSettingsRow | null> {
    const rows = await queryD1Rows<D1PlatformSettingsRow>(this.db, {
      sql: "SELECT * FROM platform_settings WHERE id = ? LIMIT 1",
      params: ["default"],
    });
    return rows[0] ?? null;
  }

  async write(row: D1PlatformSettingsRow): Promise<void> {
    if (row.id !== "default") throw new Error("Platform settings row ID must be default");
    const columns = [
      "id", "organization_name", "product_name", "logo_url", "favicon_url",
      "primary_color", "secondary_color", "font_family", "support_name",
      "support_email", "public_base_url", "timezone", "locale",
      "access_provider", "claim_verification_strategy", "storage_provider",
      "media_provider", "email_provider", "notification_provider",
      "access_code_prefix", "certificate_prefix", "completion_community_url",
    ] as const;
    const placeholders = columns.map(() => "?").join(",");
    const mutableColumns = columns.filter(column => column !== "id");
    const updates = mutableColumns.map(column => `${column}=excluded.${column}`).join(",");
    await executeD1(this.db, {
      sql: `INSERT INTO platform_settings (${columns.join(",")}) VALUES (${placeholders})
        ON CONFLICT(id) DO UPDATE SET ${updates},updated_at=CURRENT_TIMESTAMP`,
      params: columns.map(column => row[column]),
    });
  }
}
