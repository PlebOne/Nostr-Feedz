import { createTRPCRouter } from '@/server/api/trpc'
import { feedRouter } from '@/server/api/routers/feed'
import { guideRouter } from '@/server/api/routers/guide'
import { subscriptionRouter } from '@/server/api/routers/subscription'

export const appRouter = createTRPCRouter({
  feed: feedRouter,
  guide: guideRouter,
  subscription: subscriptionRouter,
})

export type AppRouter = typeof appRouter