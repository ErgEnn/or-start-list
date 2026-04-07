import { redirect } from "next/navigation";

export default async function PaymentGroupIndexPage({
  params,
}: {
  params: Promise<{ paymentGroupId: string }>;
}) {
  const { paymentGroupId } = await params;
  redirect(`/dashboard/payment-groups/${encodeURIComponent(paymentGroupId)}/settings`);
}
