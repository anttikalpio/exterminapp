"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ClipboardList,
  Crosshair,
  Pencil,
  Plus,
  Save,
  X,
} from "lucide-react";
import { POISON_TYPES } from "@exterminapp/shared";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

type PoisonForm = {
  poisonType: string;
  remainingGrams: string;
  quantityGrams: string;
  notes: string;
};

const emptyPoisonForm: PoisonForm = {
  poisonType: POISON_TYPES[0] as string,
  remainingGrams: "",
  quantityGrams: "",
  notes: "",
};

// Format a Date (or ISO string) for an `<input type="datetime-local">` value.
// The input element expects `YYYY-MM-DDTHH:mm` in local time.
function toLocalInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function EditVisitPage({
  params,
}: {
  params: Promise<{ siteId: string; visitId: string }>;
}) {
  const { siteId, visitId } = use(params);
  const tv = useTranslations("visits");
  const tt = useTranslations("traps");
  const tc = useTranslations("common");

  const [editingMeta, setEditingMeta] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [visitedAtDraft, setVisitedAtDraft] = useState("");

  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null);
  const [poisonForm, setPoisonForm] = useState<PoisonForm>(emptyPoisonForm);

  const { data: visit, isLoading, refetch: refetchVisit } =
    trpc.visit.getById.useQuery({ id: visitId });
  const { data: trapList } = trpc.trap.listByWorkOrder.useQuery(
    { workOrderId: visit?.workOrderId ?? "" },
    { enabled: !!visit?.workOrderId }
  );
  const { data: additions, refetch: refetchAdditions } =
    trpc.visit.poisonAdditions.useQuery({ visitId });
  const { data: lastAddition, refetch: refetchLast } =
    trpc.trap.lastPoisonAddition.useQuery(
      { trapId: selectedTrapId ?? "" },
      { enabled: !!selectedTrapId }
    );

  const updateMutation = trpc.visit.update.useMutation({
    onSuccess: () => {
      refetchVisit();
      setEditingMeta(false);
    },
  });

  const addPoisonMutation = trpc.visit.addPoison.useMutation({
    onSuccess: () => {
      refetchAdditions();
      refetchLast();
      setSelectedTrapId(null);
      setPoisonForm(emptyPoisonForm);
    },
  });

  const deletePoisonMutation = trpc.visit.deletePoison.useMutation({
    onSuccess: () => refetchAdditions(),
  });

  // When the user picks a trap, pre-fill the form with the last-known
  // remaining (after topping up) and poison type so data entry is fast.
  useEffect(() => {
    if (!selectedTrapId) return;
    const defaultRemaining =
      lastAddition?.remainingGrams && lastAddition?.quantityGrams
        ? (
            parseFloat(lastAddition.remainingGrams) +
            parseFloat(lastAddition.quantityGrams)
          ).toFixed(2)
        : "";
    const defaultPoisonType =
      lastAddition?.poisonType ?? (POISON_TYPES[0] as string);
    setPoisonForm({
      poisonType: defaultPoisonType,
      remainingGrams: defaultRemaining,
      quantityGrams: "",
      notes: "",
    });
  }, [selectedTrapId, lastAddition]);

  const selectedTrap = useMemo(
    () => trapList?.find((t) => t.id === selectedTrapId) ?? null,
    [trapList, selectedTrapId]
  );

  const center = useMemo(() => {
    if (!trapList || trapList.length === 0) return undefined;
    const first = trapList[0];
    const lat = parseFloat(first.latitude);
    const lng = parseFloat(first.longitude);
    if (isNaN(lat) || isNaN(lng)) return undefined;
    return { lat, lng };
  }, [trapList]);

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!visit) return <p className="text-gray-500">{tc("noResults")}</p>;

  const startEditingMeta = () => {
    setNameDraft(visit.name);
    setVisitedAtDraft(toLocalInputValue(visit.visitedAt));
    setEditingMeta(true);
  };

  const saveMeta = () => {
    updateMutation.mutate({
      id: visitId,
      data: {
        name: nameDraft.trim() || undefined,
        visitedAt: new Date(visitedAtDraft),
      },
    });
  };

  const handleAddPoison = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrapId) return;
    addPoisonMutation.mutate({
      visitId,
      trapId: selectedTrapId,
      poisonType: poisonForm.poisonType,
      remainingGrams: poisonForm.remainingGrams
        ? parseFloat(poisonForm.remainingGrams)
        : undefined,
      quantityGrams: parseFloat(poisonForm.quantityGrams),
      notes: poisonForm.notes || undefined,
    });
  };

  const handleDeletePoison = (id: string) => {
    if (!confirm(tv("deletePoisonConfirm"))) return;
    deletePoisonMutation.mutate({ id });
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href={visit.workOrderId ? `/work-orders/${visit.workOrderId}` : `/sites/${siteId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-1 h-6 w-6 text-green-600" />
            {editingMeta ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xl font-bold text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
                <input
                  type="datetime-local"
                  value={visitedAtDraft}
                  onChange={(e) => setVisitedAtDraft(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveMeta}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {tc("save")}
                  </button>
                  <button
                    onClick={() => setEditingMeta(false)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    {tc("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {visit.name}
                </h1>
                <p className="text-sm text-gray-500">
                  {visit.siteName} ·{" "}
                  {new Date(visit.visitedAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {tv("createdBy")}: {visit.createdByName}
                </p>
              </div>
            )}
          </div>
          {!editingMeta && (
            <button
              onClick={startEditingMeta}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              {tc("edit")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map + add-poison form */}
        <div className="space-y-4 lg:col-span-2">
          <SiteMap
            center={center}
            traps={trapList ?? []}
            selectedTrapId={selectedTrapId ?? undefined}
            onTrapClick={(id) => setSelectedTrapId(id)}
            height="500px"
          />
          {!selectedTrapId ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
              {tv("clickTrapToAddPoison")}
            </div>
          ) : (
            <form
              onSubmit={handleAddPoison}
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  <Crosshair className="h-4 w-4 text-green-600" />
                  {tv("addPoisonFor", { label: selectedTrap?.label ?? "" })}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedTrapId(null)}
                  className="rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {tt("poisonType")}
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
                    {tt("remaining")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
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
                    {tt("quantity")}
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
                  {tv("notes")}
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
              {addPoisonMutation.error && (
                <p className="text-xs text-red-600">
                  {addPoisonMutation.error.message}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addPoisonMutation.isPending}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {addPoisonMutation.isPending ? tc("loading") : tc("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTrapId(null)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Poison additions list */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-medium text-gray-900">
              {tv("poisonForThisVisit")}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({additions?.length ?? 0})
              </span>
            </h2>
          </div>
          <div className="max-h-[600px] divide-y divide-gray-100 overflow-y-auto">
            {!additions || additions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {tt("noPoisonHistory")}
              </p>
            ) : (
              additions.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.trapLabel}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.poisonType.charAt(0).toUpperCase() +
                          entry.poisonType.slice(1).replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        onClick={() => handleDeletePoison(entry.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                        title={tc("delete")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{entry.performedByName}</span>
                    <span>
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
