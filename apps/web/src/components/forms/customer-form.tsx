"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import type { CreateCustomerInput } from "@exterminapp/shared";

interface CustomerFormProps {
  initialData?: CreateCustomerInput & { id: string };
}

export function CustomerForm({ initialData }: CustomerFormProps) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const router = useRouter();

  const [form, setForm] = useState<CreateCustomerInput>({
    businessName: initialData?.businessName ?? "",
    contactName: initialData?.contactName ?? "",
    contactEmail: initialData?.contactEmail ?? "",
    contactPhone: initialData?.contactPhone ?? "",
    billingAddress: initialData?.billingAddress ?? "",
    billingEmail: initialData?.billingEmail ?? "",
    notes: initialData?.notes ?? "",
  });

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => router.push("/customers"),
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => router.push("/customers"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData?.id) {
      updateMutation.mutate({ id: initialData.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const updateField = (field: keyof CreateCustomerInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("businessName")} *
        </label>
        <input
          type="text"
          required
          value={form.businessName}
          onChange={(e) => updateField("businessName", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("contactName")}
          </label>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => updateField("contactName", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("contactPhone")}
          </label>
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => updateField("contactPhone", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("contactEmail")}
          </label>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => updateField("contactEmail", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("billingEmail")}
          </label>
          <input
            type="email"
            value={form.billingEmail}
            onChange={(e) => updateField("billingEmail", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("billingAddress")}
        </label>
        <textarea
          value={form.billingAddress}
          onChange={(e) => updateField("billingAddress", e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        />
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
          onClick={() => router.push("/customers")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
