import { redirect } from "next/navigation";
import { auth, type Role } from "@/lib/auth";

export async function TechnicalOnlyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as { role?: Role } | undefined;

  if (!user) redirect("/login");
  if (user.role !== "ADMIN_MASTER") redirect("/");

  return <>{children}</>;
}
