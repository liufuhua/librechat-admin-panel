import { createFileRoute } from '@tanstack/react-router';
import { DomainCreatePage } from '@/components/dataquery/domains';

interface DomainCreateSearch {
  selection?: string;
}

export const Route = createFileRoute('/_app/data-query/domains/new')({
  validateSearch: (search: Record<string, unknown>): DomainCreateSearch => ({
    selection: typeof search.selection === 'string' ? search.selection : undefined,
  }),
  component: DomainCreateRoute,
});

function DomainCreateRoute() {
  return <DomainCreatePage selectionToken={Route.useSearch().selection} />;
}
