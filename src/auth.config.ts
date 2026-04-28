import type { NextAuthConfig } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      isAdmin: boolean
      title: string
      firstName: string
      lastName: string
    } & import("next-auth").DefaultSession["user"]
  }

  interface User {
    id: string
    role: string
    isAdmin: boolean
    title: string
    firstName: string
    lastName: string
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: string
    isAdmin?: boolean
    title?: string
    firstName?: string
    lastName?: string
  }
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.isAdmin = user.isAdmin
        token.title = user.title
        token.firstName = user.firstName
        token.lastName = user.lastName
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = typeof token.id === "string" ? token.id : ""
        session.user.role = typeof token.role === "string" ? token.role : "FACULTY"
        session.user.isAdmin = typeof token.isAdmin === "boolean" ? token.isAdmin : false
        session.user.title = typeof token.title === "string" ? token.title : "Dr."
        session.user.firstName = typeof token.firstName === "string" ? token.firstName : ""
        session.user.lastName = typeof token.lastName === "string" ? token.lastName : ""
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}
