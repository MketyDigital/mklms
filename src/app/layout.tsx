import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cache } from "react";

import { BrandingProvider } from "@/features/settings/components/branding-provider";
import {
  DEFAULT_PORTAL_FONT_FAMILY,
  googleFontStylesheetUrl,
  normalizePortalFontFamily,
  portalFontStack,
} from "@/features/settings/font-branding";
import { DEFAULT_PLATFORM_SETTINGS } from "@/features/settings/platform-settings";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { getCachedPostgresPool } from "@/lib/postgres";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const getPlatformSettingsSafe = cache(async () => {
  try {
    return await new PostgresSettingsRepository(
      getCachedPostgresPool(),
    ).getPlatformSettings();
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettingsSafe();
  const organizationName = settings.organizationName || DEFAULT_PLATFORM_SETTINGS.organizationName;
  const productName = settings.productName || DEFAULT_PLATFORM_SETTINGS.productName;

  return {
    title: {
      default: organizationName,
      template: `%s | ${organizationName}`,
    },
    description: `${productName} for ${organizationName}`,
    icons: settings.faviconUrl
      ? {
          icon: [{ url: settings.faviconUrl }],
          shortcut: [{ url: settings.faviconUrl }],
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPlatformSettingsSafe();
  const fontFamily = normalizePortalFontFamily(settings.fontFamily) ?? DEFAULT_PORTAL_FONT_FAMILY;
  const fontStylesheetUrl = googleFontStylesheetUrl(fontFamily);
  const brandingStyle = {
    "--portal-font-family": portalFontStack(fontFamily),
    ...(settings.primaryColor
      ? {
          "--primary": settings.primaryColor,
          "--ring": settings.primaryColor,
          "--sidebar-primary": settings.primaryColor,
        }
      : {}),
    ...(settings.secondaryColor
      ? {
          "--secondary": settings.secondaryColor,
          "--accent": settings.secondaryColor,
          "--sidebar-accent": settings.secondaryColor,
        }
      : {}),
  } as React.CSSProperties;

  return (
    <html lang={settings.locale || "en"}>
      <head>
        {fontStylesheetUrl ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontStylesheetUrl} />
          </>
        ) : null}
      </head>
      <body className={`${geistSans.variable} font-sans antialiased`} style={brandingStyle}>
        <BrandingProvider
          branding={{
            organizationName: settings.organizationName || DEFAULT_PLATFORM_SETTINGS.organizationName,
            productName: settings.productName || DEFAULT_PLATFORM_SETTINGS.productName,
            logoUrl: settings.logoUrl ?? null,
            faviconUrl: settings.faviconUrl ?? null,
          }}
        >
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
