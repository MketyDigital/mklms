"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_HOSTING_NOTICE_REFRESH_MS = 5 * 60 * 1000;

export function AdminHostingNoticeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = window.setInterval(refreshIfVisible, ADMIN_HOSTING_NOTICE_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
