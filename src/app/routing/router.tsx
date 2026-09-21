import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { AppShell } from '@/app/shell/AppShell';
import { Home } from './Home';
import { NotFound } from './NotFound';

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

/**
 * Workspaces are lazy by route: opening /jwt must never pull in the code for
 * anything else. Adding a tool means one entry here and one in the registry.
 */
const jwtRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jwt',
  component: lazyRouteComponent(
    () => import('@/tools/jwt/components/JwtWorkspace'),
    'JwtWorkspace',
  ),
});

const jwtBuildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jwt/build',
  component: lazyRouteComponent(
    () => import('@/tools/jwt/components/JwtBuildWorkspace'),
    'JwtBuildWorkspace',
  ),
});

const jsonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/json',
  component: lazyRouteComponent(
    () => import('@/tools/json/components/JsonWorkspace'),
    'JsonWorkspace',
  ),
});

const jsonCompareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/json/compare',
  component: lazyRouteComponent(
    () => import('@/tools/json/components/JsonCompareWorkspace'),
    'JsonCompareWorkspace',
  ),
});

const base64Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/base64',
  component: lazyRouteComponent(
    () => import('@/tools/base64/components/Base64Workspace'),
    'Base64Workspace',
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  jwtRoute,
  jwtBuildRoute,
  base64Route,
  jsonRoute,
  jsonCompareRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Chunks are small; showing a spinner for them would flash more than it informs.
  defaultPendingMs: 400,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
