import { createTRPCRouter } from '@/server/api/trpc'
import { feedRouter } from '@/server/api/routers/feed'
import { guideRouter } from '@/server/api/routers/guide'
import { subscriptionRouter } from '@/server/api/routers/subscription'
import { adminRouter } from '@/server/api/routers/admin'

export const appRouter = createTRPCRouter({
  feed: feedRouter,
  guide: guideRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter