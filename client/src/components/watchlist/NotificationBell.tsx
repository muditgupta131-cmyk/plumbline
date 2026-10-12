import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, useWatchlistMutations } from '@/hooks/useWatchlist';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const notifications = useNotifications(Boolean(user));
  const mutations = useWatchlistMutations();

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const unread = notifications.data?.unread ?? 0;
  const rows = notifications.data?.notifications ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-content/5 hover:text-content"
      >
        <Bell className="size-4" aria-hidden />
        {unread ? (
          <span
            data-numeric
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-panel border border-hairline bg-elevated shadow-lift">
          <header className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread ? (
              <button
                type="button"
                onClick={() => mutations.markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs text-content-subtle transition-colors hover:text-content"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </header>

          <div className="max-h-96 overflow-y-auto">
            {rows.length ? (
              <ul className="divide-y divide-hairline">
                {rows.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => !notification.readAt && mutations.markRead.mutate(notification.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors hover:bg-content/[0.03]',
                        !notification.readAt && 'bg-brand-600/[0.04]',
                      )}
                    >
                      <p className="flex items-start gap-2 text-sm font-medium">
                        {!notification.readAt ? (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                        ) : null}
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{notification.body}</p>
                      <p className="mt-1 text-[11px] text-content-subtle">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-content-subtle">
                Nothing yet. Set an alert on your watchlist and anything that fires shows up here.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
