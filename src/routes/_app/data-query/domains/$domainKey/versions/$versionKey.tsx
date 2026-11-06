import { createFileRoute } from '@tanstack/react-router';
import { DomainVersionPage } from '@/components/dataquery/versions';

export const Route = createFileRoute(
  '/_app/data-query/domains/$domainKey/versions/$versionKey',
)({
  component: DomainVersionRoute,
});

function DomainVersionRoute() {
  const { domainKey, versionKey } = Route.useParams();
  return <DomainVersionPage domainKey={domainKey} versionKey={versionKey} />;
}
