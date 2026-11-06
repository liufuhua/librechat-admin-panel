import { createFileRoute } from '@tanstack/react-router';
import { DomainListPage } from '@/components/dataquery/domains';

export const Route = createFileRoute('/_app/data-query/domains/')({
  component: DomainListPage,
});
