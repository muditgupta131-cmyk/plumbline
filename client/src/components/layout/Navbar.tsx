import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, ButtonLink, Skeleton, ThemeToggle } from '@/components/ui';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { SearchTrigger } from '@/components/search';
import { NotificationBell } from '@/components/watchlist';
import { Logo } from './Logo';
import { UserMenu } from './UserMenu';
import { accountNav, primaryNav } from './navigation';

export function Navbar() {
  const { status, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useLockBodyScroll(menuOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
      isActive ? 'bg-content/[0.06] text-content' : 'text-content-muted hover:text-content',
    );

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 ease-swift',
        scrolled ? 'glass border-b border-hairline' : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <SearchTrigger />
          <NotificationBell />
          <ThemeToggle className="hidden sm:flex" />
          <div className="hidden items-center gap-2 lg:flex">
            {status === 'authenticated' ? (
              <>
                {accountNav.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
                <UserMenu />
              </>
            ) : status === 'loading' ? (
              <Skeleton rounded="full" className="h-9 w-32" />
            ) : (
              <>
                <ButtonLink to="/login" size="sm" variant="secondary">
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" size="sm">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute inset-x-0 top-16 border-b border-hairline lg:hidden"
          >
            <nav aria-label="Mobile" className="container grid gap-1 py-4">
              {[...primaryNav, ...(status === 'authenticated' ? accountNav : [])].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3 py-3 transition-colors',
                      isActive ? 'bg-content/[0.06]' : 'hover:bg-content/[0.04]',
                    )
                  }
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block text-xs text-content-subtle">{item.description}</span>
                  ) : null}
                </NavLink>
              ))}

              <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-4">
                {status === 'authenticated' ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex-1 rounded-full border border-hairline px-4 py-2 text-center text-sm"
                    >
                      Settings
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setMenuOpen(false);
                        void logout();
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <ButtonLink to="/login" variant="secondary" size="sm" className="flex-1">
                      Sign in
                    </ButtonLink>
                    <ButtonLink to="/register" size="sm" className="flex-1">
                      Get started
                    </ButtonLink>
                  </>
                )}
                <ThemeToggle />
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
