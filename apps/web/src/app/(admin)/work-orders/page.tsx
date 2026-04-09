"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function WorkOrdersPage() {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "" | "active" | "completed" | "cancelled"
  >("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.workOrder.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    page,
  });

  const deleteMutation = trpc.workOrder.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDelete = (id: string) => {
    if (confirm(t("deleteConfirm"))) {
      deleteMutation.mutate({ id });
    }
  };

  const statusLabel = (s: string) => {
    const key = {
      active: "statusActive",
      completed: "statusCompleted",
      cancelled: "statusCancelled",
    }[s] as string | undefined;
    return key ? t(key) : s;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/work-orders/new"
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          {t("addWorkOrder")}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={tc("search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        >
          <option value="">{t("status")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="completed">{t("statusCompleted")}</option>
          <option value="cancelled">{t("statusCancelled")}</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("workOrderNumber")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("workOrderTitle")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("customer")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("site")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("status")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("traps")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {tc("loading")}
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {tc("noResults")}
                </td>
              </tr>
            ) : (
              data?.items.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {wo.workOrderNumber ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="text-green-600 hover:text-green-700 hover:underline"
                    >
                      {wo.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <Link
                      href={`/customers/${wo.customerId}`}
                      className="hover:text-gray-900 hover:underline"
                    >
                      {wo.customerName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {wo.siteName}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[wo.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {statusLabel(wo.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">
                    {wo.trapCount}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/work-orders/${wo.id}/edit`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(wo.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {data.total} {t("title").toLowerCase()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              &laquo;
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * data.pageSize >= data.total}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
