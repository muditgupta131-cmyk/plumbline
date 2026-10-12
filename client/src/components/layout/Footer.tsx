import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { footerNav } from './navigation';

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-content-muted">
            Research-grade market data and AI analysis for people who want to understand what they own.
          </p>
        </div>

        {footerNav.map((group) => (
          <nav key={group.title} aria-label={group.title} className="space-y-3">
            <p className="text-eyebrow uppercase text-content-subtle">{group.title}</p>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-content-muted transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-hairline">
        <div className="container flex flex-col gap-3 py-6 text-xs text-content-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Plumbline. Market data is delayed and provided for research only.</p>
          <p>Plumbline does not provide investment advice. Verify every figure before you trade.</p>
        </div>
      </div>
    </footer>
  );
}
