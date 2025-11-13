'use client'

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useNostrAuth } from "@/contexts/NostrAuthContext";

export default function SubmitToGuidePage() {
  const { isConnected } = useNostrAuth();
  const [npub, setNpub] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const submitMutation = api.guide.submitFeed.useMutation();

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag) && tags.length < 10) {
      setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!npub.trim() || !npub.startsWith('npub1')) {
      setError('Please enter a valid Nostr npub.');
      return;
    }

    if (tags.length === 0) {
      setError('Please add at least one tag to categorize this feed.');
      return;
    }

    try {
      await submitMutation.mutateAsync({ npub, tags });
      setSuccess(true);
      setNpub('');
      setTags([]);
      
      // Redirect to guide after 2 seconds
      setTimeout(() => {
        router.push('/guide');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feed to the guide.');
    }
  };

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 p-4 md:p-8">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-4 text-center">Submit to Guide</h1>
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You need to be signed in to submit a feed to the guide.
            </p>
            <Link href="/reader" className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 p-4 md:p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-4 text-center">Submit Feed to Guide</h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
          Add a Nostr user with long-form content to the public guide directory
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="npub" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nostr Public Key (npub) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="npub"
              name="npub"
              value={npub}
              onChange={(e) => setNpub(e.target.value)}
              placeholder="npub1..."
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitMutation.isPending}
            />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              This user must have published long-form content (NIP-23).
            </p>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags <span className="text-red-500">*</span> (1-10 tags)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="tags"
                name="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g., bitcoin, philosophy, technology"
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitMutation.isPending || tags.length >= 10}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                disabled={submitMutation.isPending || tags.length >= 10 || !tagInput.trim()}
              >
                Add
              </button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                      disabled={submitMutation.isPending}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Add relevant topic tags to help people discover this feed.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-800 dark:text-red-200">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md text-green-800 dark:text-green-200">
              <p>Feed successfully submitted to the guide! Redirecting...</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending || tags.length === 0}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-800 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit to Guide'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/guide" className="text-blue-600 hover:underline dark:text-blue-400">
            &larr; Back to Guide
          </Link>
        </div>
      </div>
    </main>
  );
}
