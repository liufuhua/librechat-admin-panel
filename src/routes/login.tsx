import { Container } from '@clickhouse/click-ui';
import { createFileRoute } from '@tanstack/react-router';
import ThemeSelector from '@/components/ThemeSelector';
import { AuthCard } from '@/components/AuthCard';
import { checkOpenIdFn } from '@/server';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/',
  }),
  loader: async () => {
    const openIdStatus = await checkOpenIdFn();
    return {
      ssoAvailable: openIdStatus.available,
      ssoOnly: openIdStatus.available && openIdStatus.ssoOnly,
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { ssoAvailable, ssoOnly } = Route.useLoaderData();

  if (import.meta.env.VITE_ASSISTANT_MODE === 'true') {
    return <main style={{ padding: '2rem', textAlign: 'center' }}><h1>请先登录企业工作空间</h1><p>数据管理仅对当前有效的管理员账号开放。请返回工作台重新登录。</p></main>;
  }
  return (
    <Container
      orientation="vertical"
      alignItems="center"
      justifyContent="center"
      style={{ minHeight: '100vh', padding: '1rem', gap: '1rem' }}
    >
      <AuthCard redirectTo={redirect} autoRedirectSso={ssoOnly} ssoAvailable={ssoAvailable} />
      <div className="sm:absolute sm:bottom-0 sm:left-0 sm:m-4">
        <ThemeSelector returnThemeOnly />
      </div>
    </Container>
  );
}
