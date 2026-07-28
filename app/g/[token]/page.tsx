import { BuyerPortal } from "@/components/BuyerPortal";

export default async function BuyerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BuyerPortal token={token} />;
}
