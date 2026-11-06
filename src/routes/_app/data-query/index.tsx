import { createFileRoute } from '@tanstack/react-router';
import { DataQueryOverviewPage } from '@/components/dataquery';

export const Route = createFileRoute('/_app/data-query/')({
  component: DataQueryOverviewPage,
});
