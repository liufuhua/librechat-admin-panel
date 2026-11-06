import { createFileRoute } from '@tanstack/react-router';
import { DataSourceListPage } from '@/components/dataquery';

export const Route = createFileRoute('/_app/data-query/sources/')({
  component: DataSourceListPage,
});
