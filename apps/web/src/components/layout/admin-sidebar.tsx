"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Users,
  UserCog,
  MapPin,
  Briefcase,
  FileText,
  Settings,
  LogOut,
  Bug,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/customers", icon: Users, labelKey: "customers" },
  { href: "/employees", icon: UserCog, labelKey: "employees" },
  { href: "/sites", icon: MapPin, labelKey: "sites" },
  { href: "/work-orders", icon: Briefcase, labelKey: "workOrders" },
  { href: "/reports", icon: FileText, labelKey: "reports" },
  { href: "/settings", icon: Settings, labelKey: "settings" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: branding } = trpc.settings.getLogo.useQuery();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-center border-b border-gray-200 px-4 py-4">
        {branding?.logoPath ? (
          <Image
            src={branding.logoPath}
            alt={branding.companyName ?? "Company logo"}
            width={200}
            height={48}
            className="max-h-12 w-auto object-contain"
            unoptimized
          />
        ) : (
          <div className="flex items-center gap-2">
            <Bug className="h-6 w-6 text-green-600" />
            <span className="text-lg font-bold text-gray-900">
              {branding?.companyName || "ExterminApp"}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-3 py-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-5 w-5" />
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
