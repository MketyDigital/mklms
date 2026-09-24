import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { hashPassword } from "../../../../src/auth/password";
import { newSessionToken, sessionCookie, sessionTokenHash } from "../../../../src/auth/session";
import { BILLING_TERMS, termPrice } from "../../../../src/config/terms";

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const planCode = String(form.get("plan") || "starter");
  const termMonths = Number(form.get("term") || 1);

  if (!name || !/^[A-Za-z0-9_-]{3,40}$/.test(username) || password.length < 10) {
    return NextResponse.redirect(new URL("/signup?error=invalid", request.url), 303);
  }
  if (!BILLING_TERMS.some((term) => term.months === termMonths)) {
    return NextResponse.redirect(new URL("/signup?error=term", request.url), 303);
  }

  const db = getMediaDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const planResult = await client.query(
      "SELECT * FROM media_plans WHERE code=$1 AND active=true LIMIT 1",
      [planCode],
    );
    const plan = planResult.rows[0];
    if (!plan) throw new Error("Unknown plan");

    const existing = await client.query(
      "SELECT 1 FROM media_users WHERE lower(username)=lower($1) LIMIT 1",
      [username],
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.redirect(new URL("/signup?error=username", request.url), 303);
    }

    let slug = slugify(name) || "customer";
    const suffix = crypto.randomUUID().slice(0, 6);
    slug = (slug + "-" + suffix).slice(0, 63);

    const tenantResult = await client.query(
      "INSERT INTO media_tenants (slug,name,status,plan_code,storage_quota_bytes) VALUES ($1,$2,'pending',$3,$4) RETURNING id",
      [slug, name, planCode, plan.storage_bytes],
    );
    const tenantId = tenantResult.rows[0].id;

    const passwordHash = await hashPassword(password);
    const userResult = await client.query(
      "INSERT INTO media_users (username,email,password_hash,status) VALUES ($1,$2,$3,'active') RETURNING id",
      [username, username.toLowerCase() + "@local.mkety.media", passwordHash],
    );
    const userId = userResult.rows[0].id;

    await client.query(
      "INSERT INTO media_memberships (tenant_id,user_id,role) VALUES ($1,$2,'owner')",
      [tenantId, userId],
    );

    await client.query(
      "INSERT INTO media_subscriptions (tenant_id,status,payment_provider) VALUES ($1,'pending',NULL)",
      [tenantId],
    );

    await client.query(
      "INSERT INTO media_tenant_commercial_terms (tenant_id,base_plan_code,billing_term_months) VALUES ($1,$2,$3)",
      [tenantId, planCode, termMonths],
    );

    const monthly = Number(plan.monthly_usd);
    const amount = termPrice(monthly, termMonths);
    const reference = "MKM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    await client.query(
      "INSERT INTO media_invoices (tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES ($1,$2,$3,'invoice','pending',now()+interval '24 hours')",
      [tenantId, reference, amount],
    );

    const token = newSessionToken();
    const tokenHash = await sessionTokenHash(token);
    await client.query(
      "INSERT INTO media_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '30 days')",
      [tokenHash, userId],
    );

    await client.query("COMMIT");
    const response = NextResponse.redirect(new URL("/billing", request.url), 303);
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(error);
    return NextResponse.redirect(new URL("/signup?error=failed", request.url), 303);
  } finally {
    client.release();
  }
}
