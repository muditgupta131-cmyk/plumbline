import { useState } from 'react';
import { Building2, CalendarDays, ExternalLink, MapPin, UserRound } from 'lucide-react';
import { Badge, Card, SkeletonText } from '@/components/ui';
import type { CompanyProfile } from '@/types';
import { formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

interface AboutCompanyProps {
  profile: CompanyProfile | null | undefined;
  loading?: boolean;
}

export function AboutCompany({ profile, loading }: AboutCompanyProps) {
  const [expanded, setExpanded] = useState(false);

  const meta = [
    { icon: UserRound, label: 'CEO', value: profile?.ceo },
    { icon: MapPin, label: 'Headquarters', value: profile?.headquarters },
    {
      icon: Building2,
      label: 'Employees',
      value: profile?.employees ? formatNumber(profile.employees, 0) : null,
    },
    { icon: CalendarDays, label: 'Listed', value: profile?.ipoDate ? formatDate(profile.ipoDate) : null },
  ].filter((item) => item.value);

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-3 text-base font-semibold">About the company</h3>

      {loading ? (
        <SkeletonText lines={4} />
      ) : profile?.description ? (
        <>
          <p className={cn('text-sm leading-relaxed text-content-muted', !expanded && 'line-clamp-4')}>
            {profile.description}
          </p>
          {profile.description.length > 200 ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-content-subtle">No company description is available for this listing.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {profile?.sector ? <Badge tone="brand">{profile.sector}</Badge> : null}
        {profile?.industry ? <Badge>{profile.industry}</Badge> : null}
      </div>

      {meta.length ? (
        <dl className="mt-5 grid gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
          {meta.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <item.icon className="mt-0.5 size-4 shrink-0 text-content-subtle" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-content-subtle">{item.label}</dt>
                <dd className="truncate text-sm">{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}

      {profile?.website ? (
        <a
          href={profile.website}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-600 hover:underline dark:text-accent-400"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {profile.website.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
    </Card>
  );
}
