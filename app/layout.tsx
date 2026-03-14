import type { Metadata } from "next";
import "./globals.css";
import RootShell from "@/components/site/RootShell";

export const metadata: Metadata = {
  title: {
    default: "하테나 일본어",
    template: "%s | 하테나 일본어",
  },
  description: "강의로 이해하고 훈련으로 실력을 남기는 일본어 LMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}