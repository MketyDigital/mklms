import "./globals.css";

export const metadata = {
  title: {
    default: "Mkety Media",
    template: "%s | Mkety Media",
  },
  description: "Simple media storage and delivery for websites, apps and business content.",
  icons: {
    icon: "https://mkety.com/mkety-logo.png",
    shortcut: "https://mkety.com/mkety-logo.png",
    apple: "https://mkety.com/mkety-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
