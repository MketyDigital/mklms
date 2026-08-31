"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PublicCertificateLookup() {
  const router = useRouter();
  const [certificateId, setCertificateId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = certificateId.trim();
    if (!value) return;
    router.push(`/verify/${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={certificateId}
        onChange={(event) => setCertificateId(event.target.value)}
        placeholder="Enter certificate ID"
        aria-label="Certificate ID"
      />
      <Button type="submit">
        <Search className="mr-1.5 size-4" /> Verify certificate
      </Button>
    </form>
  );
}
