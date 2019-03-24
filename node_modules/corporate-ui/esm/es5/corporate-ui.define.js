
// CorporateUi: Custom Elements Define Library, ES Module/es5 Target

import { defineCustomElement } from './corporate-ui.core.js';
import { COMPONENTS } from './corporate-ui.components.js';

export function defineCustomElements(win, opts) {
  return defineCustomElement(win, COMPONENTS, opts);
}
