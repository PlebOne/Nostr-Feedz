import { StrictMode, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { Feed, ExtensionSettings } from './types';

const DEFAULT_WEB_APP_URL = 'https://nostrfeedz.com';

function FeedItem({ feed }: { feed: Feed }) {
  const typeIcon = feed.type === 'RSS' ? '📰' : feed.type === 'NOSTR_VIDEO' ? '🎬' : '📝';
  return (
    <div className="feed-item">
      <div className="feed-info">
        <span className="feed-type">{typeIcon}</span>
        <span className="feed-title">{feed.title}</span>
        {feed.unreadCount > 0 && (
          <span className="badge">{feed.unreadCount}</span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState(DEFAULT_WEB_APP_URL);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['feeds', 'settings', 'authToken', 'nostrAuth']);
      const feeds = (result['feeds'] as Feed[] | undefined) ?? [];
      const settings = result['settings'] as ExtensionSettings | undefined;
      const authToken = result['authToken'] as string | undefined;
      const nostrAuth = result['nostrAuth'] as { pubkey?: string } | undefined;

      setFeeds(feeds);
      setWebAppUrl(settings?.webAppUrl ?? DEFAULT_WEB_APP_URL);
      setIsAuthenticated(!!authToken || !!nostrAuth?.pubkey);
      setLastSync(settings?.lastSyncTime ?? null);
    } catch (err) {
      console.error('Failed to load feeds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_FEEDS' });
      await loadFeeds();
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenApp = () => {
    const readerUrl = webAppUrl.replace(/\/$/, '') + '/reader';
    void chrome.tabs.create({ url: readerUrl });
  };

  const totalUnread = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0);

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="container"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Nostr Feedz</h1>
        {totalUnread > 0 && <span className="badge total-badge">{totalUnread}</span>}
      </header>

      {!isAuthenticated && (
        <div className="auth-notice">
          <p>Sign in to sync your feeds</p>
        </div>
      )}

      <div className="actions">
        <button
          className="btn btn-secondary"
          onClick={() => void handleRefresh()}
          disabled={refreshing || !isAuthenticated}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary" onClick={handleOpenApp}>
          Open App
        </button>
      </div>

      <div className="feed-list">
        {!isAuthenticated ? (
          <div className="empty-state">
            <p>Not signed in</p>
            <p className="hint">Open the app to sign in with Nostr</p>
          </div>
        ) : feeds.length === 0 ? (
          <div className="empty-state">
            <p>No feeds subscribed</p>
            <p className="hint">Open the app to add feeds</p>
          </div>
        ) : (
          feeds.map((feed) => <FeedItem key={feed.id} feed={feed} />)
        )}
      </div>

      {isAuthenticated && (
        <footer className="footer">
          <span className="sync-status">Last sync: {formatLastSync(lastSync)}</span>
        </footer>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
