/* Fields and their boba flavors, the logo, and the flavor chip. */

import { esc } from './core.js?v=20261101d';
import { L } from './i18n.js?v=20261101d';

export const FIELDS = ['Design', 'Engineering', 'Founder', 'Research', 'Content', 'Business', 'Other'];
export const fieldName = (f) => L(f);

// Logo: a half-full boba cup. Simple geometric mark.
export const LOGO = `<svg class="logo__mark" viewBox="0 0 24 28" aria-hidden="true"><path d="M14.5 1.5 12.8 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M4 9h16l-2 16.3A2 2 0 0 1 16 27H8a2 2 0 0 1-2-1.7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5.3 15h13.4" stroke="currentColor" stroke-width="2"/><circle cx="9.6" cy="22.4" r="1.7" fill="var(--orange)"/><circle cx="14.4" cy="22.4" r="1.7" fill="var(--orange)"/><circle cx="12" cy="19" r="1.7" fill="var(--orange)"/></svg><span>Half Sugar</span>`;

// Each field is a boba flavor. The colour fills that person's cup.
export const FLAVORS = {
  Design: ['Taro', '#c9b3dd'],
  Engineering: ['Matcha', '#b9cf98'],
  Founder: ['Brown sugar', '#c98f5c'],
  Research: ['Oolong', '#dcc282'],
  Content: ['Strawberry', '#eeb0ad'],
  Business: ['Mango', '#f2c36f'],
  Other: ['Classic milk tea', '#dcc3a1'],
};
export const flavor = (f) => FLAVORS[f] || FLAVORS.Other;
export const flavorName = (f) => L(flavor(f)[0]);
export const drinkName = (f) => { const n = flavor(f)[0]; return /milk tea/.test(n) ? L(n) : L`${L(n)} milk tea`; };

// Someone can have two fields, like a layered two-flavor drink. The first one is their main field.
export const fieldsOf = (p) => [p.field, p.field2].filter(Boolean);
export const fieldsLabel = (p) => fieldsOf(p).map(fieldName).join(' + ');
export const flavorsLabel = (p) => fieldsOf(p).map(flavorName).join(' + ');
export const drinkFor = (p) => (p.field2 ? L`${flavorsLabel(p)} milk tea` : drinkName(p.field));

export const flavorChip = (p) => `<span class="flavor" style="--flavor:${flavor(p.field)[1]};--flavor2:${flavor(p.field2 || p.field)[1]}" title="${esc(L`Flavor = field. ${flavorsLabel(p)} means ${fieldsLabel(p)}.`)}">${esc(flavorsLabel(p))}</span>`;
