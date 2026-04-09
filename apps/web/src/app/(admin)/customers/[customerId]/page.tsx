"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Pencil,
  Plus,
  MapPin,
  Briefcase,
  Mail,
  Phone,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const t = useTranslations("customers");
  const ts = useTranslations("sites");
  const tw = useTranslations("workOrders");
  const tc = useTranslations("common");

  const { data: customer, isLoading } = trpc.customer.getById.useQuery({
    id: customerId,
  });
  const { data: customerSites } = trpc.site.listByCustomer.useQuery({
    customerId,
  });
  const { data: workOrders } = trpc.workOrder.listByCustomer.useQuery({
    customerId,
  });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!customer) return <p className="text-gray-500">{tc("noResults")}</p>;

  const statusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      completed: "statusCompleted",
      cancelled: "statusCancelled",
    }[status] as string | undefined;
    return key ? tw(key) : status;
  };

  const billingCity = [customer.billingZipCode, customer.billingCity]
    .filter(Boolean)
    .join(" ");
  const billingLines = [
    customer.billingStreetAddress,
    customer.billingPoBox ? `PO Box ${customer.billingPoBox}` : null,
    billingCity || null,
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/customers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.businessName}
            </h1>
            {customer.customerNumber && (
              <p className="font-mono text-sm text-gray-500">
                #{customer.customerNumber}
              </p>
            )}
          </div>
          <Link
            href={`/customers/${customerId}/edit`}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            {tc("edit")}
          </Link>
        </div>
      </div>

      {/* Contact details card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">
          {t("details")}
        </h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {customer.contactName && (
            <div>
              <p className="text-xs text-gray-500">{t("contactName")}</p>
              <p className="text-gray-900">{customer.contactName}</p>
            </div>
          )}
          {customer.contactPhone && (
            <div>
              <p className="text-xs text-gray-500">{t("contactPhone")}</p>
              <p className="flex items-center gap-1 text-gray-900">
                <Phone className="h-3 w-3 text-gray-400" />
                {customer.contactPhone}
              </p>
            </div>
          )}
          {customer.contactEmail && (
            <div>
              <p className="text-xs text-gray-500">{t("contactEmail")}</p>
              <p className="flex items-center gap-1 text-gray-900">
                <Mail className="h-3 w-3 text-gray-400" />
                {customer.contactEmail}
              </p>
            </div>
          )}
          {customer.billingEmail && (
            <div>
              <p className="text-xs text-gray-500">{t("billingEmail")}</p>
              <p className="text-gray-900">{customer.billingEmail}</p>
            </div>
          )}
          {billingLines.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500">{t("billingAddress")}</p>
              <p className="text-gray-900">{billingLines.join(", ")}</p>
            </div>
          )}
          {customer.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500">{t("notes")}</p>
              <p className="whitespace-pre-wrap text-gray-900">
                {customer.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sites */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium text-gray-900">
              <MapPin className="h-4 w-4 text-gray-500" />
              {t("sites")}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({customerSites?.length ?? 0})
              </span>
            </h2>
            <Link
              href={`/sites/new?customerId=${customerId}`}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Plus className="h-3 w-3" />
              {ts("addSite")}
            </Link>
          </div>
          <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {!customerSites || customerSites.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                {t("noSites")}
              </p>
            ) : (
              customerSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {site.name}
                    </p>
                    {site.address && (
                      <p className="text-xs text-gray-500">{site.address}</p>
                    )}
                  </div>
                  {site.latitude && site.longitude && (
                    <MapPin className="h-4 w-4 text-green-600" />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Work Orders */}
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
              href={`/work-orders/new?customerId=${customerId}`}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Plus className="h-3 w-3" />
              {tw("addWorkOrder")}
            </Link>
          </div>
          <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
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
                      {wo.siteName} · {tw("trapCount", { count: wo.trapCount })}
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
    </div>
  );
}
