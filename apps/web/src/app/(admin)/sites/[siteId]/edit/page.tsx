"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { SiteForm } from "@/components/forms/site-form";
import { ArrowLeft } from "lucide-react";

export default function EditSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const t = useTranslations("sites");
  const tc = useTranslations("common");

  const { data: site, isLoading } = trpc.site.getById.useQuery({ id: siteId });

  if (isLoading) return <p className="text-gray-500">{tc("loading")}</p>;
  if (!site) return <p className="text-gray-500">{tc("noResults")}</p>;

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
        <h1 className="text-2xl font-bold text-gray-900">{t("editSite")}</h1>
      </div>
      <SiteForm
        initialData={{
          id: site.id,
          customerId: site.customerId,
          name: site.name,
          address: site.address ?? "",
          latitude: site.latitude,
          longitude: site.longitude,
          notes: site.notes,
        }}
      />
    </div>
  );
}
