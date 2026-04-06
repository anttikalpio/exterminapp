"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@exterminapp/shared";

interface EmployeeFormProps {
  initialData?: UpdateEmployeeInput & { id: string };
}

export function EmployeeForm({ initialData }: EmployeeFormProps) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const router = useRouter();
  const isEditing = !!initialData;

  const [form, setForm] = useState({
    email: initialData?.email ?? "",
    password: "",
    firstName: initialData?.firstName ?? "",
    lastName: initialData?.lastName ?? "",
    role: initialData?.role ?? "field_technician",
    phone: initialData?.phone ?? "",
  });

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => router.push("/employees"),
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => router.push("/employees"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      const { password, ...data } = form;
      updateMutation.mutate({ id: initialData.id, data });
    } else {
      createMutation.mutate(form as CreateEmployeeInput);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firstName")} *
          </label>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("lastName")} *
          </label>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("email")} *
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        />
      </div>

      {!isEditing && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("password")} *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("role")} *
          </label>
          <select
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          >
            <option value="admin">{t("roleAdmin")}</option>
            <option value="field_technician">{t("roleFieldTech")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("phone")}
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? tc("loading") : tc("save")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/employees")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
