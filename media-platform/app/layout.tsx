import "./globals.css";

export const metadata = {
  title: "Mkety Media",
  description: "Simple managed media storage and delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
