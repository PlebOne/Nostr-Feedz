'use client'

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useNostrAuth } from "@/contexts/NostrAuthContext";

export default function GuidePage() {
  const { isConnected } = useNostrAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<'newest' | 'popular' | 'recent_posts'>('popular');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const router = useRouter();

  // Fetch guide feeds with filters
  const { data: guideFeeds, isLoading: feedsLoading } = api.guide.getGuideFeeds.useQuery({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    orderBy,
    limit: 50,
  });

  // Fetch all available tags
  const { data: availableTags } = api.guide.getGuideTags.useQuery();

  const subscribeMutation = api.feed.subscribeFeed.useMutation();
  const incrementSubscriberMutation = api.guide.incrementSubscriberCount.useMutation();

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCopyRssUrl = (npub: string, tags: string[]) => {
    const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
    const url = `${window.location.origin}/api/nostr-rss?npub=${encodeURIComponent(npub)}${tagsParam}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(npub);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  };

  const handleSubscribe = async (npub: string, displayName: string, tags: string[]) => {
    if (!isConnected) {
      router.push('/reader');
      return;
    }

    try {
      await subscribeMutation.mutateAsync({ 
        type: 'NOSTR', 
        npub,
        title: displayName,
        tags: tags, // Pass the tags from the guide feed
      });
      
      // Increment subscriber count in guide
      await incrementSubscriberMutation.mutateAsync({ npub });
      
      router.push('/reader');
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Nostr Feedz Guide</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Discover long-form content creators on Nostr
              </p>
            </div>
            <Link 
              href="/guide/submit"
              className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-blue-700 text-center"
            >
              Submit a Feed
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-3">Filter by Tags</h2>
            {availableTags && availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {tag} ({count})
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">No tags available yet</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="orderBy" className="text-sm font-medium">
              Sort by:
            </label>
            <select
              id="orderBy"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="popular">Most Popular</option>
              <option value="recent_posts">Recently Posted</option>
              <option value="newest">Newest Feeds</option>
            </select>
          </div>
        </div>

        {/* Feeds List */}
        <div className="space-y-4">
          {feedsLoading ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading feeds...</p>
            </div>
          ) : guideFeeds && guideFeeds.length > 0 ? (
            guideFeeds.map((feed: any) => (
              <div
                key={feed.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Profile Picture */}
                  {feed.picture && (
                    <div className="flex-shrink-0">
                      <img
                        src={feed.picture}
                        alt={feed.displayName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    </div>
                  )}

                  {/* Feed Info */}
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold mb-1">{feed.displayName}</h3>
                    {feed.about && (
                      <p className="text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                        {feed.about}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
                      <span>{feed.postCount} posts</span>
                      <span>{feed.subscriberCount} subscribers</span>
                      {feed.lastPublishedAt && (
                        <span>
                          Last post: {new Date(feed.lastPublishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {feed.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {feed.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCopyRssUrl(feed.npub, feed.tags)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
                      >
                        {copySuccess === feed.npub ? 'Copied!' : 'Copy RSS URL'}
                      </button>
                      <button
                        onClick={() => handleSubscribe(feed.npub, feed.displayName, feed.tags)}
                        disabled={subscribeMutation.isPending}
                        className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        {subscribeMutation.isPending ? 'Subscribing...' : 'Subscribe in App'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {selectedTags.length > 0
                  ? 'No feeds found with the selected tags.'
                  : 'No feeds in the guide yet. Be the first to submit one!'}
              </p>
              <Link
                href="/guide/submit"
                className="inline-block bg-blue-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-blue-700"
              >
                Submit a Feed
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
