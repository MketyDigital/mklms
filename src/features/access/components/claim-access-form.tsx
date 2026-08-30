"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClaimAccessFormProps {
  verificationStrategy: string;
}

export function ClaimAccessForm({ verificationStrategy }: ClaimAccessFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [certificateName, setCertificateName] = useState("");
  const [certificateEmail, setCertificateEmail] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issuedAccessCode, setIssuedAccessCode] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setIssuedAccessCode(null);

    try {
      const response = await fetch("/api/access/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          certificateName,
          certificateEmail: certificateEmail || undefined,
          claimCode: claimCode || undefined,
        }),
      });
      const result = await response.json().catch(() => null) as {
        ok?: boolean;
        accessCode?: string;
        message?: string;
      } | null;

      if (result?.ok && result.accessCode) {
        setIssuedAccessCode(result.accessCode);
        setMessage(result.message ?? "Access claimed successfully.");
        return;
      }

      setMessage(result?.message ?? "We couldn't verify access with those details.");
    } catch {
      setMessage("The portal could not be reached. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (issuedAccessCode) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm text-muted-foreground">Your student access code</p>
          <p className="mt-2 break-all font-mono text-xl font-semibold tracking-wide">
            {issuedAccessCode}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Save this code securely. It is your private credential for returning to the paid learning portal.
          </p>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button asChild className="w-full">
          <Link href="/login">Continue to portal login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="claim-email">Approved email</Label>
          <Input id="claim-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claim-phone">Approved phone</Label>
          <Input id="claim-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Your approved phone" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Enter at least one detail that matches the paid-student list supplied to the portal administrator.</p>

      <div className="space-y-2">
        <Label htmlFor="certificate-name">Name to appear on certificate</Label>
        <Input id="certificate-name" value={certificateName} onChange={(event) => setCertificateName(event.target.value)} placeholder="Your full certificate name" required />
        <p className="text-xs text-muted-foreground">This becomes your certificate identity. An administrator can correct it later if necessary.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="certificate-email">Certificate delivery email</Label>
        <Input id="certificate-email" type="email" value={certificateEmail} onChange={(event) => setCertificateEmail(event.target.value)} placeholder="Optional if same as approved email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claim-code">One-time verification / claim code</Label>
        <Input id="claim-code" value={claimCode} onChange={(event) => setClaimCode(event.target.value.toUpperCase())} placeholder="Leave blank unless the administrator gave you one" autoComplete="one-time-code" />
        <p className="text-xs text-muted-foreground">Some deployments use a free administrator-issued claim code instead of email or SMS OTP.</p>
      </div>

      {verificationStrategy !== "preauth-only" ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">This portal may require an additional verification step after your approved details are matched.</p>
      ) : null}

      {message ? <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">{message}</p> : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Verifying paid access..." : "Claim my course access"}
      </Button>
    </form>
  );
}
