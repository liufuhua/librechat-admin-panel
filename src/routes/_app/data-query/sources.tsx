import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/data-query/sources')({
  component: Outlet,
});
