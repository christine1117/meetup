/* Form fields used by both apps. Values are always escaped. */

import { esc } from './core.js?v=20261031f';

export const field = (name, label, val = '', o = {}) => `
  <div class="field">
    <label for="f-${name}">${label}</label>
    ${o.area
      ? `<textarea id="f-${name}" name="${name}" rows="${o.rows || 2}" ${o.req ? 'required' : ''} placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
      : `<input id="f-${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val)}" ${o.req ? 'required' : ''} ${o.min ? `min="${o.min}"` : ''} ${o.auto ? `autocomplete="${o.auto}"` : ''} placeholder="${esc(o.ph || '')}">`}
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;

export const select = (name, label, opts, val, hint = '') => `
  <div class="field">
    <label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">
      ${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}
    </select>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;
