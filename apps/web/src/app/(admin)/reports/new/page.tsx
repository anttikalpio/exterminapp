"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  ChevronRight,
  ChevronLeft,
  FileText,
  Download,
  Check,
} from "lucide-react";

const TRAP_TYPE_LABELS: Record<string, string> = {
  bait_station: "Bait Station",
  snap_trap: "Snap Trap",
  glue_board: "Glue Board",
  electronic: "Electronic",
  live_catch: "Live Catch",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  damaged: "Damaged",
  removed: "Removed",
};

export default function NewReportPage() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [title, setTitle] = useState("");
  const [comments, setComments] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Data queries
  const { data: customers } = trpc.report.customerOptions.useQuery();
  const { data: siteOptions } = trpc.report.siteOptions.useQuery(
    { customerId },
    { enabled: !!customerId }
  );
  const { data: reportData, isLoading: dataLoading } =
    trpc.report.getSiteReportData.useQuery(
      { siteId, periodStart, periodEnd },
      { enabled: !!siteId && !!periodStart && !!periodEnd && step === 3 }
    );

  const createMutation = trpc.report.create.useMutation({
    onSuccess: (data) => {
      setSavedReportId(data.id);
      setSuccessMsg(t("created"));
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const selectedSite = siteOptions?.find((s) => s.id === siteId);

  // Auto-generate title when moving to step 3
  const goToStep3 = () => {
    if (!title && selectedCustomer && selectedSite) {
      setTitle(
        `${selectedSite.name} — ${periodStart} - ${periodEnd}`
      );
    }
    setStep(3);
  };

  const handleSave = (status: "draft" | "final") => {
    createMutation.mutate({
      siteId,
      title,
      periodStart,
      periodEnd,
      comments,
      status,
    });
  };

  const handleDownloadPdf = async () => {
    setPdfGenerating(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        siteId,
        periodStart,
        periodEnd,
        title,
        comments,
      });
      const res = await fetch(`/api/reports/pdf?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `PDF generation failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(t("pdfGenerated"));
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {t("createReport")}
      </h1>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? "bg-green-600 text-white"
                  : s < step
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span
              className={`text-sm ${s === step ? "font-medium text-gray-900" : "text-gray-500"}`}
            >
              {s === 1 ? t("step1") : s === 2 ? t("step2") : t("step3")}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Customer & Site */}
      {step === 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            {t("step1")}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("selectCustomer")}
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setSiteId("");
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              >
                <option value="">{t("selectCustomer")}...</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>

            {customerId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("selectSite")}
                </label>
                {siteOptions && siteOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t("noSitesForCustomer")}
                  </p>
                ) : (
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="">{t("selectSite")}...</option>
                    {siteOptions?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.address ? `— ${s.address}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!customerId || !siteId}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Timeframe */}
      {step === 2 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            {t("step2")}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("periodStart")}
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("periodEnd")}
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("back")}
            </button>
            <button
              onClick={goToStep3}
              disabled={!periodStart || !periodEnd}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Comments */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Title */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("reportTitle")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Summary info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">{t("customer")}:</span>{" "}
                <span className="text-gray-900">{selectedCustomer?.businessName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">{t("site")}:</span>{" "}
                <span className="text-gray-900">{reportData?.site.name || selectedSite?.name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">{t("periodStart")}:</span>{" "}
                <span className="text-gray-900">{periodStart}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">{t("periodEnd")}:</span>{" "}
                <span className="text-gray-900">{periodEnd}</span>
              </div>
              {reportData?.site.address && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-500">{t("siteAddress")}:</span>{" "}
                  <span className="text-gray-900">{reportData.site.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Trap Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-lg font-medium text-gray-900">
              {t("trapSummary")}
            </h3>
            {dataLoading ? (
              <p className="text-sm text-gray-500">{tc("loading")}</p>
            ) : !reportData || reportData.traps.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noTraps")}</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      {t("trapLabel")}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      {t("trapType")}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      {t("trapStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.traps.map((trap) => (
                    <tr key={trap.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {trap.label}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {TRAP_TYPE_LABELS[trap.trapType] || trap.trapType}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            trap.status === "active"
                              ? "bg-green-100 text-green-700"
                              : trap.status === "damaged"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[trap.status] || trap.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Poison Activity */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-lg font-medium text-gray-900">
              {t("poisonActivity")}
            </h3>
            {dataLoading ? (
              <p className="text-sm text-gray-500">{tc("loading")}</p>
            ) : !reportData || reportData.poisonHistory.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noPoisonActivity")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        {t("date")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        {t("trapLabel")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        {t("poisonType")}
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        {t("remaining")}
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        {t("added")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        {t("technician")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        {t("notes")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.poisonHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                          {new Date(entry.performedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {entry.trapLabel}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {entry.poisonType}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {entry.remainingGrams ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {entry.quantityGrams}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {entry.performedByName}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {entry.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-lg font-medium text-gray-900">
              {t("comments")}
            </h3>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={5}
              placeholder={t("commentsPlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("back")}
            </button>

            <div className="flex items-center gap-3">
              {!savedReportId && (
                <>
                  <button
                    onClick={() => handleSave("draft")}
                    disabled={createMutation.isPending || !title}
                    className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {t("statusDraft")}
                  </button>
                  <button
                    onClick={() => handleSave("final")}
                    disabled={createMutation.isPending || !title}
                    className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {tc("save")}
                  </button>
                </>
              )}

              <button
                onClick={handleDownloadPdf}
                disabled={pdfGenerating || !title}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {pdfGenerating ? tc("loading") : t("generatePdf")}
              </button>
            </div>
          </div>

          {savedReportId && (
            <div className="flex justify-end">
              <button
                onClick={() => router.push("/reports")}
                className="text-sm text-green-600 underline hover:text-green-700"
              >
                ← {t("title")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
