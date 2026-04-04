import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: reativar auth() quando o banco estiver conectado
  // const session = await auth();
  // if (!session?.user) redirect("/login");
  const userName = "Administrador";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={userName} />
      <div className="lg:pl-64">
        <Header />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
