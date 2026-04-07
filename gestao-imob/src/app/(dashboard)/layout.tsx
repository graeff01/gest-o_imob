import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth, type Role } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { name?: string | null; role?: Role };
  const userName = user.name || "Usuário";
  const role: Role = user.role || "DONO";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={userName} role={role} />
      <div className="lg:pl-64">
        <Header />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
