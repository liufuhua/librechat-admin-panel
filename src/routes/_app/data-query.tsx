import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DataQueryLayout } from '@/components/dataquery';

export const Route = createFileRoute('/_app/data-query')({
  component: DataQueryRoute,
});

function DataQueryRoute() {
  return (
    <DataQueryLayout>
      <Outlet />
    </DataQueryLayout>
  );
}
