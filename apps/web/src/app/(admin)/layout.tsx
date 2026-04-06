import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-sm text-gray-600">{session.user.name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
