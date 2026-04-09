"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Briefcase,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const t = useTranslations("sites");
  const tw = useTranslations("workOrders");
  const tc = useTranslations("common");

  const { data: site, isLoading } = trpc.site.getById.useQuery({ id: siteId });
  const { data: workOrders } = trpc.workOrder.listBySite.useQuery({ siteId });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!site) return <p className="text-gray-500">{tc("noResults")}</p>;

  const center =
    site.latitude && site.longitude
      ? {
          lat: parseFloat(site.latitude),
          lng: parseFloat(site.longitude),
        }
      : undefined;

  const statusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      completed: "statusCompleted",
      cancelled: "statusCancelled",
    }[status] as string | undefined;
    return key ? tw(key) : status;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/sites"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-900">
              {site.name}
            </h1>
            <p className="text-sm text-gray-500">
              <Link
                href={`/customers/${site.customerId}`}
                className="hover:text-gray-900 hover:underline"
              >
                {site.customerName}
              </Link>
            </p>
            {site.address && (
              <p className="mt-1 text-sm text-gray-500">
                <MapPin className="mr-1 inline h-3 w-3" />
                {site.address}
              </p>
            )}
          </div>
          <Link
            href={`/sites/${siteId}/edit`}
            className="flex flex-shrink-0 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            {tc("edit")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <SiteMap center={center} height="400px" />
        </div>

        {/* Work orders at this site */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium text-gray-900">
              <Briefcase className="h-4 w-4 text-gray-500" />
              {t("workOrders")}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({workOrders?.length ?? 0})
              </span>
            </h2>
            <Link
              href={`/work-orders/new?customerId=${site.customerId}&siteId=${siteId}`}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Plus className="h-3 w-3" />
              {tw("addWorkOrder")}
            </Link>
          </div>
          <div className="max-h-[500px] divide-y divide-gray-100 overflow-y-auto">
            {!workOrders || workOrders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                {t("noWorkOrders")}
              </p>
            ) : (
              workOrders.map((wo) => (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {wo.title}
                      </p>
                      {wo.workOrderNumber && (
                        <span className="font-mono text-xs text-gray-400">
                          #{wo.workOrderNumber}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {tw("trapCount", { count: wo.trapCount })}
                    </p>
                  </div>
                  <span
                    className={`ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[wo.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {statusLabel(wo.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {site.notes && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            {t("notes")}
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-900">
            {site.notes}
          </p>
        </div>
      )}
    </div>
  );
}
