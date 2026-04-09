"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import type { CreateCustomerInput } from "@exterminapp/shared";
import { AlertCircle } from "lucide-react";

interface CustomerFormProps {
  initialData?: CreateCustomerInput & { id: string };
}

export function CustomerForm({ initialData }: CustomerFormProps) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const router = useRouter();
  const bannerRef = useRef<HTMLDivElement>(null);

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
  const zodError = error?.data?.zodError ?? null;

  // Scroll the error banner into view so the user can't miss it.
  useEffect(() => {
    if (error && bannerRef.current) {
      bannerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const getFieldError = (name: keyof CreateCustomerInput): string | undefined =>
    zodError?.fieldErrors?.[name]?.[0];

  const updateField = (field: keyof CreateCustomerInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const inputClass = (field: keyof CreateCustomerInput) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none ${
      getFieldError(field)
        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
        : "border-gray-300 focus:border-green-500 focus:ring-green-500"
    }`;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div
          ref={bannerRef}
          className="rounded-md border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="text-sm">
              <p className="font-medium text-red-800">{t("saveError")}</p>
              <p className="mt-1 text-red-700">{error.message}</p>
              {zodError?.formErrors && zodError.formErrors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-red-700">
                  {zodError.formErrors.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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
          className={inputClass("businessName")}
        />
        {getFieldError("businessName") && (
          <p className="mt-1 text-xs text-red-600">
            {getFieldError("businessName")}
          </p>
        )}
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
            className={inputClass("contactName")}
          />
          {getFieldError("contactName") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactName")}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("contactPhone")}
          </label>
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => updateField("contactPhone", e.target.value)}
            className={inputClass("contactPhone")}
          />
          {getFieldError("contactPhone") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactPhone")}
            </p>
          )}
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
            className={inputClass("contactEmail")}
          />
          {getFieldError("contactEmail") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("contactEmail")}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("billingEmail")}
          </label>
          <input
            type="email"
            value={form.billingEmail}
            onChange={(e) => updateField("billingEmail", e.target.value)}
            className={inputClass("billingEmail")}
          />
          {getFieldError("billingEmail") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("billingEmail")}
            </p>
          )}
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
          className={inputClass("billingAddress")}
        />
        {getFieldError("billingAddress") && (
          <p className="mt-1 text-xs text-red-600">
            {getFieldError("billingAddress")}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("notes")}
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={3}
          className={inputClass("notes")}
        />
        {getFieldError("notes") && (
          <p className="mt-1 text-xs text-red-600">{getFieldError("notes")}</p>
        )}
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
