export interface RssItem {
  title: string;
  link: string;
  publishedAt: string | null;
  source: string | null;
  description: string | null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return match ? decodeEntities(match[1]) : null;
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseRss(xml: string): RssItem[] {
  const blocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];

  return blocks.flatMap((block) => {
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    if (!title || !link) return [];

    return [
      {
        title,
        link,
        publishedAt: toIso(tag(block, 'pubDate')),
        source: tag(block, 'source'),
        description: tag(block, 'description'),
      },
    ];
  });
}
