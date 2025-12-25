import { StrictMode, useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Feed, FeedItem, ExtensionSettings, ThemeMode } from './types';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ItemSkeleton } from './components/Skeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VirtualList } from './components/VirtualList';

const DEFAULT_WEB_APP_URL = 'https://nostrfeedz.com';

interface RecentItem extends FeedItem {
  feedId: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function ItemRow({
  item,
  isSelected,
  onOpen,
  onMarkRead
}: {
  item: RecentItem;
  isSelected: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const typeIcon = item.feedType === 'RSS' ? '📰' : item.feedType === 'NOSTR_VIDEO' ? '🎬' : '📝';

  return (
    <div
      className={`item-row ${isSelected ? 'selected' : ''} ${item.isRead ? 'read' : ''}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
        if (e.key === 'm' || e.key === 'M') onMarkRead();
      }}
    >
      <span className="item-icon">{typeIcon}</span>
      <div className="item-content">
        <div className="item-title">{item.title}</div>
        <div className="item-meta">
          <span className="item-feed">{item.feedTitle}</span>
          <span className="item-time">{formatTimeAgo(item.publishedAt)}</span>
        </div>
      </div>
      {!item.isRead && (
        <span
          className="unread-dot"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead();
          }}
          title="Mark as read"
        />
      )}
    </div>
  );
}

function App() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState(DEFAULT_WEB_APP_URL);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [view, setView] = useState<'items' | 'feeds'>('items');
  const [expandedFeeds, setExpandedFeeds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFeedExpanded = (feedId: string) => {
    setExpandedFeeds(prev => {
      const next = new Set(prev);
      if (next.has(feedId)) {
        next.delete(feedId);
      } else {
        next.add(feedId);
      }
      return next;
    });
  };

  const getItemsForFeed = (feedTitle: string) => {
    return recentItems.filter(item => item.feedTitle === feedTitle);
  };

  const applyTheme = useCallback((themeMode: ThemeMode) => {
    let isDark = false;
    if (themeMode === 'dark') {
      isDark = true;
    } else if (themeMode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const loadData = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['feeds', 'settings', 'authToken', 'nostrAuth', 'recentItems']);
      const feeds = (result['feeds'] as Feed[] | undefined) ?? [];
      const settings = result['settings'] as ExtensionSettings | undefined;
      const authToken = result['authToken'] as string | undefined;
      const nostrAuth = result['nostrAuth'] as { pubkey?: string } | undefined;
      const items = (result['recentItems'] as RecentItem[] | undefined) ?? [];

      setFeeds(feeds);
      setRecentItems(items);
      setWebAppUrl(settings?.webAppUrl ?? DEFAULT_WEB_APP_URL);
      setIsAuthenticated(!!authToken || !!nostrAuth?.pubkey);
      setLastSync(settings?.lastSyncTime ?? null);
      setTheme(settings?.theme ?? 'system');
      setShowUnreadOnly(settings?.showUnreadOnly ?? false);
      applyTheme(settings?.theme ?? 'system');
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    chrome.storage.local.get(['authToken', 'nostrAuth']).then((result) => {
      const hasAuth = !!result['authToken'] || !!(result['nostrAuth'] as { pubkey?: string } | undefined)?.pubkey;
      if (hasAuth) {
        chrome.runtime.sendMessage({ type: 'REFRESH_FEEDS' }).then(() => loadData()).catch(() => {});
      }
    });
  }, [loadData]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const items = displayedItems;
      if (!items.length) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'o':
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            handleOpenItem(items[selectedIndex]!);
          }
          break;
        case 'm':
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            void handleMarkRead(items[selectedIndex]!.id);
          }
          break;
        case 'r':
          void handleRefresh();
          break;
        case 'u':
          handleToggleFilter();
          break;
        case 't':
          handleCycleTheme();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncError(false);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'REFRESH_FEEDS' });
      if (response?.error) {
        setSyncError(true);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to refresh:', err);
      setSyncError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenApp = () => {
    const readerUrl = webAppUrl.replace(/\/$/, '') + '/reader';
    void chrome.tabs.create({ url: readerUrl });
  };

  const handleOpenItem = (item: RecentItem) => {
    const url = item.originalUrl || item.url;
    if (url) {
      void chrome.tabs.create({ url });
      void handleMarkRead(item.id);
    }
  };

  const handleMarkRead = async (itemId: string) => {
    try {
      const item = recentItems.find((i) => i.id === itemId);
      const wasUnread = item && !item.isRead;

      await chrome.runtime.sendMessage({ type: 'MARK_ITEM_READ', itemId });

      setRecentItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isRead: true } : i))
      );

      if (wasUnread && item?.feedTitle) {
        setFeeds((prev) =>
          prev.map((feed) =>
            feed.title === item.feedTitle && feed.unreadCount > 0
              ? { ...feed, unreadCount: feed.unreadCount - 1 }
              : feed
          )
        );
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleToggleFilter = async () => {
    const newValue = !showUnreadOnly;
    setShowUnreadOnly(newValue);
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = (result['settings'] as ExtensionSettings | undefined) ?? {} as ExtensionSettings;
      await chrome.storage.local.set({ settings: { ...settings, showUnreadOnly: newValue } });
    } catch (err) {
      console.error('Failed to save filter:', err);
    }
  };

  const handleCycleTheme = async () => {
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const newTheme = themes[(currentIndex + 1) % themes.length]!;
    setTheme(newTheme);
    applyTheme(newTheme);
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = (result['settings'] as ExtensionSettings | undefined) ?? {} as ExtensionSettings;
      await chrome.storage.local.set({ settings: { ...settings, theme: newTheme } });
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  };

  const totalUnread = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0);
  const displayedItems = showUnreadOnly
    ? recentItems.filter(item => !item.isRead)
    : recentItems;

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

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️';

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <h1>Nostr Feedz</h1>
        </header>
        <div className="content-area">
          <ItemSkeleton />
          <ItemSkeleton />
          <ItemSkeleton />
          <ItemSkeleton />
          <ItemSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="container" ref={containerRef}>
      <header className="header">
        <h1>Nostr Feedz</h1>
        {totalUnread > 0 && <span className="badge total-badge">{totalUnread}</span>}
        <div className="header-actions">
          <ConnectionStatus isSyncing={refreshing} hasError={syncError} />
          <button
            className="icon-btn"
            onClick={handleCycleTheme}
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}`}
          >
            {themeIcon}
          </button>
        </div>
      </header>

      {!isAuthenticated && (
        <div className="auth-notice">
          <p>Sign in to sync your feeds</p>
        </div>
      )}

      <div className="toolbar">
        <div className="view-tabs">
          <button
            className={`tab ${view === 'items' ? 'active' : ''}`}
            onClick={() => setView('items')}
          >
            Recent
          </button>
          <button
            className={`tab ${view === 'feeds' ? 'active' : ''}`}
            onClick={() => setView('feeds')}
          >
            Feeds
          </button>
        </div>
        <button
          className={`filter-btn ${showUnreadOnly ? 'active' : ''}`}
          onClick={handleToggleFilter}
          title="Toggle unread only (u)"
        >
          {showUnreadOnly ? '●' : '○'} Unread
        </button>
      </div>

      <div className="content-area">
        {!isAuthenticated ? (
          <div className="empty-state">
            <p>Not signed in</p>
            <p className="hint">Open the app to sign in with Nostr</p>
          </div>
        ) : view === 'items' ? (
          displayedItems.length === 0 ? (
            <div className="empty-state">
              <p>{showUnreadOnly ? 'All caught up!' : 'No recent items'}</p>
              <p className="hint">New items will appear here</p>
            </div>
          ) : displayedItems.length > 20 ? (
            <VirtualList
              items={displayedItems}
              itemHeight={58}
              containerHeight={280}
              className="item-list"
              renderItem={(item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIndex === index}
                  onOpen={() => handleOpenItem(item)}
                  onMarkRead={() => void handleMarkRead(item.id)}
                />
              )}
            />
          ) : (
            <div className="item-list">
              {displayedItems.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIndex === index}
                  onOpen={() => handleOpenItem(item)}
                  onMarkRead={() => void handleMarkRead(item.id)}
                />
              ))}
            </div>
          )
        ) : (
          feeds.length === 0 ? (
            <div className="empty-state">
              <p>No feeds subscribed</p>
              <p className="hint">Open the app to add feeds</p>
            </div>
          ) : (
            <div className="feed-list">
              {feeds.map((feed) => {
                const isExpanded = expandedFeeds.has(feed.id);
                const feedItems = getItemsForFeed(feed.title);
                const displayItems = showUnreadOnly
                  ? feedItems.filter(item => !item.isRead)
                  : feedItems;
                return (
                  <div key={feed.id} className="feed-folder">
                    <div
                      className={`feed-item ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleFeedExpanded(feed.id)}
                    >
                      <span className="feed-chevron">{isExpanded ? '▼' : '▶'}</span>
                      <span className="feed-type">
                        {feed.type === 'RSS' ? '📰' : feed.type === 'NOSTR_VIDEO' ? '🎬' : '📝'}
                      </span>
                      <span className="feed-title">{feed.title}</span>
                      {feed.unreadCount > 0 && (
                        <span className="badge">{feed.unreadCount}</span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="feed-items">
                        {displayItems.length === 0 ? (
                          <div className="feed-items-empty">No items</div>
                        ) : (
                          displayItems.slice(0, 10).map(item => (
                            <div
                              key={item.id}
                              className={`feed-subitem ${item.isRead ? 'read' : ''}`}
                              onClick={() => handleOpenItem(item)}
                            >
                              <span className="subitem-title">{item.title}</span>
                              <span className="subitem-time">{formatTimeAgo(item.publishedAt)}</span>
                              {!item.isRead && (
                                <span
                                  className="unread-dot"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkRead(item.id);
                                  }}
                                  title="Mark as read"
                                />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <div className="actions">
        <button
          className="btn btn-secondary"
          onClick={() => void handleRefresh()}
          disabled={refreshing || !isAuthenticated}
        >
          {refreshing ? 'Syncing...' : 'Sync'}
        </button>
        <button className="btn btn-primary" onClick={handleOpenApp}>
          Open App
        </button>
      </div>

      {isAuthenticated && (
        <footer className="footer">
          <span className="sync-status">Synced: {formatLastSync(lastSync)}</span>
          <span className="shortcuts-hint">j/k nav · o open · m read</span>
        </footer>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
