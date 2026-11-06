import { createFileRoute } from '@tanstack/react-router';
import { AuthorizationsPage } from '@/components/dataquery/authorizations';

export const Route = createFileRoute('/_app/data-query/authorizations')({
  component: AuthorizationsRoute,
});

function AuthorizationsRoute() {
  return <AuthorizationsPage />;
}
