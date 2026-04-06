"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useGeolocation } from "@/hooks/use-geolocation";
import { ArrowLeft, MapPin } from "lucide-react";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

export default function NewTrapPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const t = useTranslations("traps");
  const tc = useTranslations("common");
  const router = useRouter();
  const geo = useGeolocation();

  const [form, setForm] = useState({
    label: "",
    latitude: "",
    longitude: "",
    trapType: "bait_station",
    notes: "",
  });

  const { data: site } = trpc.site.getById.useQuery({ id: siteId });
  const { data: existingTraps } = trpc.trap.listBySite.useQuery({ siteId });

  const createMutation = trpc.trap.create.useMutation({
    onSuccess: () => router.push(`/sites/${siteId}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      siteId,
      label: form.label,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      trapType: form.trapType,
      notes: form.notes || undefined,
    });
  };

  const handleUseGps = () => {
    geo.getCurrentPosition();
  };

  if (geo.latitude && geo.longitude && !geo.loading) {
    if (
      form.latitude !== geo.latitude.toString() ||
      form.longitude !== geo.longitude.toString()
    ) {
      setForm((prev) => ({
        ...prev,
        latitude: geo.latitude!.toFixed(7),
        longitude: geo.longitude!.toFixed(7),
      }));
    }
  }

  const handleMapClick = (lat: number, lng: number) => {
    setForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(7),
      longitude: lng.toFixed(7),
    }));
  };

  const siteCenter =
    site?.latitude && site?.longitude
      ? { lat: parseFloat(site.latitude), lng: parseFloat(site.longitude) }
      : undefined;

  const clickMarker =
    form.latitude && form.longitude
      ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
      : null;

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
        <h1 className="text-2xl font-bold text-gray-900">{t("addTrap")}</h1>
        {site && (
          <p className="text-sm text-gray-500">{site.name}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
        {createMutation.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {createMutation.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("label")} *
              </label>
              <input
                type="text"
                required
                placeholder="T-001"
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("trapType")} *
              </label>
              <select
                value={form.trapType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, trapType: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              >
                <option value="bait_station">{t("baitStation")}</option>
                <option value="snap_trap">{t("snapTrap")}</option>
                <option value="glue_board">{t("glueBoard")}</option>
                <option value="electronic">{t("electronic")}</option>
                <option value="live_catch">{t("liveCatch")}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("location")} - Lat *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={form.latitude}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, latitude: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lng *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={form.longitude}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      longitude: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseGps}
              disabled={geo.loading}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              {geo.loading ? tc("loading") : t("useGps")}
            </button>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {createMutation.isPending ? tc("loading") : tc("save")}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/sites/${siteId}`)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tc("cancel")}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-gray-500">
              {t("clickMapToPlace")}
            </p>
            <SiteMap
              center={siteCenter}
              traps={existingTraps ?? []}
              onMapClick={handleMapClick}
              showClickMarker={clickMarker}
              height="450px"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
