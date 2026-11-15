import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type PermissionEffect = "ALLOW" | "DENY";

type AuthUserResult = {
  authorized: boolean;
  status: number;
  message: string;
  user: {
    id: string;
    name?: string | null;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
    roleId?: string | null;
    roleSlug?: string | null;
    permissions?: string[];
  } | null;
};

function calculateEffectivePermissions({
  rolePermissions,
  customPermissions,
}: {
  rolePermissions: string[];
  customPermissions: {
    key: string;
    effect: PermissionEffect;
  }[];
}) {
  const finalPermissions = new Set<string>(rolePermissions);

  for (const item of customPermissions) {
    if (item.effect === "ALLOW") {
      finalPermissions.add(item.key);
    }

    if (item.effect === "DENY") {
      finalPermissions.delete(item.key);
    }
  }

  return Array.from(finalPermissions);
}

export async function requireAuth(): Promise<AuthUserResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized",
      user: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      role: true,
    },
  });

  if (!user) {
    return {
      authorized: false,
      status: 401,
      message: "User tidak ditemukan",
      user: null,
    };
  }

  if (!user.isActive) {
    return {
      authorized: false,
      status: 403,
      message: "User tidak aktif",
      user: null,
    };
  }

  return {
    authorized: true,
    status: 200,
    message: "Authorized",
    user: {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleSlug: user.role?.slug || null,
      permissions: session.user.permissions || [],
    },
  };
}

export async function getEffectiveUserPermissions(userId: string) {
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

  if (!user) {
    return {
      user: null,
      permissions: [],
      isSuperadmin: false,
    };
  }

  const rolePermissionKeys = user.role.rolePermissions.map(
    (item) => item.permission.key,
  );

  const customPermissionItems = user.customPermissions.map((item) => ({
    key: item.permission.key,
    effect: item.effect as PermissionEffect,
  }));

  const effectivePermissions = calculateEffectivePermissions({
    rolePermissions: rolePermissionKeys,
    customPermissions: customPermissionItems,
  });

  const isSuperadmin = user.role.slug === "superadmin";

  return {
    user,
    permissions: effectivePermissions,
    isSuperadmin,
  };
}

export async function requirePermission(
  permission: string,
): Promise<AuthUserResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized",
      user: null,
    };
  }

  const { user, permissions, isSuperadmin } = await getEffectiveUserPermissions(
    session.user.id,
  );

  if (!user) {
    return {
      authorized: false,
      status: 401,
      message: "User tidak ditemukan",
      user: null,
    };
  }

  if (!user.isActive) {
    return {
      authorized: false,
      status: 403,
      message: "User tidak aktif",
      user: null,
    };
  }

  if (!isSuperadmin && !permissions.includes(permission)) {
    return {
      authorized: false,
      status: 403,
      message: "Forbidden",
      user: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        roleId: user.roleId,
        roleSlug: user.role.slug,
        permissions,
      },
    };
  }

  return {
    authorized: true,
    status: 200,
    message: "Authorized",
    user: {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleSlug: user.role.slug,
      permissions,
    },
  };
}
