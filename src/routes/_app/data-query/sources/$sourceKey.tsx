import { createFileRoute } from '@tanstack/react-router';
import { DataSourceDetailPage } from '@/components/dataquery';

export const Route = createFileRoute('/_app/data-query/sources/$sourceKey')({
  component: DataSourceRoute,
});

function DataSourceRoute() {
  const { sourceKey } = Route.useParams();
  return <DataSourceDetailPage sourceKey={sourceKey} />;
}
