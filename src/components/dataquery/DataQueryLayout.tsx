import { Link } from '@tanstack/react-router';
import { useLocalize } from '@/hooks';

export function DataQueryLayout({ children }: { children: React.ReactNode }) {
  const localize = useLocalize();
  const linkClass = 'border-b-2 px-1 py-3 text-sm font-medium no-underline transition-colors';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav
        aria-label={localize('com_data_query_navigation')}
        className="flex shrink-0 gap-6 overflow-x-auto border-b border-(--cui-color-stroke-default) px-6 whitespace-nowrap"
      >
        <Link
          to="/data-query"
          activeOptions={{ exact: true }}
          className={linkClass}
          activeProps={{
            className: `${linkClass} border-(--cui-color-accent) text-(--cui-color-text-default)`,
          }}
          inactiveProps={{
            className: `${linkClass} border-transparent text-(--cui-color-text-muted)`,
          }}
        >
          {localize('com_data_query_overview')}
        </Link>
        <Link
          to="/data-query/sources"
          className={linkClass}
          activeProps={{
            className: `${linkClass} border-(--cui-color-accent) text-(--cui-color-text-default)`,
          }}
          inactiveProps={{
            className: `${linkClass} border-transparent text-(--cui-color-text-muted)`,
          }}
        >
          {localize('com_data_query_tab_sources')}
        </Link>
        <Link
          to="/data-query/domains"
          className={linkClass}
          activeProps={{
            className: `${linkClass} border-(--cui-color-accent) text-(--cui-color-text-default)`,
          }}
          inactiveProps={{
            className: `${linkClass} border-transparent text-(--cui-color-text-muted)`,
          }}
        >
          {localize('com_data_query_tab_domains')}
        </Link>
        <Link
          to="/data-query/authorizations"
          className={linkClass}
          activeProps={{
            className: `${linkClass} border-(--cui-color-accent) text-(--cui-color-text-default)`,
          }}
          inactiveProps={{
            className: `${linkClass} border-transparent text-(--cui-color-text-muted)`,
          }}
        >
          {localize('com_data_query_tab_authorizations')}
        </Link>
        <Link
          to="/data-query/audit"
          className={linkClass}
          activeProps={{
            className: `${linkClass} border-(--cui-color-accent) text-(--cui-color-text-default)`,
          }}
          inactiveProps={{
            className: `${linkClass} border-transparent text-(--cui-color-text-muted)`,
          }}
        >
          {localize('com_data_query_tab_audits')}
        </Link>
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
