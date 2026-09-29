import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나의 성적 | 기린국어",
  description: "최근 숙제와 시험 성적 확인",
  robots: { index: false, follow: false },
};

const publisher = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {publisher && /^ca-pub-\d{16}$/.test(publisher) && <>
          <meta name="google-adsense-account" content={publisher} />
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`} crossOrigin="anonymous" />
        </>}
      </head>
      <body>{children}</body>
    </html>
  );
}
