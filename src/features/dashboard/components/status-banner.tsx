import Link from "next/link";
import type { MemberStatus } from "@/types";

const config: Record<
  "pending" | "expired",
  { message: string; className: string }
> = {
  pending: {
    message:
      "Your membership is pending. Send your bKash/Nagad payment and message Foyzul to verify.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  expired: {
    message:
      "Your membership has expired. Renew your payment to regain full access.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

export function StatusBanner({ status }: { status: MemberStatus }) {
  if (status === "active") return null;

  const { message, className } = config[status];

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>
      <p>
        {message}{" "}
        <Link href="/messages" className="font-medium underline">
          Send a message
        </Link>
      </p>
    </div>
  );
}
