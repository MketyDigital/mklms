"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatformSettings } from "../platform-settings";

export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [form, setForm] = useState(settings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSubmitting(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/settings/platform", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) { setMessage(result?.message ?? "Settings could not be saved."); return; }
      setMessage("Platform settings saved.");
    } catch { setMessage("The settings service could not be reached."); }
    finally { setIsSubmitting(false); }
  }

  return <form onSubmit={handleSubmit} className="mt-8 space-y-6">
    {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}

    <Card><CardHeader><CardTitle className="text-base">Brand & portal identity</CardTitle><CardDescription>Public identity and URLs used by the live-class share links, certificates and portal.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <Field label="Organization name"><Input value={form.organizationName} onChange={(e) => update("organizationName", e.target.value)} /></Field>
      <Field label="Product/portal name"><Input value={form.productName} onChange={(e) => update("productName", e.target.value)} /></Field>
      <Field label="Logo URL"><Input type="url" value={form.logoUrl ?? ""} onChange={(e) => update("logoUrl", e.target.value || null)} placeholder="https://..." /></Field>
      <Field label="Favicon URL"><Input type="url" value={form.faviconUrl ?? ""} onChange={(e) => update("faviconUrl", e.target.value || null)} placeholder="https://..." /></Field>
      <Field label="Primary color"><Input value={form.primaryColor ?? ""} onChange={(e) => update("primaryColor", e.target.value || null)} /></Field>
      <Field label="Secondary color"><Input value={form.secondaryColor ?? ""} onChange={(e) => update("secondaryColor", e.target.value || null)} /></Field>
      <Field label="Support/admin display name"><Input value={form.supportName ?? ""} onChange={(e) => update("supportName", e.target.value || null)} /></Field>
      <Field label="Support email"><Input type="email" value={form.supportEmail ?? ""} onChange={(e) => update("supportEmail", e.target.value || null)} /></Field>
      <Field label="Public portal URL"><Input type="url" value={form.publicBaseUrl} onChange={(e) => update("publicBaseUrl", e.target.value.replace(/\/$/, ""))} required /></Field>
      <Field label="Timezone"><Input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} placeholder="Africa/Lagos" /></Field>
      <Field label="Locale"><Input value={form.locale} onChange={(e) => update("locale", e.target.value)} placeholder="en" /></Field>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Student access & certificates</CardTitle><CardDescription>Only production paths that are fully implemented in this installation are selectable.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <SelectField label="Access provider" value="access-code" onChange={() => update("accessProvider", "access-code")} options={["access-code"]} />
      <SelectField label="Default claim verification" value={form.claimVerificationStrategy} onChange={(value) => update("claimVerificationStrategy", value as PlatformSettings["claimVerificationStrategy"])} options={["preauth-only", "claim-code", "manual-approval"]} />
      <Field label="Access code prefix"><Input value={form.accessCodePrefix} onChange={(e) => update("accessCodePrefix", e.target.value.toUpperCase())} /></Field>
      <Field label="Certificate ID prefix"><Input value={form.certificatePrefix} onChange={(e) => update("certificatePrefix", e.target.value.toUpperCase())} /></Field>
      <Field label="Graduate community URL"><Input type="url" value={form.completionCommunityUrl ?? ""} onChange={(e) => update("completionCommunityUrl", e.target.value || null)} placeholder="https://t.me/... or https://chat.whatsapp.com/..." /></Field>
      <div className="self-end text-xs text-muted-foreground">Shown only to students who have at least one valid issued certificate.</div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Communication integrations</CardTitle><CardDescription>SMTP and Telegram are the installed communication adapters. Their secret credentials remain in Worker environment variables, not this form.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <SelectField label="Email" value={form.emailProvider === "smtp" ? "smtp" : "none"} onChange={(value) => update("emailProvider", value as PlatformSettings["emailProvider"])} options={["none", "smtp"]} />
      <SelectField label="Notifications" value={form.notificationProvider === "telegram" ? "telegram" : "none"} onChange={(value) => update("notificationProvider", value as PlatformSettings["notificationProvider"])} options={["none", "telegram"]} />
    </CardContent></Card>

    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving settings..." : "Save platform settings"}</Button>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[]; }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
