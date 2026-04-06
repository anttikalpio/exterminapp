"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Pencil, UserPlus, X, Crosshair } from "lucide-react";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const t = useTranslations("sites");
  const tt = useTranslations("traps");
  const tc = useTranslations("common");
  const router = useRouter();
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [editMode, setEditMode] = useState(false);

  const { data: site, isLoading } = trpc.site.getById.useQuery({ id: siteId });
  const { data: trapList, refetch: refetchTraps } =
    trpc.trap.listBySite.useQuery({ siteId });
  const { data: assignments, refetch: refetchAssignments } =
    trpc.site.getAssignments.useQuery({ siteId });
  const { data: techOptions } = trpc.site.technicianOptions.useQuery(
    undefined,
    { enabled: showAssignForm }
  );

  const assignMutation = trpc.site.assign.useMutation({
    onSuccess: () => {
      refetchAssignments();
      setShowAssignForm(false);
      setSelectedTechId("");
    },
  });

  const unassignMutation = trpc.site.unassign.useMutation({
    onSuccess: () => refetchAssignments(),
  });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!site) return <p className="text-gray-500">{tc("noResults")}</p>;

  const center =
    site.latitude && site.longitude
      ? {
          lat: parseFloat(site.latitude),
          lng: parseFloat(site.longitude),
        }
      : undefined;

  const trapStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-700";
      case "inactive": return "bg-gray-100 text-gray-600";
      case "damaged": return "bg-amber-100 text-amber-700";
      case "removed": return "bg-red-100 text-red-600";
      default: return "bg-gray-100 text-gray-600";
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

  const statusLabel = (status: string) => {
    const key = {
      active: "statusActive",
      inactive: "statusInactive",
      damaged: "statusDamaged",
      removed: "statusRemoved",
    }[status] as string | undefined;
    return key ? tt(key) : status;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/sites"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            <p className="text-sm text-gray-500">{site.customerName}</p>
            {site.address && (
              <p className="text-sm text-gray-500">{site.address}</p>
            )}
          </div>
          <Link
            href={`/sites/${siteId}/edit`}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                href={`/sites/${siteId}/traps/new`}
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
                    href={`/sites/${siteId}/traps/${trap.id}`}
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
                      {statusLabel(trap.status)}
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
                        siteId,
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
    </div>
  );
}
