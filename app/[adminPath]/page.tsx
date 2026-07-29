import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminRoute } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage({ params }: { params: Promise<{ adminPath: string }> }) {
  const { adminPath } = await params;
  if (!isAdminRoute(adminPath)) notFound();
  return <AdminDashboard routeKey={adminPath} />;
}
