import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ShipmentDetail } from "@/components/ShipmentDetail";
import { PageHeader } from "@/components/layout/PageHeader";

type Props = { params: Promise<{ id: string }> };

export default async function ShipmentPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/ndr"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to NDR queue
      </Link>
      <PageHeader
        badge="NDR · Shipment"
        title="Shipment detail"
        description="Call history and resolution actions for this delivery."
      />
      <ShipmentDetail id={id} />
    </div>
  );
}
