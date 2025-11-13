import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/api/trpc'

const TRIAL_DAYS = 7
const MONTHLY_PRICE = 1.50

export const subscriptionRouter = createTRPCRouter({
  // Get current user's subscription status
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      let subscription = await ctx.db.userSubscription.findUnique({
        where: { userPubkey: ctx.nostrPubkey },
      })

      // If no subscription exists, create a trial
      if (!subscription) {
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

        subscription = await ctx.db.userSubscription.create({
          data: {
            userPubkey: ctx.nostrPubkey,
            status: 'TRIAL',
            trialEndsAt,
          },
        })
      }

      // Check if trial has expired
      if (subscription.status === 'TRIAL' && new Date() > subscription.trialEndsAt) {
        subscription = await ctx.db.userSubscription.update({
          where: { userPubkey: ctx.nostrPubkey },
          data: { status: 'EXPIRED' },
        })
      }

      // Check if paid subscription has expired
      if (
        subscription.status === 'ACTIVE' && 
        subscription.subscriptionEndsAt && 
        new Date() > subscription.subscriptionEndsAt
      ) {
        subscription = await ctx.db.userSubscription.update({
          where: { userPubkey: ctx.nostrPubkey },
          data: { status: 'EXPIRED' },
        })
      }

      // Calculate days remaining
      let daysRemaining = 0
      if (subscription.status === 'TRIAL') {
        daysRemaining = Math.max(0, Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ))
      } else if (subscription.subscriptionEndsAt) {
        daysRemaining = Math.max(0, Math.ceil(
          (subscription.subscriptionEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ))
      }

      return {
        ...subscription,
        daysRemaining,
        hasAccess: subscription.status === 'TRIAL' || subscription.status === 'ACTIVE',
        price: MONTHLY_PRICE,
      }
    }),

  // Create Square checkout session
  createCheckoutSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      // TODO: Implement Square checkout
      // This will create a Square payment link for the subscription
      const squareCheckoutUrl = process.env.SQUARE_CHECKOUT_URL || '#'
      
      return {
        checkoutUrl: squareCheckoutUrl,
      }
    }),

  // Webhook to handle Square payment events
  // This should be called by Square webhooks
  handleSquareWebhook: publicProcedure
    .input(z.object({
      eventType: z.string(),
      data: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement Square webhook handling
      // Handle payment.created, subscription.created, subscription.cancelled, etc.
      
      return { success: true }
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      const subscription = await ctx.db.userSubscription.findUnique({
        where: { userPubkey: ctx.nostrPubkey },
      })

      if (!subscription || subscription.status !== 'ACTIVE') {
        throw new Error('No active subscription to cancel')
      }

      // TODO: Cancel in Square
      
      await ctx.db.userSubscription.update({
        where: { userPubkey: ctx.nostrPubkey },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })

      return { success: true }
    }),
})
