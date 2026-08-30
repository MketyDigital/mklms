"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccessCodeForm() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ accessCode }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "We could not sign you in with that access code.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("The portal could not be reached. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="access-code">Access code</Label>
        <Input
          id="access-code"
          name="accessCode"
          autoComplete="off"
          autoCapitalize="characters"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
          placeholder="Enter your student access code"
          required
        />
        <p className="text-xs text-muted-foreground">
          Use the private access code issued when you first claimed your approved course access.
        </p>
      </div>

      {message ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Checking access..." : "Enter learning portal"}
      </Button>
    </form>
  );
}
