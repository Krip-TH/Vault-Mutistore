import type { User } from '../types/auth';

export type AppRoute = 'login' | 'register' | 'admin-login' | 'home' | 'orders' | 'admin' | 'admin-orders';

const hashes: Record<AppRoute, string> = {
  login: '#/login',
  register: '#/register',
  'admin-login': '#/admin/login',
  home: '#/home',
  orders: '#/orders',
  admin: '#/admin',
  'admin-orders': '#/admin/orders',
};

const legacyHashes: Partial<Record<string, AppRoute>> = {
  '#login': 'login', '#register': 'register', '#home': 'home', '#orders': 'orders',
  '#admin': 'admin', '#admin/orders': 'admin-orders',
};

export function parseRoute(hash: string): AppRoute {
  const normalized = hash.toLowerCase().replace(/\/+$/, '');
  return (Object.entries(hashes).find(([, value]) => value === normalized)?.[0] as AppRoute | undefined)
    ?? legacyHashes[normalized]
    ?? 'home';
}

export function routeHash(route: AppRoute): string {
  return hashes[route];
}

export function routeAfterAuthentication(user: User): AppRoute {
  return user.role === 'admin' ? 'admin' : 'home';
}

export function resolveProtectedRoute(route: AppRoute, user: User | null): AppRoute {
  if (!user) {
    if (route === 'register') return 'register';
    if (route === 'admin-login' || route === 'admin' || route === 'admin-orders') return 'admin-login';
    return 'login';
  }
  if (route === 'login' || route === 'register' || route === 'admin-login') return routeAfterAuthentication(user);
  if ((route === 'admin' || route === 'admin-orders') && user.role !== 'admin') return 'home';
  return route;
}

export function routeAfterLogout(user: User): AppRoute {
  return user.role === 'admin' ? 'admin-login' : 'login';
}
