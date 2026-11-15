import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Prisma } from "../prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const username = String(credentials?.username || "")
          .trim()
          .toLowerCase();

        const password = String(credentials?.password || "");

        if (!username || !password) {
          await prisma.activityLog.create({
            data: {
              userId: null,
              action: "LOGIN",
              module: "auth",
              resourceType: "users",
              resourceId: null,
              oldData: Prisma.JsonNull,
              newData: {
                username,
                status: "FAILED",
                reason: "Username atau password kosong",
              },
            },
          });

          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            username,
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
          },
        });

        if (!user) {
          await prisma.activityLog.create({
            data: {
              userId: null,
              action: "LOGIN",
              module: "auth",
              resourceType: "users",
              resourceId: null,
              oldData: Prisma.JsonNull,
              newData: {
                username,
                status: "FAILED",
                reason: "User tidak ditemukan",
              },
            },
          });

          return null;
        }

        if (!user.isActive) {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: "LOGIN",
              module: "auth",
              resourceType: "users",
              resourceId: user.id,
              oldData: Prisma.JsonNull,
              newData: {
                username,
                status: "FAILED",
                reason: "User tidak aktif",
              },
            },
          });

          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: "LOGIN",
              module: "auth",
              resourceType: "users",
              resourceId: user.id,
              oldData: Prisma.JsonNull,
              newData: {
                username,
                status: "FAILED",
                reason: "Password salah",
              },
            },
          });

          return null;
        }

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            lastLoginAt: new Date(),
          },
        });

        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            module: "auth",
            resourceType: "users",
            resourceId: user.id,
            oldData: Prisma.JsonNull,
            newData: {
              username,
              status: "SUCCESS",
              role: user.role.slug,
            },
          },
        });

        const permissions = user.role.rolePermissions.map(
          (item) => item.permission.key,
        );

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          roleId: user.roleId,
          roleName: user.role.name,
          roleSlug: user.role.slug,
          permissions,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = String(user.id);
        token.roleId = String(user.roleId || "");
        token.roleName = String(user.roleName || "");
        token.roleSlug = String(user.roleSlug || "");
        token.permissions = Array.isArray(user.permissions)
          ? user.permissions
          : [];
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.roleSlug = token.roleSlug as string;
        session.user.permissions = token.permissions as string[];
      }

      return session;
    },
  },
});
