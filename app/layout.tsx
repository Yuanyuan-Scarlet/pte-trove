import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "bzzl.ysspark.cn";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "小圆 PTE 突击宝藏资料";
  const description = "验证订单，生成带专属水印的 PTE 宝藏资料并安全下载。";
  const image = new URL("/og.png", metadataBase).toString();
  return {
    metadataBase,
    title,
    description,
    icons: { icon: "/brand/xiaoyuan-pte.png" },
    openGraph: { title, description, images: [{ url: image, width: 1536, height: 1024 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
