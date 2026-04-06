"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SiteForm } from "@/components/forms/site-form";
import { ArrowLeft } from "lucide-react";

export default function NewSitePage() {
  const t = useTranslations("sites");
  const tc = useTranslations("common");

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
        <h1 className="text-2xl font-bold text-gray-900">{t("addSite")}</h1>
      </div>
      <SiteForm />
    </div>
  );
}
