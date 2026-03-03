import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Cliparr",
  description: "Automated coupon clipping across stores",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
