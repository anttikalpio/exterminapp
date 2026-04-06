"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmployeeForm } from "@/components/forms/employee-form";
import { ArrowLeft } from "lucide-react";

export default function NewEmployeePage() {
  const t = useTranslations("employees");
  const tc = useTranslations("common");

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
          {t("addEmployee")}
        </h1>
      </div>
      <EmployeeForm />
    </div>
  );
}
