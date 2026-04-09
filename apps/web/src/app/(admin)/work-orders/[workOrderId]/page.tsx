"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Plus,
  Pencil,
  UserPlus,
  X,
  Crosshair,
  ClipboardList,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

const WO_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}) {
  const { workOrderId } = use(params);
  const t = useTranslations("workOrders");
  const tt = useTranslations("traps");
  const tv = useTranslations("visits");
  const tc = useTranslations("common");
  const router = useRouter();
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");

  const { data: workOrder, isLoading } = trpc.workOrder.getById.useQuery({
    id: workOrderId,
  });
  const { data: trapList } = trpc.trap.listByWorkOrder.useQuery({
    workOrderId,
  });
  const { data: visitList, refetch: refetchVisits } =
    trpc.visit.listByWorkOrder.useQuery({ workOrderId });
  const { data: assignments, refetch: refetchAssignments } =
    trpc.workOrder.getAssignments.useQuery({ workOrderId });
  const { data: techOptions } = trpc.workOrder.technicianOptions.useQuery(
    undefined,
    { enabled: showAssignForm }
  );

  const assignMutation = trpc.workOrder.assign.useMutation({
    onSuccess: () => {
      refetchAssignments();
      setShowAssignForm(false);
      setSelectedTechId("");
    },
  });

  const unassignMutation = trpc.workOrder.unassign.useMutation({
    onSuccess: () => refetchAssignments(),
  });

  const createVisitMutation = trpc.visit.create.useMutation({
    onSuccess: (visit) => {
      refetchVisits();
      if (visit?.id) router.push(`/sites/${workOrder?.siteId}/visits/${visit.id}`);
    },
  });

  const deleteVisitMutation = trpc.visit.delete.useMutation({
    onSuccess: () => refetchVisits(),
  });

  const handleStartVisit = () => {
    createVisitMutation.mutate({ workOrderId });
  };

  const handleDeleteVisit = (id: string) => {
    if (!confirm(tv("deleteConfirm"))) return;
    deleteVisitMutation.mutate({ id });
  };

  const formatVisitDate = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString();
  };

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!workOrder) return <p className="text-gray-500">{tc("noResults")}</p>;

  const center =
    workOrder.siteLatitude && workOrder.siteLongitude
      ? {
          lat: parseFloat(workOrder.siteLatitude),
          lng: parseFloat(workOrder.siteLongitude),
        }
      : undefined;

  const trapStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-600";
      case "damaged":
        return "bg-amber-100 text-amber-700";
      case "removed":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const trapTypeLabel = (type: string) => {
    const key = {
      bait_station: "baitStation",
      snap_trap: "snapTrap",
      glue_board: "glueBoard",
      electronic: "electronic",
      live_catch: "liveCatch",
    }[type] as string | undefined;
    return key ? tt(key) : type;
  };

  const trapStatusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      inactive: "statusInactive",
      damaged: "statusDamaged",
      removed: "statusRemoved",
    }[status] as string | undefined;
    return key ? tt(key) : status;
  };

  const woStatusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      completed: "statusCompleted",
      cancelled: "statusCancelled",
    }[status] as string | undefined;
    return key ? t(key) : status;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/work-orders"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-gray-900">
                {workOrder.title}
              </h1>
              {workOrder.workOrderNumber && (
                <span className="font-mono text-sm text-gray-500">
                  #{workOrder.workOrderNumber}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  WO_STATUS_STYLES[workOrder.status] ??
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {woStatusLabel(workOrder.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              <Link
                href={`/customers/${workOrder.customerId}`}
                className="hover:text-gray-900 hover:underline"
              >
                {workOrder.customerName}
              </Link>
              {" · "}
              <Link
                href={`/sites/${workOrder.siteId}`}
                className="hover:text-gray-900 hover:underline"
              >
                <MapPin className="mr-0.5 inline h-3 w-3" />
                {workOrder.siteName}
              </Link>
            </p>
            {workOrder.description && (
              <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-gray-700">
                {workOrder.description}
              </p>
            )}
          </div>
          <Link
            href={`/work-orders/${workOrderId}/edit`}
            className="flex flex-shrink-0 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            {tc("edit")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map - takes 2 columns */}
        <div className="lg:col-span-2">
          <SiteMap
            center={center}
            traps={trapList ?? []}
            selectedTrapId={selectedTrapId ?? undefined}
            onTrapClick={(id) => setSelectedTrapId(id)}
            height="500px"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Traps List */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="font-medium text-gray-900">
                {t("traps")}{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({trapList?.length ?? 0})
                </span>
              </h2>
              <Link
                href={`/sites/${workOrder.siteId}/traps/new?workOrderId=${workOrderId}`}
                className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <Plus className="h-3 w-3" />
                {tt("addTrap")}
              </Link>
            </div>
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {!trapList || trapList.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  {tc("noResults")}
                </p>
              ) : (
                trapList.map((trap) => (
                  <Link
                    key={trap.id}
                    href={`/sites/${workOrder.siteId}/traps/${trap.id}`}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                      selectedTrapId === trap.id ? "bg-green-50" : ""
                    }`}
                    onMouseEnter={() => setSelectedTrapId(trap.id)}
                    onMouseLeave={() => setSelectedTrapId(null)}
                  >
                    <div className="flex items-center gap-3">
                      <Crosshair className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {trap.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {trapTypeLabel(trap.trapType)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${trapStatusColor(trap.status)}`}
                    >
                      {trapStatusLabel(trap.status)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Assignments */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="font-medium text-gray-900">{t("assignments")}</h2>
              <button
                onClick={() => setShowAssignForm(true)}
                className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <UserPlus className="h-3 w-3" />
                {t("assignTech")}
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {showAssignForm && (
                <div className="flex items-center gap-2 px-4 py-3">
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="">{t("selectTechnician")}</option>
                    {techOptions
                      ?.filter(
                        (tech) =>
                          !assignments?.some((a) => a.userId === tech.id)
                      )
                      .map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.firstName} {tech.lastName}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() =>
                      selectedTechId &&
                      assignMutation.mutate({
                        workOrderId,
                        userId: selectedTechId,
                      })
                    }
                    disabled={!selectedTechId}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {tc("save")}
                  </button>
                  <button
                    onClick={() => setShowAssignForm(false)}
                    className="rounded p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!assignments || assignments.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  {t("noAssignments")}
                </p>
              ) : (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {a.firstName} {a.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{a.email}</p>
                    </div>
                    <button
                      onClick={() =>
                        unassignMutation.mutate({ assignmentId: a.id })
                      }
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      {t("unassign")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visits */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 font-medium text-gray-900">
            <ClipboardList className="h-4 w-4 text-gray-500" />
            {tv("title")}{" "}
            <span className="text-sm font-normal text-gray-500">
              ({visitList?.length ?? 0})
            </span>
          </h2>
          <button
            type="button"
            onClick={handleStartVisit}
            disabled={createVisitMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {tv("startVisit")}
          </button>
        </div>

        {createVisitMutation.error && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
            {createVisitMutation.error.message}
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {!visitList || visitList.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              {tv("noVisits")}
            </p>
          ) : (
            visitList.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <Link
                  href={`/sites/${workOrder.siteId}/visits/${v.id}`}
                  className="flex flex-1 items-center gap-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {v.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatVisitDate(v.visitedAt)} · {v.createdByName}
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {tv("poisonCount", { count: v.poisonCount })}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteVisit(v.id)}
                  className="ml-3 rounded p-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                  title={tc("delete")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
