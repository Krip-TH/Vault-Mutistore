import { brandnameAdapter } from './brandname/index.js';
import { clothingAdapter } from './clothing/index.js';
import { doorAdapter } from './door/index.js';
import { plugAdapter } from './plug/index.js';
import { powerbankAdapter } from './powerbank/index.js';
import { projectorAdapter } from './projector/index.js';

export const adapters = {
  door: doorAdapter,
  plug: plugAdapter,
  brandname: brandnameAdapter,
  clothing: clothingAdapter,
  powerbank: powerbankAdapter,
  projector: projectorAdapter,
};
