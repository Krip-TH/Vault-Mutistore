import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HamburgerButton, NavigationDrawer } from '../src/components/NavigationDrawer';
import { adminNavigation, customerNavigation } from '../src/navigation';

test('customer hamburger renders and its controlled drawer opens and closes', () => {
  const button = renderToStaticMarkup(<HamburgerButton expanded={false} onClick={() => {}} />);
  assert.match(button, /aria-label="Open navigation"/); assert.match(button, /☰/);
  const open = renderToStaticMarkup(<NavigationDrawer open title="VAULT" onClose={() => {}}><nav>{customerNavigation.map(item => <button key={item.route}>{item.label}</button>)}</nav></NavigationDrawer>);
  for (const label of ['Home', 'Shop', 'Best Sellers', 'Cart', 'My Orders', 'Profile']) assert.match(open, new RegExp(label));
  assert.doesNotMatch(open, /Dashboard/);
  assert.equal(renderToStaticMarkup(<NavigationDrawer open={false} title="VAULT" onClose={() => {}}>hidden</NavigationDrawer>), '');
});

test('admin hamburger and drawer contain only the admin navigation set', () => {
  const button = renderToStaticMarkup(<HamburgerButton expanded onClick={() => {}} label="Open admin navigation" />);
  assert.match(button, /aria-expanded="true"/);
  const html = renderToStaticMarkup(<NavigationDrawer open title="VAULT ADMIN" onClose={() => {}}><nav>{adminNavigation.map(item => <button key={item.view}>{item.label}</button>)}</nav></NavigationDrawer>);
  for (const label of ['Dashboard', 'Products', 'Orders', 'Users', 'Businesses']) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /My Orders|Profile|Shop/);
});
