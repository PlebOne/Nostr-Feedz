# Bidirectional Automatic Sync

## Overview

Nostr Feedz now features **fully automatic bidirectional sync** - your subscriptions, categories, and tags sync seamlessly across all your devices without any manual intervention.

## How It Works

### 🔄 Two-Way Sync

**Upload (This Device → Nostr Relays)**
- ✅ Happens **automatically** after every change
- ✅ Triggers: Add feed, remove feed, update tags, change category
- ✅ Timing: 500ms after the change
- ✅ Includes deleted feeds for proper sync

**Download (Nostr Relays → This Device)**
- ✅ Happens **automatically** every 15 minutes
- ✅ Triggers: On page load, when fetching feeds
- ✅ Creates categories if they don't exist
- ✅ Only pulls if >15 minutes since last sync

### 📱 User Experience

**From the User's Perspective:**

1. **On Device A:** Add a feed to "Technology" category
   - Feed is added immediately
   - 500ms later: Automatically syncs to Nostr (silent, background)

2. **On Device B:** Open the app (or wait up to 15 minutes)
   - Automatically detects new feed from Nostr
   - Creates "Technology" category if it doesn't exist
   - Adds the feed with proper category assignment
   - All happens seamlessly, no prompts or buttons

3. **Back on Device A:** Remove a feed
   - Feed disappears immediately
   - 500ms later: Deletion syncs to Nostr

4. **On Device B:** Next refresh (within 15 minutes)
   - Feed automatically removed
   - Deleted feed tracked in sync to prevent re-adding

### 🎯 What Gets Synced

**Automatically synced on every change:**
- RSS feed URLs
- Nostr npub subscriptions
- Feed tags (multiple tags per feed)
- Feed categories (name, color, icon)
- Deleted feeds (to properly sync removals)

**Preserved properties:**
- Category colors
- Category icons
- Tag associations
- Subscription metadata

### 🔒 Requirements

**For Auto-Export (Upload):**
- ✅ Nostr browser extension installed (Alby, nos2x, etc.)
- ✅ Signed in with Nostr
- ✅ Extension must be available (`window.nostr`)

**For Auto-Import (Download):**
- ✅ Signed in with Nostr (any method)
- ✅ Access to Nostr relays

**If requirements not met:**
- Export: Silently skips (no error shown to user)
- Import: Still works via server-side fetch

## Technical Details

### Architecture

```
User Action (Add/Remove/Edit)
    ↓
Local Mutation (tRPC)
    ↓
UI Updates Immediately
    ↓
500ms delay
    ↓
autoExportToNostr()
    ↓
Fetch ALL subscriptions (including deleted)
    ↓
Build subscription list with categories
    ↓
Sign with Nostr extension
    ↓
Publish to relays (Kind 30404)
    ↓
Done (silent success/failure)
```

### Mutations That Trigger Auto-Export

1. **subscribeFeedMutation** - Adding a new feed
2. **unsubscribeFeedMutation** - Removing a feed (soft delete)
3. **updateTagsMutation** - Changing feed tags
4. **updateCategoryMutation** - Moving feed to different category

### Auto-Import Triggers

1. **getFeeds query** - On every feed list fetch
2. **Interval check** - Max once per 15 minutes
3. **Manual sync** - Settings > Sync > Import

### Data Flow

**Kind 30404 Event Structure:**
```json
{
  "kind": 30404,
  "created_at": 1738095789,
  "tags": [
    ["d", "nostr-feedz-subscriptions"],
    ["client", "nostr-feedz"]
  ],
  "content": {
    "rss": ["https://example.com/feed.xml"],
    "nostr": ["npub1abc..."],
    "tags": {
      "https://example.com/feed.xml": ["tech", "news"]
    },
    "categories": {
      "https://example.com/feed.xml": {
        "name": "Technology",
        "color": "#3b82f6",
        "icon": "💻"
      }
    },
    "deleted": ["https://old-feed.com/rss"],
    "lastUpdated": 1738095789
  }
}
```

## Performance & Throttling

### Upload Throttling
- **500ms delay** after mutation completes
- Allows UI to settle before network request
- Prevents rapid-fire uploads during bulk operations

### Download Throttling
- **15-minute cooldown** between auto-imports
- Prevents excessive relay queries
- Balances freshness with resource usage

### Error Handling
- **Silent failures** on export (logged to console)
- User never sees error modals for background sync
- Manual sync option available if auto-sync fails

### Resource Usage
- Export: ~1-2 KB per event
- Import: Single relay query every 15 minutes
- No polling or WebSocket connections
- Minimal battery/bandwidth impact

## Migration from Manual Sync

### Before (Manual Only)
```
❌ User adds feed on Device A
❌ Feed stays local to Device A
❌ User must remember to click "Export to Nostr"
❌ User switches to Device B
❌ Must click "Import from Nostr"
❌ Feed finally appears on Device B
```

### After (Automatic)
```
✅ User adds feed on Device A
✅ Automatically syncs to Nostr (500ms later)
✅ User switches to Device B
✅ Feed appears automatically (within 15 minutes)
✅ Zero manual intervention required
```

## Debugging

### Check if Auto-Export is Working

Open browser console and look for:
```
🔄 Auto-exporting subscriptions to Nostr...
✅ Auto-export successful: <eventId>
```

### Check if Auto-Import is Working

Look for server logs during feed fetch:
```
🔍 Sync merge - Remote RSS URLs: [...]
🔍 Sync merge - Remote Nostr npubs: [...]
🔍 Sync result: X to add, Y to remove, Z local-only
```

### Common Issues

**Auto-export not triggering:**
- Check if `window.nostr` is available
- Verify user is signed in
- Check console for errors

**Auto-import not working:**
- Wait 15 minutes since last sync
- Check relay connectivity
- Verify subscription list exists on relays

**Categories not syncing:**
- Ensure both devices have category support
- Check that color/icon are being set
- Verify category names match exactly

## Future Enhancements

- [ ] Conflict resolution for simultaneous edits
- [ ] Sync status indicator in UI
- [ ] Configurable sync interval (user preference)
- [ ] Offline queue for failed uploads
- [ ] Selective sync (choose what to sync)
- [ ] Sync history/audit log
- [ ] Category sort order syncing
- [ ] Hierarchical categories
