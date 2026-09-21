import type { AdminView } from './types/admin';
import type { AppRoute } from './auth/routes';

export const customerNavigation: ReadonlyArray<{ label: string; route: AppRoute }> = [
  { label: 'Home', route: 'home' },
  { label: 'Shop', route: 'products' },
  { label: 'Cart', route: 'cart' },
  { label: 'My Orders', route: 'orders' },
  { label: 'Profile', route: 'profile' },
];

export const adminNavigation: ReadonlyArray<{ label: string; view: AdminView }> = [
  { label: 'Dashboard', view: 'dashboard' },
  { label: 'Products', view: 'products' },
  { label: 'Orders', view: 'orders' },
  { label: 'Users', view: 'users' },
  { label: 'Businesses', view: 'businesses' },
];

export const isRouteActive = (current: AppRoute, target: AppRoute) => current === target;
