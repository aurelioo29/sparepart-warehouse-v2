import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    roleId: string;
    roleName: string;
    roleSlug: string;
    permissions: string[];
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roleId: string;
      roleName: string;
      roleSlug: string;
      permissions: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roleId: string;
    roleName: string;
    roleSlug: string;
    permissions: string[];
  }
}
