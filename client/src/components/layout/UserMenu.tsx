import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, ChevronDown, LogOut, Settings, Shield, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

const items = [
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/profile', label: 'Settings', icon: Settings },
];

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleLogout = () => {
    setOpen(false);
    void logout().then(() => navigate('/'));
  };

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-hairline py-1 pl-1 pr-2.5 transition-colors hover:border-content-subtle"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute right-0 top-12 w-60 overflow-hidden rounded-card border border-hairline shadow-lift"
          >
            <div className="border-b border-hairline p-4">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-content-subtle">{user.email}</p>
            </div>

            <div className="p-1.5">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-content/[0.06]"
                >
                  <item.icon className="size-4 text-content-subtle" aria-hidden />
                  {item.label}
                </Link>
              ))}

              {user.role === 'admin' ? (
                <Link
                  to="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-content/[0.06]"
                >
                  <Shield className="size-4 text-content-subtle" aria-hidden />
                  Admin panel
                </Link>
              ) : null}
            </div>

            <div className="border-t border-hairline p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-bear transition-colors hover:bg-bear/8"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
