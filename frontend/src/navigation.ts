import type { AdminView } from './types/admin';

export const customerNavigation = [
  { label: 'Home', href: '#/home' },
  { label: 'Explore', href: '#explore' },
  { label: 'Businesses', href: '#businesses' },
] as const;

export const adminNavigation: ReadonlyArray<{ label: string; view: AdminView }> = [
  { label: 'Dashboard', view: 'dashboard' },
  { label: 'Products', view: 'products' },
  { label: 'Orders', view: 'orders' },
];
