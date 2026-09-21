import { brandnameAdapter, business as brandname, businessName as brandnameName } from './brandname/index.js';
import { clothingAdapter, business as clothing, businessName as clothingName } from './clothing/index.js';
import { doorAdapter, business as door, businessName as doorName } from './door/index.js';
import { plugAdapter, business as plug, businessName as plugName } from './plug/index.js';
import { powerbankAdapter, business as powerbank, businessName as powerbankName } from './powerbank/index.js';
import { projectorAdapter, business as projector, businessName as projectorName } from './projector/index.js';

export const adapters = {
  door: doorAdapter,
  plug: plugAdapter,
  brandname: brandnameAdapter,
  clothing: clothingAdapter,
  powerbank: powerbankAdapter,
  projector: projectorAdapter,
};

export const businessCatalog = [
  { id: door, name: doorName }, { id: plug, name: plugName },
  { id: brandname, name: brandnameName }, { id: clothing, name: clothingName },
  { id: powerbank, name: powerbankName }, { id: projector, name: projectorName },
] as const;
