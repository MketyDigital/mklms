import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { CertificateTemplateRecord } from "./postgres-certificate.repository";

export interface CreateCertificateTemplateInput {
  name: string;
  courseId?: string | null;
  backgroundAssetId?: string | null;
  signatureAssetId?: string | null;
  layoutConfig?: Record<string, unknown>;
  certificatePrefix?: string;
  active?: boolean;
}

export class PostgresCertificateTemplateRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listTemplates(): Promise<CertificateTemplateRecord[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      course_id: string | null;
      background_asset_id: string | null;
      signature_asset_id: string | null;
      layout_config_json: Record<string, unknown>;
      active: boolean;
    }>(
      `SELECT id, name, course_id, background_asset_id,
              signature_asset_id, layout_config_json, active
       FROM certificate_templates
       ORDER BY active DESC, updated_at DESC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      courseId: row.course_id,
      backgroundAssetId: row.background_asset_id,
      signatureAssetId: row.signature_asset_id,
      layoutConfig: row.layout_config_json ?? {},
      active: row.active,
    }));
  }

  async createTemplate(
    input: CreateCertificateTemplateInput,
  ): Promise<string> {
    const id = randomUUID();
    const active = input.active ?? true;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (active) {
        if (input.courseId) {
          await client.query(
            `UPDATE certificate_templates
             SET active = FALSE, updated_at = NOW()
             WHERE course_id = $1`,
            [input.courseId],
          );
        } else {
          await client.query(
            `UPDATE certificate_templates
             SET active = FALSE, updated_at = NOW()
             WHERE course_id IS NULL`,
          );
        }
      }

      await client.query(
        `INSERT INTO certificate_templates (
           id, name, course_id, background_asset_id, signature_asset_id,
           layout_config_json, certificate_prefix, active,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          id,
          input.name.trim(),
          input.courseId ?? null,
          input.backgroundAssetId ?? null,
          input.signatureAssetId ?? null,
          JSON.stringify(input.layoutConfig ?? {}),
          input.certificatePrefix?.trim() || "CERT",
          active,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return id;
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const target = await client.query<{ course_id: string | null }>(
        `SELECT course_id FROM certificate_templates WHERE id = $1 LIMIT 1`,
        [id],
      );
      const courseId = target.rows[0]?.course_id;
      if (active) {
        if (courseId) {
          await client.query(
            `UPDATE certificate_templates
             SET active = FALSE, updated_at = NOW()
             WHERE course_id = $1`,
            [courseId],
          );
        } else {
          await client.query(
            `UPDATE certificate_templates
             SET active = FALSE, updated_at = NOW()
             WHERE course_id IS NULL`,
          );
        }
      }

      await client.query(
        `UPDATE certificate_templates
         SET active = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, active],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
