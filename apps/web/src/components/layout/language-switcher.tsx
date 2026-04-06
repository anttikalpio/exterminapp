"use client";

import { useTranslations } from "next-intl";

export function LanguageSwitcher() {
  const t = useTranslations("common");

  const switchLocale = (locale: string) => {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{t("language")}:</span>
      <button
        onClick={() => switchLocale("en")}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => switchLocale("fi")}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        FI
      </button>
    </div>
  );
}
