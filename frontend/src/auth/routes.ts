import type { User } from '../types/auth';

export type AppRoute = 'login' | 'register' | 'admin-login' | 'home' | 'products' | 'best-sellers' | 'cart' | 'orders' | 'claims' | 'profile'
  | 'admin' | 'admin-products' | 'admin-orders' | 'admin-claims' | 'admin-users' | 'admin-businesses';

const hashes: Record<AppRoute, string> = {
  login: '#/login',
  register: '#/register',
  'admin-login': '#/admin/login',
  home: '#/home',
  products: '#/products',
  'best-sellers': '#/best-sellers',
  cart: '#/cart',
  orders: '#/orders',
  claims: '#/claims',
  profile: '#/profile',
  admin: '#/admin',
  'admin-products': '#/admin/products',
  'admin-orders': '#/admin/orders',
  'admin-claims': '#/admin/claims',
  'admin-users': '#/admin/users',
  'admin-businesses': '#/admin/businesses',
};

const legacyHashes: Partial<Record<string, AppRoute>> = {
  '#login': 'login', '#register': 'register', '#home': 'home', '#products': 'products', '#best-sellers': 'best-sellers', '#cart': 'cart', '#orders': 'orders', '#claims': 'claims', '#profile': 'profile',
  '#admin': 'admin', '#admin/products': 'admin-products', '#admin/orders': 'admin-orders', '#admin/claims': 'admin-claims', '#admin/users': 'admin-users', '#admin/businesses': 'admin-businesses',
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
    if (route === 'admin-login' || route.startsWith('admin')) return 'admin-login';
    return 'login';
  }
  if (route === 'login' || route === 'register' || route === 'admin-login') return routeAfterAuthentication(user);
  if (route.startsWith('admin') && user.role !== 'admin') return 'home';
  return route;
}

export function routeAfterLogout(user: User): AppRoute {
  return user.role === 'admin' ? 'admin-login' : 'login';
}
