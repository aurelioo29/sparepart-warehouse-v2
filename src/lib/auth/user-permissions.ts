import { prisma } from "@/lib/prisma";

export async function getUserPermissionKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      customPermissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!user) return [];

  const rolePermissionKeys = user.role.rolePermissions.map(
    (item) => item.permission.key,
  );

  const allowPermissionKeys = user.customPermissions
    .filter((item) => item.effect === "ALLOW")
    .map((item) => item.permission.key);

  const denyPermissionKeys = user.customPermissions
    .filter((item) => item.effect === "DENY")
    .map((item) => item.permission.key);

  const finalPermissions = new Set([
    ...rolePermissionKeys,
    ...allowPermissionKeys,
  ]);

  denyPermissionKeys.forEach((key) => {
    finalPermissions.delete(key);
  });

  return Array.from(finalPermissions);
}

export async function userHasPermission(userId: string, permissionKey: string) {
  const permissions = await getUserPermissionKeys(userId);

  return permissions.includes(permissionKey);
}
