import { createFileRoute } from '@tanstack/react-router';
import { AuditPage } from '@/components/dataquery/audit';

export const Route = createFileRoute('/_app/data-query/audit')({
  component: AuditRoute,
});

function AuditRoute() {
  return <AuditPage />;
}
