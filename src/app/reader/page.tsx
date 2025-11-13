'use client'

import { AuthGuard } from '@/components/auth-guard'
import { SubscriptionGate } from '@/components/subscription-gate'
import { FeedReader } from '@/components/feed-reader'

export default function ReaderPage() {
  return (
    <AuthGuard>
      <SubscriptionGate>
        <FeedReader />
      </SubscriptionGate>
    </AuthGuard>
  )
}