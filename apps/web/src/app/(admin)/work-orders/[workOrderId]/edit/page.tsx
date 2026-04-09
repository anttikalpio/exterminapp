"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { WorkOrderForm } from "@/components/forms/work-order-form";
import { ArrowLeft } from "lucide-react";

export default function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}) {
  const { workOrderId } = use(params);
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");

  const { data: workOrder, isLoading } = trpc.workOrder.getById.useQuery({
    id: workOrderId,
  });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!workOrder) return <p className="text-gray-500">{tc("noResults")}</p>;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/work-orders/${workOrderId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("editWorkOrder")}
        </h1>
      </div>
      <WorkOrderForm
        initialData={{
          id: workOrder.id,
          customerId: workOrder.customerId,
          siteId: workOrder.siteId,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          description: workOrder.description,
          status: workOrder.status,
          startDate: workOrder.startDate,
          endDate: workOrder.endDate,
          notes: workOrder.notes,
        }}
      />
    </div>
  );
}
