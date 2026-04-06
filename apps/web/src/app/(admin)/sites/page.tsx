"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

export default function SitesPage() {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.site.list.useQuery({
    search: search || undefined,
    page,
  });

  const deleteMutation = trpc.site.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDelete = (id: string) => {
    if (confirm(t("deleteConfirm"))) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/sites/new"
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          {t("addSite")}
        </Link>
      </div>

      <div className="mb-4">
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
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("name")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("customer")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("address")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("location")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {tc("loading")}
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {tc("noResults")}
                </td>
              </tr>
            ) : (
              data?.items.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <Link
                      href={`/sites/${site.id}`}
                      className="text-green-600 hover:text-green-700 hover:underline"
                    >
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {site.customerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {site.address}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {site.latitude && site.longitude ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <MapPin className="h-3 w-3" />
                        {parseFloat(site.latitude).toFixed(4)},{" "}
                        {parseFloat(site.longitude).toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/sites/${site.id}`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(site.id)}
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
