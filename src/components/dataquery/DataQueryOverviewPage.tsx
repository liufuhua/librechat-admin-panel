import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { dataQueryAuditsOptions, dataQueryDomainsOptions, dataQuerySourcesOptions } from '@/server';
import { LoadingState } from '@/components/shared';
import { useLocalize } from '@/hooks';

function SummaryCard({ label, value, error }: { label: string; value: number; error?: boolean }) {
  return (
    <article
      className={`rounded-lg border p-4 ${
        error
          ? 'border-(--cui-color-stroke-danger) bg-(--cui-color-background-danger)'
          : 'border-(--cui-color-stroke-default) bg-(--cui-color-background-panel)'
      }`}
    >
      <p className="text-sm text-(--cui-color-text-muted)">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-(--cui-color-title-default)">{value}</p>
    </article>
  );
}

export function DataQueryOverviewPage() {
  const localize = useLocalize();
  const sources = useQuery(dataQuerySourcesOptions);
  const domains = useQuery(dataQueryDomainsOptions);
  const audits = useQuery(dataQueryAuditsOptions);

  if (sources.isLoading && domains.isLoading && audits.isLoading) {
    return <LoadingState />;
  }

  const sourceItems = sources.data ?? [];
  const domainItems = domains.data ?? [];
  const enabledSources = sourceItems.filter((source) => source.enabled).length;
  const failedSources = sourceItems.filter(
    (source) => source.last_connection_status === 'failed',
  ).length;
  const publishedDomains = domainItems.filter((domain) => domain.published_version).length;
  const pendingQuality = domainItems
    .flatMap((domain) => domain.versions)
    .filter(
      (version) =>
        version.status !== 'published' &&
        (!version.quality_status ||
          version.quality_status === 'not_run' ||
          version.quality_status === 'failed'),
    ).length;
  const credentialAttention = sourceItems.filter((source) =>
    ['missing', 'rotation_required', 'revoked'].includes(source.credential_state),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
          {localize('com_data_query_overview')}
        </h2>
        <p className="mt-1 text-sm text-(--cui-color-text-muted)">
          {localize('com_data_query_overview_hint')}
        </p>
      </header>

      <section
        aria-label={localize('com_data_query_status_summary')}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          label={localize('com_data_query_enabled_sources')}
          value={enabledSources}
          error={sources.isError}
        />
        <SummaryCard
          label={localize('com_data_query_failed_sources')}
          value={failedSources}
          error={sources.isError}
        />
        <SummaryCard
          label={localize('com_data_query_published_domains')}
          value={publishedDomains}
          error={domains.isError}
        />
        <SummaryCard
          label={localize('com_data_query_pending_quality')}
          value={pendingQuality}
          error={domains.isError}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5">
          <h3 className="font-medium text-(--cui-color-title-default)">
            {localize('com_data_query_attention')}
          </h3>
          {credentialAttention.length === 0 ? (
            <p className="mt-3 text-sm text-(--cui-color-text-muted)">
              {localize('com_data_query_no_attention')}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {credentialAttention.map((source) => (
                <li key={source.source_key}>
                  <Link
                    to="/data-query/sources/$sourceKey"
                    params={{ sourceKey: source.source_key }}
                    className="text-(--cui-color-text-default) underline"
                  >
                    {source.name}
                  </Link>
                  <span className="ml-2 text-(--cui-color-text-muted)">
                    {source.credential_state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5">
          <h3 className="font-medium text-(--cui-color-title-default)">
            {localize('com_data_query_recent_activity')}
          </h3>
          {audits.isError ? (
            <p role="alert" className="mt-3 text-sm text-(--cui-color-text-danger)">
              {localize('com_data_query_activity_load_failed')}
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2 text-sm">
              {(audits.data ?? []).slice(0, 5).map((audit) => (
                <li key={audit.id} className="flex justify-between gap-4">
                  <span>{audit.action}</span>
                  <span className="truncate text-(--cui-color-text-muted)">{audit.object_key}</span>
                </li>
              ))}
              {(audits.data ?? []).length === 0 && (
                <li className="text-(--cui-color-text-muted)">
                  {localize('com_data_query_no_audits')}
                </li>
              )}
            </ol>
          )}
        </article>
      </section>

      <section aria-label={localize('com_data_query_quick_actions')}>
        <h3 className="mb-3 font-medium text-(--cui-color-title-default)">
          {localize('com_data_query_quick_actions')}
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/data-query/sources/new"
            className="rounded-md bg-(--cui-color-accent) px-4 py-2 text-sm font-medium text-white no-underline"
          >
            {localize('com_data_query_create_source')}
          </Link>
          <Link
            to="/data-query/sources"
            className="rounded-md border border-(--cui-color-stroke-default) px-4 py-2 text-sm font-medium text-(--cui-color-text-default) no-underline"
          >
            {localize('com_data_query_view_sources')}
          </Link>
          <Link
            to="/data-query/domains"
            search={{ create: true }}
            className="rounded-md border border-(--cui-color-stroke-default) px-4 py-2 text-sm font-medium text-(--cui-color-text-default) no-underline"
          >
            {localize('com_data_query_create_domain_draft')}
          </Link>
          <Link
            to="/data-query/authorizations"
            className="rounded-md border border-(--cui-color-stroke-default) px-4 py-2 text-sm font-medium text-(--cui-color-text-default) no-underline"
          >
            {localize('com_data_query_tab_authorizations')}
          </Link>
          <Link
            to="/data-query/audit"
            className="rounded-md border border-(--cui-color-stroke-default) px-4 py-2 text-sm font-medium text-(--cui-color-text-default) no-underline"
          >
            {localize('com_data_query_tab_audits')}
          </Link>
        </div>
      </section>
    </div>
  );
}
