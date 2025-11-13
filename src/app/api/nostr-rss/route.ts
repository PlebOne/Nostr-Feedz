import { NextRequest, NextResponse } from 'next/server';
import { SimplePool, nip19, Event, Filter } from 'nostr-tools';
import RSS from 'rss';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const npub = searchParams.get('npub');
  const tags = searchParams.get('tags')?.split(',').map(t => t.trim()).filter(Boolean);

  if (!npub || !npub.startsWith('npub1')) {
    return new NextResponse('Invalid or missing npub parameter.', { status: 400 });
  }

  let pubkey: string;
  try {
    const { type, data } = nip19.decode(npub);
    if (type !== 'npub') {
      return new NextResponse('Invalid npub.', { status: 400 });
    }
    pubkey = data as string;
  } catch (error) {
    return new NextResponse('Error decoding npub.', { status: 400 });
  }

  const pool = new SimplePool();
  const filter: Filter = {
    authors: [pubkey],
    kinds: [30023], // Long-form content
    limit: 20,
  };

  if (tags && tags.length > 0) {
    filter['#t'] = tags;
  }

  try {
    const events = await pool.querySync(DEFAULT_RELAYS, filter);

    if (!events || events.length === 0) {
      return new NextResponse('No long-form posts found for this user with the specified tags.', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Fetch user profile (kind 0) to get metadata
    const profileEvents = await pool.querySync(DEFAULT_RELAYS, {
      authors: [pubkey],
      kinds: [0],
      limit: 1,
    });

    let authorName = npub;
    let authorAbout = 'A Nostr user.';
    let authorPicture = '';
    if (profileEvents && profileEvents.length > 0) {
        try {
            const metadata = JSON.parse(profileEvents[0].content);
            authorName = metadata.displayName || metadata.name || authorName;
            authorAbout = metadata.about || authorAbout;
            authorPicture = metadata.picture || '';
        } catch (e) {
            console.error("Error parsing profile metadata:", e);
        }
    }

    const feed = new RSS({
      title: `${authorName}'s Nostr Feed`,
      description: `Long-form articles from ${authorName} on Nostr. ${authorAbout}`,
      feed_url: request.url,
      site_url: `https://nostr.guru/p/${npub}`,
      image_url: authorPicture,
      managingEditor: authorName,
      webMaster: authorName,
      copyright: `2025 ${authorName}`,
      language: 'en',
      pubDate: new Date().toUTCString(),
      ttl: 60,
    });

    for (const event of events) {
      const title = event.tags.find((t: string[]) => t[0] === 'title')?.[1] || 'Untitled';
      const published = event.tags.find((t: string[]) => t[0] === 'published_at')?.[1];
      const summary = event.tags.find((t: string[]) => t[0] === 'summary')?.[1];
      const eventId = nip19.neventEncode({ id: event.id, relays: DEFAULT_RELAYS.slice(0,2) });

      feed.item({
        title: title,
        description: summary || event.content.slice(0, 200),
        url: `https://nostr.guru/e/${eventId}`,
        guid: event.id,
        author: authorName,
        date: published ? new Date(parseInt(published) * 1000) : new Date(event.created_at * 1000),
      });
    }

    pool.close(DEFAULT_RELAYS);

    const xml = feed.xml({ indent: true });
    return new NextResponse(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });

  } catch (error) {
    console.error('Failed to fetch Nostr events or generate RSS feed:', error);
    pool.close(DEFAULT_RELAYS);
    return new NextResponse('Error generating RSS feed.', { status: 500 });
  }
}
