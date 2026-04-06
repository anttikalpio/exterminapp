"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Upload, Trash2, Building2 } from "lucide-react";
import Image from "next/image";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: company, isLoading, refetch } =
    trpc.settings.getCompany.useQuery();

  const [form, setForm] = useState({
    companyName: "",
    address: "",
    vatNumber: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [formLoaded, setFormLoaded] = useState(false);

  // Populate form when data loads
  if (company && !formLoaded) {
    setForm({
      companyName: company.companyName ?? "",
      address: company.address ?? "",
      vatNumber: company.vatNumber ?? "",
      contactEmail: company.contactEmail ?? "",
      contactPhone: company.contactPhone ?? "",
    });
    setFormLoaded(true);
  }

  const updateMutation = trpc.settings.updateCompany.useMutation({
    onSuccess: () => {
      setSuccessMsg(t("saved"));
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const setLogoMutation = trpc.settings.setLogoPath.useMutation({
    onSuccess: () => {
      refetch();
      setSuccessMsg(t("logoUploaded"));
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const removeLogoMutation = trpc.settings.removeLogo.useMutation({
    onSuccess: () => {
      refetch();
      setSuccessMsg(t("logoRemoved"));
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      const { logoPath } = await res.json();
      setLogoMutation.mutate({ logoPath });
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("title")}</h1>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Logo Section */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">{t("logo")}</h2>

        <div className="flex items-start gap-6">
          <div className="flex h-24 w-48 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {company?.logoPath ? (
              <Image
                src={company.logoPath}
                alt="Company logo"
                width={192}
                height={96}
                className="h-full w-full object-contain p-2"
                unoptimized
              />
            ) : (
              <Building2 className="h-10 w-10 text-gray-300" />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading ? tc("loading") : t("uploadLogo")}
              </button>
              <p className="mt-1 text-xs text-gray-500">{t("logoHelp")}</p>
            </div>

            {company?.logoPath && (
              <button
                type="button"
                onClick={() => removeLogoMutation.mutate()}
                className="flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("removeLogo")}
              </button>
            )}

            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Company Details Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          {t("companyDetails")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {updateMutation.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {updateMutation.error.message}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("companyName")}
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("address")}
            </label>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("vatNumber")}
            </label>
            <input
              type="text"
              value={form.vatNumber}
              onChange={(e) => updateField("vatNumber", e.target.value)}
              placeholder="FI12345678"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? tc("loading") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
