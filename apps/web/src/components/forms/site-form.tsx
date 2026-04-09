"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useGeocode } from "@/hooks/use-geocode";
import { AlertCircle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((m) => m.SiteMap),
  { ssr: false }
);

interface SiteFormProps {
  initialData?: {
    id: string;
    customerId: string;
    name: string;
    address?: string;
    latitude?: string | null;
    longitude?: string | null;
    notes?: string | null;
  };
  presetCustomerId?: string;
}

export function SiteForm({ initialData, presetCustomerId }: SiteFormProps) {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const router = useRouter();
  const geo = useGeolocation();

  const [form, setForm] = useState({
    customerId: initialData?.customerId ?? presetCustomerId ?? "",
    name: initialData?.name ?? "",
    address: initialData?.address ?? "",
    latitude: initialData?.latitude ?? "",
    longitude: initialData?.longitude ?? "",
    notes: initialData?.notes ?? "",
  });

  // Debounced address → lat/lng lookup via Nominatim.
  const geocode = useGeocode(form.address);

  // Target the map viewport should fly to. Separate from the current
  // lat/lng so clicking the map to place a marker doesn't recenter the
  // viewport back to the geocoded location.
  const [focusOn, setFocusOn] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // When geocoding finds a match, auto-fill lat/lng and re-focus the map.
  useEffect(() => {
    if (geocode.status === "found" && geocode.result) {
      const { lat, lng } = geocode.result;
      setForm((prev) => ({
        ...prev,
        latitude: lat.toFixed(7),
        longitude: lng.toFixed(7),
      }));
      setFocusOn({ lat, lng });
    }
  }, [geocode.status, geocode.result]);

  const { data: customerOptions } = trpc.site.customerOptions.useQuery();

  const createMutation = trpc.site.create.useMutation({
    onSuccess: (site) => {
      if (site?.customerId) {
        router.push(`/customers/${site.customerId}`);
      } else {
        router.push("/sites");
      }
    },
  });

  const updateMutation = trpc.site.update.useMutation({
    onSuccess: (site) => {
      if (site?.id) {
        router.push(`/sites/${site.id}`);
      } else {
        router.push("/sites");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = form.latitude ? parseFloat(form.latitude) : undefined;
    const lng = form.longitude ? parseFloat(form.longitude) : undefined;

    if (initialData?.id) {
      updateMutation.mutate({
        id: initialData.id,
        data: {
          name: form.name,
          address: form.address || undefined,
          latitude: lat,
          longitude: lng,
          notes: form.notes || undefined,
        },
      });
    } else {
      createMutation.mutate({
        customerId: form.customerId,
        name: form.name,
        address: form.address || undefined,
        latitude: lat,
        longitude: lng,
        notes: form.notes || undefined,
      });
    }
  };

  const handleUseLocation = () => {
    geo.getCurrentPosition();
  };

  // Apply GPS result to form when available
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

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const mapCenter =
    form.latitude && form.longitude
      ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
      : undefined;

  const clickMarker =
    form.latitude && form.longitude
      ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
      : null;

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {!initialData && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("customer")} *
              </label>
              <select
                required
                value={form.customerId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, customerId: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              >
                <option value="">{t("selectCustomer")}</option>
                {customerOptions?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("name")} *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("address")}
            </label>
            <textarea
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
            {geocode.status === "loading" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("searchingAddress")}
              </p>
            )}
            {geocode.status === "found" && geocode.result && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                <span className="truncate">{geocode.result.displayName}</span>
              </p>
            )}
            {geocode.status === "not_found" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                {t("addressNotFound")}
              </p>
            )}
            {geocode.status === "error" && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                {t("addressLookupError")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("latitude")}
              </label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, latitude: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("longitude")}
              </label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, longitude: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseLocation}
            disabled={geo.loading}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <MapPin className="h-4 w-4" />
            {geo.loading ? tc("loading") : t("useCurrentLocation")}
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
              disabled={isLoading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? tc("loading") : tc("save")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/sites")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-500">{t("clickMapToPlace")}</p>
          <SiteMap
            center={mapCenter}
            focusOn={focusOn}
            onMapClick={handleMapClick}
            showClickMarker={clickMarker}
            height="400px"
          />
        </div>
      </div>
    </form>
  );
}
