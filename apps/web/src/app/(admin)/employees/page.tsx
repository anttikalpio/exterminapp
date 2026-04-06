"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, UserX } from "lucide-react";

export default function EmployeesPage() {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.employee.list.useQuery({ page });

  const deactivateMutation = trpc.employee.deactivate.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDeactivate = (id: string) => {
    if (confirm(t("deactivateConfirm"))) {
      deactivateMutation.mutate({ id });
    }
  };

  const roleLabel = (role: string) =>
    role === "admin" ? t("roleAdmin") : t("roleFieldTech");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/employees/new"
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          {t("addEmployee")}
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("lastName")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("firstName")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("email")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("role")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {tc("status")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {tc("loading")}
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {tc("noResults")}
                </td>
              </tr>
            ) : (
              data?.items.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {emp.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {emp.firstName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {emp.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {roleLabel(emp.role)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        emp.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {emp.isActive ? tc("active") : tc("inactive")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/employees/${emp.id}`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {emp.isActive && (
                        <button
                          onClick={() => handleDeactivate(emp.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
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
