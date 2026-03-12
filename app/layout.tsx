import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Hotena LMS",
  description: "관리자 중심 일본어 LMS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}