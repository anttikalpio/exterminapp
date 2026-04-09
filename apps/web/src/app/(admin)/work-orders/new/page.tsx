"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { WorkOrderForm } from "@/components/forms/work-order-form";
import { ArrowLeft } from "lucide-react";

export default function NewWorkOrderPage() {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") ?? undefined;
  const siteId = searchParams.get("siteId") ?? undefined;

  const backHref = customerId
    ? `/customers/${customerId}`
    : siteId
      ? `/sites/${siteId}`
      : "/work-orders";

  return (
    <div>
      <div className="mb-6">
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("addWorkOrder")}</h1>
      </div>
      <WorkOrderForm presetCustomerId={customerId} presetSiteId={siteId} />
    </div>
  );
}
