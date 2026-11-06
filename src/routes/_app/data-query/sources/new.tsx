import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DataSourceCreatePage } from '@/components/dataquery';
import { dataQuerySourceOptions } from '@/server';
import { useLocalize } from '@/hooks';

export const Route = createFileRoute('/_app/data-query/sources/new')({
  validateSearch: (search: Record<string, unknown>): { resume?: string } => ({
    resume: typeof search.resume === 'string' && /^[a-z][a-z0-9_]{1,119}$/.test(search.resume) ? search.resume : undefined,
  }),
  component: SourceCreateRoute,
});

function SourceCreateRoute() {
  const { resume } = Route.useSearch();
  const navigate = Route.useNavigate();
  const localize = useLocalize();
  const [liveSourceKey, setLiveSourceKey] = useState<string>();
  const source = useQuery({ ...dataQuerySourceOptions(resume || ''), enabled: Boolean(resume) });
  const liveWizard = Boolean(liveSourceKey && (!resume || resume === liveSourceKey));
  // Updating the URL after creation must not remount the in-memory wizard:
  // non-secret connection fields stay available while the password stays cleared.
  if (liveWizard) return <DataSourceCreatePage key="new" />;
  if (resume && source.isError) return <p role="alert">{localize('com_data_query_source_load_failed')}</p>;
  if (resume && !source.data) return <p role="status">{localize('com_ui_loading')}</p>;
  return <DataSourceCreatePage key={resume || 'new'} initialSource={resume ? source.data : undefined}
    onSourceCreated={(sourceKey) => {
      setLiveSourceKey(sourceKey);
      void navigate({ search: { resume: sourceKey }, replace: true });
    }} />;
}
