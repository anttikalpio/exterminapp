"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";

type FormState = {
  customerId: string;
  siteId: string;
  workOrderNumber: string;
  title: string;
  description: string;
  status: "active" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  notes: string;
};

interface WorkOrderFormProps {
  initialData?: {
    id: string;
    customerId: string;
    siteId: string;
    workOrderNumber: string | null;
    title: string;
    description: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    notes: string | null;
  };
  presetCustomerId?: string;
  presetSiteId?: string;
}

// `date-fns` not used here to keep the dep footprint small. Turns an ISO
// date (YYYY-MM-DD) or full ISO string into the YYYY-MM-DD form that the
// native date picker expects.
function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function WorkOrderForm({
  initialData,
  presetCustomerId,
  presetSiteId,
}: WorkOrderFormProps) {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const router = useRouter();
  const bannerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({
    customerId: initialData?.customerId ?? presetCustomerId ?? "",
    siteId: initialData?.siteId ?? presetSiteId ?? "",
    workOrderNumber: initialData?.workOrderNumber ?? "",
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    status: (initialData?.status as FormState["status"]) ?? "active",
    startDate: toDateInput(initialData?.startDate ?? null),
    endDate: toDateInput(initialData?.endDate ?? null),
    notes: initialData?.notes ?? "",
  });

  const { data: customers } = trpc.workOrder.customerOptions.useQuery();
  const { data: sites } = trpc.workOrder.siteOptions.useQuery(
    { customerId: form.customerId },
    { enabled: !!form.customerId }
  );

  const createMutation = trpc.workOrder.create.useMutation({
    onSuccess: (wo) => {
      if (wo?.id) router.push(`/work-orders/${wo.id}`);
      else router.push("/work-orders");
    },
  });

  const updateMutation = trpc.workOrder.update.useMutation({
    onSuccess: (wo) => {
      if (wo?.id) router.push(`/work-orders/${wo.id}`);
      else router.push("/work-orders");
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;
  const zodError = error?.data?.zodError ?? null;

  useEffect(() => {
    if (error && bannerRef.current) {
      bannerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const getFieldError = (name: keyof FormState): string | undefined =>
    zodError?.fieldErrors?.[name]?.[0];

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      customerId: form.customerId,
      siteId: form.siteId,
      workOrderNumber: form.workOrderNumber.trim() || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      startDate: form.startDate ? new Date(form.startDate) : null,
      endDate: form.endDate ? new Date(form.endDate) : null,
      notes: form.notes.trim() || undefined,
    };

    if (initialData?.id) {
      updateMutation.mutate({
        id: initialData.id,
        data: {
          siteId: payload.siteId,
          workOrderNumber: payload.workOrderNumber,
          title: payload.title,
          description: payload.description,
          status: payload.status,
          startDate: payload.startDate,
          endDate: payload.endDate,
          notes: payload.notes,
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const inputClass = (field: keyof FormState) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none ${
      getFieldError(field)
        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
        : "border-gray-300 focus:border-green-500 focus:ring-green-500"
    }`;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("customer")} *
          </label>
          <select
            required
            disabled={!!initialData}
            value={form.customerId}
            onChange={(e) => {
              updateField("customerId", e.target.value);
              updateField("siteId", "");
            }}
            className={inputClass("customerId")}
          >
            <option value="">{t("selectCustomer")}</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
              </option>
            ))}
          </select>
          {getFieldError("customerId") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("customerId")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("site")} *
          </label>
          <select
            required
            value={form.siteId}
            onChange={(e) => updateField("siteId", e.target.value)}
            disabled={!form.customerId}
            className={inputClass("siteId")}
          >
            <option value="">{t("selectSite")}</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.address ? ` — ${s.address}` : ""}
              </option>
            ))}
          </select>
          {form.customerId && sites && sites.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              {t("noSitesForCustomer")}
            </p>
          )}
          {getFieldError("siteId") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("siteId")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("workOrderNumber")}
          </label>
          <input
            type="text"
            value={form.workOrderNumber}
            onChange={(e) => updateField("workOrderNumber", e.target.value)}
            placeholder={t("workOrderNumberPlaceholder")}
            className={inputClass("workOrderNumber")}
          />
          {getFieldError("workOrderNumber") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("workOrderNumber")}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("workOrderTitle")} *
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className={inputClass("title")}
          />
          {getFieldError("title") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("title")}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("description")}
        </label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={3}
          className={inputClass("description")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("status")}
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              updateField("status", e.target.value as FormState["status"])
            }
            className={inputClass("status")}
          >
            <option value="active">{t("statusActive")}</option>
            <option value="completed">{t("statusCompleted")}</option>
            <option value="cancelled">{t("statusCancelled")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("startDate")}
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => updateField("startDate", e.target.value)}
            className={inputClass("startDate")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("endDate")}
          </label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => updateField("endDate", e.target.value)}
            className={inputClass("endDate")}
          />
        </div>
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
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
