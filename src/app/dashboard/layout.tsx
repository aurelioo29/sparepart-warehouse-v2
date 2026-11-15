import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DashboardLayout from "@/components/dashboard/dashboard-layout";

type DashboardRootLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardRootLayout({
  children,
}: DashboardRootLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.email) {
    redirect("/login");
  }

  /**
   * Ambil user beserta Role + Permissions
   * langsung dari database.
   */
  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },

    select: {
      id: true,
      fullName: true,
      isActive: true,

      role: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,

          rolePermissions: {
            select: {
              permission: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      },
    },
  });

  /**
   * User tidak ditemukan / sudah dinonaktifkan.
   */
  if (!currentUser || !currentUser.isActive) {
    redirect("/login");
  }

  /**
   * User tidak punya role atau role sudah dinonaktifkan.
   */
  if (!currentUser.role || !currentUser.role.isActive) {
    redirect("/login");
  }

  /**
   * Convert:
   *
   * RolePermission[]
   *
   * menjadi:
   *
   * [
   *   "dashboard.view",
   *   "customers.view",
   *   "sales.view",
   * ]
   */
  const permissions = currentUser.role.rolePermissions.map(
    (rolePermission) => rolePermission.permission.key,
  );

  return (
    <DashboardLayout
      userName={currentUser.fullName}
      roleName={currentUser.role.name}
      permissions={permissions}
    >
      {children}
    </DashboardLayout>
  );
}
