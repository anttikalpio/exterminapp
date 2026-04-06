"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Crosshair } from "lucide-react";
import { POISON_TYPES } from "@exterminapp/shared";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

export default function TrapDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; trapId: string }>;
}) {
  const { siteId, trapId } = use(params);
  const t = useTranslations("traps");
  const tc = useTranslations("common");
  const [showPoisonForm, setShowPoisonForm] = useState(false);
  const [poisonForm, setPoisonForm] = useState({
    poisonType: POISON_TYPES[0] as string,
    remainingGrams: "",
    quantityGrams: "",
    notes: "",
  });
  const [statusForm, setStatusForm] = useState<string | null>(null);

  const { data: trap, isLoading } = trpc.trap.getById.useQuery({ id: trapId });
  const { data: allTraps } = trpc.trap.listBySite.useQuery({ siteId });
  const {
    data: poisonHistory,
    refetch: refetchHistory,
  } = trpc.trap.poisonHistory.useQuery({ trapId });

  const addPoisonMutation = trpc.trap.addPoison.useMutation({
    onSuccess: () => {
      refetchHistory();
      setShowPoisonForm(false);
      setPoisonForm({ poisonType: POISON_TYPES[0], remainingGrams: "", quantityGrams: "", notes: "" });
    },
  });

  const updateStatusMutation = trpc.trap.update.useMutation({
    onSuccess: () => {
      setStatusForm(null);
      // Refetch trap data
      window.location.reload();
    },
  });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!trap) return <p className="text-gray-500">{tc("noResults")}</p>;

  const trapTypeLabel = (type: string) => {
    const key = {
      bait_station: "baitStation",
      snap_trap: "snapTrap",
      glue_board: "glueBoard",
      electronic: "electronic",
      live_catch: "liveCatch",
    }[type] as string | undefined;
    return key ? t(key) : type;
  };

  const statusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      inactive: "statusInactive",
      damaged: "statusDamaged",
      removed: "statusRemoved",
    }[status] as string | undefined;
    return key ? t(key) : status;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-700";
      case "inactive": return "bg-gray-100 text-gray-600";
      case "damaged": return "bg-amber-100 text-amber-700";
      case "removed": return "bg-red-100 text-red-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const handleAddPoison = (e: React.FormEvent) => {
    e.preventDefault();
    addPoisonMutation.mutate({
      trapId,
      poisonType: poisonForm.poisonType,
      remainingGrams: parseFloat(poisonForm.remainingGrams),
      quantityGrams: parseFloat(poisonForm.quantityGrams),
      notes: poisonForm.notes || undefined,
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updateStatusMutation.mutate({
      id: trapId,
      data: { status: newStatus as "active" | "inactive" | "damaged" | "removed" },
    });
  };

  const center = {
    lat: parseFloat(trap.latitude),
    lng: parseFloat(trap.longitude),
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/sites/${siteId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-center gap-3">
          <Crosshair className="h-6 w-6 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{trap.label}</h1>
            <p className="text-sm text-gray-500">{trap.siteName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map + Details */}
        <div className="space-y-4 lg:col-span-2">
          <SiteMap
            center={center}
            traps={allTraps ?? []}
            selectedTrapId={trapId}
            height="350px"
          />

          {/* Trap Info Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t("trapType")}:</span>{" "}
                <span className="font-medium">{trapTypeLabel(trap.trapType)}</span>
              </div>
              <div>
                <span className="text-gray-500">{t("status")}:</span>{" "}
                <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(trap.status)}`}>
                  {statusLabel(trap.status)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t("location")}:</span>{" "}
                <span className="font-medium">
                  {parseFloat(trap.latitude).toFixed(5)},{" "}
                  {parseFloat(trap.longitude).toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t("installedAt")}:</span>{" "}
                <span className="font-medium">
                  {new Date(trap.installedAt).toLocaleDateString()}
                </span>
              </div>
              {trap.notes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Notes:</span>{" "}
                  <span>{trap.notes}</span>
                </div>
              )}
            </div>

            {/* Status change */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <span className="mr-2 text-sm text-gray-500">{t("status")}:</span>
              {["active", "inactive", "damaged", "removed"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={trap.status === s}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    trap.status === s
                      ? statusColor(s) + " cursor-default"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Poison History */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="font-medium text-gray-900">{t("poisonHistory")}</h2>
            <button
              onClick={() => setShowPoisonForm(!showPoisonForm)}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Plus className="h-3 w-3" />
              {t("addPoison")}
            </button>
          </div>

          {/* Add Poison Form */}
          {showPoisonForm && (
            <form
              onSubmit={handleAddPoison}
              className="space-y-3 border-b border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("poisonType")}
                </label>
                <select
                  value={poisonForm.poisonType}
                  onChange={(e) =>
                    setPoisonForm((p) => ({ ...p, poisonType: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                >
                  {POISON_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt.charAt(0).toUpperCase() + pt.slice(1).replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {t("remaining")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={poisonForm.remainingGrams}
                    onChange={(e) =>
                      setPoisonForm((p) => ({
                        ...p,
                        remainingGrams: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {t("quantity")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={poisonForm.quantityGrams}
                    onChange={(e) =>
                      setPoisonForm((p) => ({
                        ...p,
                        quantityGrams: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={poisonForm.notes}
                  onChange={(e) =>
                    setPoisonForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addPoisonMutation.isPending}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {addPoisonMutation.isPending ? tc("loading") : tc("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPoisonForm(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          )}

          {/* History List */}
          <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {!poisonHistory || poisonHistory.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {t("noPoisonHistory")}
              </p>
            ) : (
              poisonHistory.items.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {entry.poisonType.charAt(0).toUpperCase() +
                        entry.poisonType.slice(1).replace(/_/g, " ")}
                    </span>
                    <div className="text-right text-sm">
                      {entry.remainingGrams && (
                        <span className="text-gray-400">
                          {entry.remainingGrams}g →{" "}
                        </span>
                      )}
                      <span className="font-medium text-green-600">
                        +{entry.quantityGrams}g
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{entry.performedByName}</span>
                    <span>
                      {new Date(entry.performedAt).toLocaleDateString()}{" "}
                      {new Date(entry.performedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="mt-1 text-xs text-gray-400">{entry.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
