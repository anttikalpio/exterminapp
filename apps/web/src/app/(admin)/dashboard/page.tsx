"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Users, UserCog, MapPin, Crosshair } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const cards = [
    {
      label: t("totalCustomers"),
      value: stats?.customers ?? 0,
      icon: Users,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: t("totalEmployees"),
      value: stats?.employees ?? 0,
      icon: UserCog,
      color: "text-green-600 bg-green-50",
    },
    {
      label: t("totalSites"),
      value: stats?.sites ?? 0,
      icon: MapPin,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: t("totalTraps"),
      value: stats?.traps ?? 0,
      icon: Crosshair,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-3 ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
