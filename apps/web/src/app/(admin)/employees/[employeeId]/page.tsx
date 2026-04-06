"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { EmployeeForm } from "@/components/forms/employee-form";
import { ArrowLeft } from "lucide-react";

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const t = useTranslations("employees");
  const tc = useTranslations("common");

  const { data: employee, isLoading } = trpc.employee.getById.useQuery({
    id: employeeId,
  });

  if (isLoading) {
    return <p className="text-gray-500">{tc("loading")}</p>;
  }

  if (!employee) {
    return <p className="text-gray-500">{tc("noResults")}</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/employees"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("editEmployee")}
        </h1>
      </div>
      <EmployeeForm
        initialData={{
          id: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: employee.role as "admin" | "field_technician",
          phone: employee.phone ?? "",
        }}
      />
    </div>
  );
}
