import NextAuth, { type DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/db"

const authSecret = process.env.AUTH_SECRET

if (!authSecret && process.env.NODE_ENV !== "test") {
  throw new Error("AUTH_SECRET is required")
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      isAdmin: boolean
      title: string
      firstName: string
      lastName: string
    } & DefaultSession["user"]
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          title: user.title,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      }
    })
  ],
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
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.title = token.title as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt"
  }
})
