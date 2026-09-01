"use client";

/* eslint-disable @next/next/no-img-element */

import { createContext, useContext } from "react";

export interface PlatformBranding {
  organizationName: string;
  productName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
}

const FALLBACK_BRANDING: PlatformBranding = {
  organizationName: "Your Organization",
  productName: "Learning Portal",
  logoUrl: null,
  faviconUrl: null,
};

const BrandingContext = createContext<PlatformBranding>(FALLBACK_BRANDING);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: PlatformBranding;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function usePlatformBranding(): PlatformBranding {
  return useContext(BrandingContext);
}

export function BrandMark({
  className,
  logoClassName = "size-8",
}: {
  className?: string;
  logoClassName?: string;
}) {
  const { organizationName, logoUrl } = usePlatformBranding();

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`.trim()}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={`${logoClassName} shrink-0 object-contain`}
        />
      ) : null}
      <span>{organizationName}</span>
    </span>
  );
}
