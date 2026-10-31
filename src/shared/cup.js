/* Drawing: the boba cup and the toppings. Returns SVG strings only. */

import { uid } from './core.js?v=20261031u';
import { flavor } from './flavors.js?v=20261031u';

// The boba cup: a clear plastic cup with a dome lid, a red straw, pearls at the
// bottom, and a red seal label.
// Big cups can come apart: the straw and lid lift up, and the toppings and
// pearls fly out to the left and right. The tea and the cup stay together.
// level goes from 0 (empty) to 1 (full). ids are toppings to put in the drink.
export const BIG_CUP = /cup--(hero|mystery|lg|profile)/;
export const CUP_SHELL = 'M2.5 9.4 L4.5 25.1 Q12 27.3 19.5 25.1 L21.5 9.4'; // open at the top, so no line across the opening
export const CUP_IN = 'M3.2 10.4 L5.1 24.6 Q12 26.5 18.9 24.6 L20.8 10.4 Z';
export const CUP_DOME = 'M2.3 9.2 Q2.5 1.6 12 1.6 Q21.5 1.6 21.7 9.2'; // open at the bottom, so no line across the lid
export const CUP_STRAW = 'M14.2 -4.6 L16 -4.4 L13.4 21 L11.6 20.8 Z';
export const CUP_PEARLS = [[8.6, 23.4, '#3b2518'], [11.9, 23.9, '#4a2c1c'], [15.3, 23.3, '#7d93a0'], [10.2, 21.4, '#5a3a28'], [13.7, 21.6, '#3b2518'], [7, 21.4, '#6f8796'], [17, 21.2, '#4a2c1c']];
// Where each piece goes when the cup comes apart, and when it starts moving
export const APART = {
  straw: '--dy:-16px;--d:0s',
  lid: '--dy:-10px;--d:.05s',
  layer: '--dy:-5.5px;--d:.08s',
  topL: '--dx:-14px;--r:-10deg;--d:.12s',
  topR: '--dx:14px;--r:10deg;--d:.12s',
  pearlsL: '--dx:-13px;--dy:1.5px;--r:-8deg;--d:.18s',
  pearlsR: '--dx:13px;--dy:1.5px;--r:8deg;--d:.18s',
};
// Cups that come apart get extra room around them for the pieces
export const EXPLODE = /cup--(hero|profile)/;
export const WIDE_VIEW = '-11 -16 46 44';

export function cupArt(color, o = {}) {
  const id = 'cp' + uid();
  const ids = o.ids || [];
  const has = (k) => ids.includes(k);
  const big = BIG_CUP.test(o.cls || '');
  const meter = /cup--chip/.test(o.cls || '');
  const level = o.level ?? 0.62;
  const fill = meter ? level : level > 0 ? 1 : 0; // cups look full unless empty or a sugar meter
  const teaTop = +(24.9 - 14.1 * fill).toFixed(2);
  const mid = ((teaTop + 25) / 2).toFixed(1);
  const halfAt = (y) => 9.3 - 1.9 * ((y - 10.4) / 14.2); // the cup is narrower lower down
  // Big cups get edges from light and shade; small cups keep a thin grey line so they stay readable
  const line = big ? 0.22 : 0.6;
  const ink = big ? '#8d877d' : '#a39d93';
  const part = (name, body) => (body ? `<g class="part p-${name}" style="${APART[name] || ''}">${body}</g>` : '');
  // Floating toppings, split into the left and right halves of the cup
  const placed = ids.filter((k) => PIECE[k]).flatMap((k, i) => [0, 1].map((n) => {
    const [x, y] = PIECE_SLOTS[(i * 2 + n) % PIECE_SLOTS.length];
    return { x, svg: PIECE[k](id, x, y, PIECE_SIZE, n) };
  }));
  const side = (list, left) => list.filter((p) => (left ? p.x < 12 : p.x >= 12)).map((p) => p.svg).join('');
  const pearls = fill > 0.3 ? CUP_PEARLS.map(([x, y, c]) => ({ x, svg: `<ellipse cx="${x}" cy="${y + 1.25}" rx="1.3" ry=".35" fill="#000" fill-opacity=".18"/><circle cx="${x}" cy="${y}" r="1.5" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.5" fill="url(#${id}-pearl)"/>` })) : [];
  return `
    ${toppingDefs(id)}
    <defs>
      <clipPath id="${id}-in"><path d="${CUP_IN}"/></clipPath>
      <linearGradient id="${id}-shade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#2a1d16" stop-opacity="0"/><stop offset="1" stop-color="#2a1d16" stop-opacity=".22"/></linearGradient>
      <radialGradient id="${id}-pearl" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <linearGradient id="${id}-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1d16" stop-opacity=".2"/></linearGradient>
      <linearGradient id="${id}-plastic" x1="0" x2="1">
        <stop offset="0" stop-color="#6f675c" stop-opacity=".32"/><stop offset=".05" stop-color="#fff" stop-opacity=".55"/><stop offset=".13" stop-color="#fff" stop-opacity=".08"/>
        <stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".86" stop-color="#fff" stop-opacity=".06"/><stop offset=".93" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#6f675c" stop-opacity=".34"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ece7de"/><stop offset="1" stop-color="#b8b1a6"/></linearGradient>
      <radialGradient id="${id}-dome" cx=".38" cy=".25" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".22"/><stop offset=".85" stop-color="#cfc8bc" stop-opacity=".22"/><stop offset="1" stop-color="#8d877d" stop-opacity=".4"/></radialGradient>
      <linearGradient id="${id}-straw" x1="0" x2="1"><stop offset="0" stop-color="#b8341c"/><stop offset=".35" stop-color="#f26a45"/><stop offset=".55" stop-color="#e2492a"/><stop offset="1" stop-color="#a02c17"/></linearGradient>
      <radialGradient id="${id}-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b2518" stop-opacity=".22"/><stop offset="1" stop-color="#3b2518" stop-opacity="0"/></radialGradient>
    </defs>
    ${big ? `<ellipse cx="12" cy="26.7" rx="10" ry="1.6" fill="url(#${id}-floor)"/>` : ''}
    ${fill > 0 ? `<g clip-path="url(#${id}-in)">
      <rect x="0" y="${teaTop}" width="24" height="20" fill="${o.color2 || color}"/>
      ${o.color2 ? `<rect x="0" y="${mid}" width="24" height="20" fill="${color}"/>` : ''}
      ${has('tiger') ? `<g fill="none" stroke="url(#${id}-syrup)" stroke-width="1.3" stroke-opacity=".8" stroke-linecap="round"><path d="M6 11.5Q9 15 7 19T9 25"/><path d="M12.5 11Q15 14.5 12.8 18.5T14.6 24.5"/><path d="M17.8 11.8Q19.4 15 17.4 18.6"/></g>` : ''}
      <rect x="0" y="${teaTop}" width="24" height="20" fill="url(#${id}-shade)"/>
      <rect x="0" y="${teaTop}" width="24" height="20" fill="url(#${id}-deep)"/>
      ${has('foam') || has('brulee') ? '' : `<ellipse cx="12" cy="${teaTop}" rx="${halfAt(teaTop).toFixed(2)}" ry=".75" fill="#fff" fill-opacity=".22"/>`}
    </g>` : ''}
    ${part('layer', (() => {
      // A round slice the shape of the cup at that height: side band plus a top oval
      const disc = (y, thick, sideFill, topFill, extra = '') => {
        const hw = halfAt(y);
        return `<path d="M${(12 - hw).toFixed(2)} ${y} v${thick} a${hw.toFixed(2)} .9 0 0 0 ${(2 * hw).toFixed(2)} 0 v-${thick} Z" fill="${sideFill}" stroke="#3b2518" stroke-opacity=".18" stroke-width=".2"/><ellipse cx="12" cy="${y}" rx="${hw.toFixed(2)}" ry=".9" fill="${topFill}" stroke="#3b2518" stroke-opacity=".18" stroke-width=".2"/>${extra}`;
      };
      const foamY = teaTop;
      const bruY = has('foam') ? teaTop - 1.2 : teaTop;
      return (fill > 0.5 && has('foam') ? disc(foamY, 2, `url(#${id}-foamL)`, '#fffaf0') : '')
        + (fill > 0.5 && has('brulee') ? disc(bruY, 1.2, `url(#${id}-bruL)`, `url(#${id}-caramel)`, `<g fill="#5e2c0c" fill-opacity=".5"><ellipse cx="9.5" cy="${bruY}" rx=".7" ry=".2"/><ellipse cx="14.2" cy="${bruY + 0.2}" rx=".5" ry=".15"/><ellipse cx="12" cy="${bruY - 0.3}" rx=".4" ry=".12"/></g>`) : '');
    })())}
    ${part('pearlsL', side(pearls, true))}
    ${part('pearlsR', side(pearls, false))}
    ${part('topL', side(placed, true))}
    ${part('topR', side(placed, false))}
    ${part('straw', `<path d="${CUP_STRAW}" fill="url(#${id}-straw)" ${big ? '' : 'stroke="#a3301b" stroke-width=".4" stroke-linejoin="round"'}/><path d="M14.85 -3.6 12.55 18.5" stroke="#fff" stroke-opacity=".5" stroke-width=".3" stroke-linecap="round"/><ellipse cx="15.1" cy="-4.5" rx=".95" ry=".3" fill="#8f2615"/>`)}
    <path d="${CUP_SHELL} Z" fill="url(#${id}-plastic)"/>
    <path d="${CUP_SHELL}" fill="none" stroke="${ink}" stroke-opacity="${big ? 0.55 : 1}" stroke-width="${line}" stroke-linejoin="round"/>
    <path d="M4.5 25.1 Q12 27.3 19.5 25.1" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".3"/>
    <path d="M3.9 11.2 5.5 23.9" stroke="#fff" stroke-opacity=".7" stroke-width=".75" stroke-linecap="round"/>
    <path d="M19.4 11.6 18.3 21" stroke="#fff" stroke-opacity=".45" stroke-width=".3" stroke-linecap="round"/>
    <path d="M2.5 9.4 A9.5 1.1 0 0 1 21.5 9.4" fill="none" stroke="${ink}" stroke-opacity=".5" stroke-width="${line}"/>
    <path d="M2.3 9.4 A9.7 1.25 0 0 0 21.7 9.4 L21.7 9 A9.7 1.25 0 0 1 2.3 9 Z" fill="url(#${id}-rim)" stroke="${ink}" stroke-opacity="${big ? 0.4 : 0.9}" stroke-width="${line * 0.8}"/>
    <rect x="9.6" y="11.8" width="4.8" height="6" rx=".5" fill="#c8352b"/>
    ${big ? `<rect x="10" y="12.2" width="4" height="5.2" rx=".3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".14"/>` : ''}
    ${o.mark
      ? `<text x="12" y="16.7" text-anchor="middle" font-family="Outfit, sans-serif" font-size="4" font-weight="700" fill="#fff">${o.mark}</text>`
      : big ? `<text x="12" y="14.6" text-anchor="middle" font-family="'Noto Sans TC', sans-serif" font-size="2.2" font-weight="700" fill="#fff">半</text><text x="12" y="17.1" text-anchor="middle" font-family="'Noto Sans TC', sans-serif" font-size="2.2" font-weight="700" fill="#fff">糖</text>
        <text x="12" y="19.6" text-anchor="middle" font-family="Outfit, sans-serif" font-size="1.05" font-weight="600" letter-spacing=".32" fill="#2a1d16" fill-opacity=".8">HALF SUGAR</text>` : ''}
    ${part('lid', `<path d="${CUP_DOME} Z" fill="url(#${id}-dome)"/>
      <path d="${CUP_DOME}" fill="none" stroke="${ink}" stroke-opacity="${big ? 0.45 : 1}" stroke-width="${line}" stroke-linejoin="round"/>
      <path d="M4.6 7.6Q5.2 3.3 10.6 2.5" fill="none" stroke="#fff" stroke-opacity=".95" stroke-width=".7" stroke-linecap="round"/>
      <path d="M17.6 3.6Q19.6 5 20.2 7" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".35" stroke-linecap="round"/>
      <path d="M2.1 9.2 A9.9 1.3 0 0 0 21.9 9.2 L21.9 8.6 A9.9 1.3 0 0 1 2.1 8.6 Z" fill="url(#${id}-rim)" fill-opacity=".9" stroke="${ink}" stroke-opacity="${big ? 0.4 : 0.9}" stroke-width="${line * 0.8}"/>
      <path d="M3.4 9.6 A8.8 .9 0 0 0 20.6 9.6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".25"/>`)}`;
}

export function cup(color, o = {}) {
  const x = EXPLODE.test(o.cls || '');
  return `<svg class="cup ${x ? 'cup-x' : ''} ${o.cls || ''}" viewBox="${x ? WIDE_VIEW : '-2 -6 28 34'}" aria-hidden="true">${cupArt(color, o)}</svg>`;
}
export const cupFor = (p, cls = '') => cup(flavor(p.field)[1], { cls, color2: p.field2 ? flavor(p.field2)[1] : '' });

// Toppings are small illustrations in the same style as the cup: a thin
// dark-brown outline, soft colour with one gentle shade, and a short white
// highlight. Each is drawn around (x, y) at size s; one unit is about the
// topping's half-width. Every SVG gets its own gradient ids so they never clash.
export function toppingDefs(id) {
  const lin = (name, a, b, angle = '0 0 1 1') => {
    const [x1, y1, x2, y2] = angle.split(' ');
    return `<linearGradient id="${id}-${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  };
  const rad = (name, a, b, c) => `<radialGradient id="${id}-${name}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
  return `<defs>
    ${lin('coco', '#ffffff', '#ebe1cb')}
    ${lin('aloe', '#eef8dc', '#b4d68b')}
    ${lin('grass', '#57463a', '#241a13')}
    ${lin('galaxy', '#8a7ae6', '#33267a')}
    ${lin('bean', '#a8392f', '#5e1813')}
    ${lin('flan', '#fae29a', '#e3a93f', '0 0 1 0')}
    ${lin('taro', '#cdb6e6', '#9572c0')}
    ${lin('sweet', '#ffc48a', '#e98a3d')}
    ${lin('mochi', '#ffffff', '#efe4d0', '0 0 0 1')}
    ${lin('dish', '#ffffff', '#ece3d2', '0 0 1 0')}
    ${lin('syrup', '#b9732f', '#5c2c0e')}
    ${lin('foamL', '#ffffff', '#f0e1c2', '0 0 0 1')}
    ${lin('bruL', '#7a3c10', '#f0cd84', '0 0 0 1')}
    ${rad('crystal', '#ffffff', '#f3ecdf', '#d7c8ab')}
    ${rad('gold', '#fff4bf', '#ecbd43', '#a8761b')}
    ${rad('caramel', '#e9a85b', '#b8692a', '#7a3c10')}
    ${rad('foam', '#ffffff', '#fbf3e3', '#e6d4b2')}
    ${rad('drop', '#ffffff', '#fdeef2', '#f3cddb')}
  </defs>`;
}

export const INK = '#2a1d16';
export const ink = (s) => `stroke="#3b2518" stroke-opacity=".12" stroke-width="${(0.06 * s).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`;
export const glint = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".11" stroke-linecap="round"/>`;
export const shadow = (x, y, s) => `<ellipse cx="${x}" cy="${y + 0.9 * s}" rx="${0.68 * s}" ry="${0.13 * s}" fill="#3b2518" fill-opacity=".14"/>`;

// Everything inside a topping is drawn at unit size, then moved and scaled
export const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// A soft rounded jelly cube with a lighter core you can see into
export const jelly = (fill, core, coreOpacity, opacity = 1, tilt = -10) => `
  <g transform="rotate(${tilt})" fill-opacity="${opacity}">
    <rect x="-.75" y="-.72" width="1.5" height="1.44" rx=".34" fill="${fill}" ${ink(1)}/>
    <rect x="-.42" y="-.38" width=".84" height=".76" rx=".2" fill="${core}" fill-opacity="${coreOpacity}"/>
    ${glint('M-.52 -.3 Q-.5 -.52 -.28 -.54')}
  </g>`;

export const PIECE = {
  coconut: (id, x, y, s) => at(x, y, s, jelly(`url(#${id}-coco)`, '#fff', 0.7, 0.97, -12)),
  aloe: (id, x, y, s) => at(x, y, s, `${jelly(`url(#${id}-aloe)`, '#f6fcec', 0.65, 0.95, 8)}<circle cx=".25" cy=".22" r=".08" fill="#fff" fill-opacity=".8"/>`),
  grass: (id, x, y, s) => at(x, y, s, jelly(`url(#${id}-grass)`, '#7a6553', 0.35, 1, -6)),
  galaxy: (id, x, y, s) => at(x, y, s, `${jelly(`url(#${id}-galaxy)`, '#b9adf5', 0.25, 1, 10)}
    <circle cx="-.2" cy=".25" r=".06" fill="#fff"/><circle cx=".3" cy="-.05" r=".05" fill="#fff"/>
    <path d="M.12 -.4l.05.13.13.05-.13.05-.05.13-.05-.13-.13-.05.13-.05z" fill="#fff"/>`),
  // Kidney-shaped beans with a little pale line where they joined the pod
  redbean: (id, x, y, s) => at(x, y, s, [[-0.36, 0.22, -25], [0.4, 0.28, 30], [0.02, -0.34, 5]].map(([bx, by, r]) => `
    <g transform="translate(${bx} ${by}) rotate(${r})">
      <path d="M-.42 -.05 Q-.42 -.3 -.12 -.3 Q.05 -.3 .12 -.22 Q.2 -.3 .3 -.28 Q.46 -.24 .44 0 Q.42 .28 0 .28 Q-.42 .28 -.42 -.05 Z" fill="url(#${id}-bean)" ${ink(1)}/>
      <path d="M.02 -.2 Q.08 -.14 .15 -.17" fill="none" stroke="#f2dccd" stroke-width=".07" stroke-linecap="round"/>
      ${glint('M-.3 -.06 Q-.28 -.18 -.15 -.2')}
    </g>`).join('')),
  // Flan with caramel on top, dripping a little down the sides
  pudding: (id, x, y, s) => at(x, y, s, `
    <path d="M-.58 -.38 L.58 -.38 L.82 .5 Q0 .74 -.82 .5 Z" fill="url(#${id}-flan)" ${ink(1)}/>
    <path d="M-.58 -.38 L.58 -.38 L.62 -.22 Q.5 -.18 .46 -.05 Q.4 .04 .36 -.12 Q.2 -.2 .05 -.16 Q-.05 .08 -.15 -.16 Q-.35 -.18 -.45 -.12 Q-.52 .02 -.58 -.2 Z" fill="#8f4b17"/>
    <ellipse cx="0" cy="-.38" rx=".58" ry=".16" fill="url(#${id}-caramel)" ${ink(1)}/>
    ${glint('M-.55 .05 L-.62 .38')}`),
  crystal: (id, x, y, s) => at(x, y, s, `
    <circle r=".76" fill="url(#${id}-crystal)" fill-opacity=".9" ${ink(1)}/>
    <circle cx=".1" cy=".12" r=".42" fill="#fff" fill-opacity=".35"/>
    ${glint('M-.45 -.15 Q-.42 -.45 -.12 -.52')}`),
  // Chewy little pillows: purple taro and orange sweet potato
  taroball: (id, x, y, s, n) => at(x, y, s, `
    <g transform="rotate(${n % 2 ? 18 : -14})">
      <rect x="-.68" y="-.46" width="1.36" height=".92" rx=".44" fill="url(#${id}-${n % 2 ? 'sweet' : 'taro'})" ${ink(1)}/>
      ${glint('M-.4 -.22 Q-.2 -.32 .05 -.3')}
    </g>`),
  mochi: (id, x, y, s) => at(x, y, s, `
    <path d="M-.86 .2 Q-.9 -.55 0 -.58 Q.9 -.55 .86 .2 Q.8 .52 0 .52 Q-.8 .52 -.86 .2 Z" fill="url(#${id}-mochi)" ${ink(1)}/>
    <g fill="#e9dcc4"><circle cx="-.3" cy="-.15" r=".05"/><circle cx=".2" cy="-.3" r=".04"/><circle cx=".42" cy=".05" r=".05"/><circle cx="-.05" cy=".18" r=".04"/></g>
    ${glint('M-.55 -.22 Q-.45 -.42 -.2 -.45')}`),
  golden: (id, x, y, s) => at(x, y, s, `
    <circle r=".78" fill="url(#${id}-gold)" ${ink(1)}/>
    ${glint('M-.45 -.18 Q-.4 -.45 -.12 -.5')}
    <path d="M.62 -.92l.08.22.22.08-.22.08-.08.22-.08-.22-.22-.08.22-.08z" fill="#fff6c8"/>`),
  // A clear drop of jelly with a sakura flower inside
  sakura: (id, x, y, s) => at(x, y, s, `
    <path d="M-.86 .42 Q-.92 -.82 0 -.82 Q.92 -.82 .86 .42 Q0 .66 -.86 .42 Z" fill="url(#${id}-drop)" fill-opacity=".9" ${ink(1)}/>
    <g transform="translate(0 -.06)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-.2" rx=".12" ry=".2" fill="#f29abb" transform="rotate(${a})"/>`).join('')}<circle r=".08" fill="#fff0a3"/></g>
    ${glint('M-.55 -.1 Q-.5 -.52 -.2 -.62')}`),
};

// Toppings that are not floating pieces get their own picture for chips and gift boxes
export const LAYER_ICON = {
  // A swirled dollop of cream cheese foam
  foam: (id) => `
    <path d="M-.92 .5 C-1 .05 -.62 -.12 -.38 -.15 C-.42 -.55 -.05 -.8 .18 -.95 C.14 -.6 .58 -.52 .52 -.16 C.85 -.12 1 .2 .9 .5 Q0 .72 -.92 .5 Z" fill="url(#${id}-foamL)" ${ink(1)}/>
    <path d="M-.5 .12 Q0 .3 .55 .1 M-.25 -.18 Q.1 -.05 .4 -.2" fill="none" stroke="#dcc6a0" stroke-width=".07" stroke-linecap="round"/>
    ${glint('M-.65 .25 Q-.7 0 -.45 -.08')}`,
  // Brown sugar syrup dripping down
  tiger: (id) => `
    <path d="M-.92 -.75 H.92 V-.42 Q.78 -.36 .74 -.05 Q.7 .5 .52 .5 Q.34 .5 .34 0 Q.3 -.24 .1 -.24 Q-.1 -.24 -.12 .3 Q-.16 .9 -.38 .9 Q-.6 .9 -.6 .3 Q-.62 -.3 -.92 -.36 Z" fill="url(#${id}-syrup)" ${ink(1)}/>
    ${glint('M-.42 .1 L-.44 .55')}${glint('M.48 -.05 L.47 .22')}`,
  // A white ramekin with a torched sugar top
  brulee: (id) => `
    <path d="M-.94 -.2 L-.84 .52 Q0 .74 .84 .52 L.94 -.2 Z" fill="url(#${id}-dish)" ${ink(1)}/>
    <g stroke="#ddd2bf" stroke-width=".06">${[-0.6, -0.3, 0, 0.3, 0.6].map((dx) => `<path d="M${dx} 0 L${dx * 0.92} .55"/>`).join('')}</g>
    <ellipse cx="0" cy="-.2" rx=".94" ry=".28" fill="url(#${id}-caramel)" ${ink(1)}/>
    <g fill="#5e2c0c" fill-opacity=".55"><ellipse cx="-.3" cy="-.22" rx=".14" ry=".05"/><ellipse cx=".35" cy="-.16" rx=".1" ry=".04"/><ellipse cx=".05" cy="-.3" rx=".08" ry=".03"/></g>
    ${glint('M-.55 -.3 Q-.35 -.38 -.12 -.38')}`,
};

export const PIECE_SLOTS = [[6.6, 12.6], [12, 11], [17.4, 12.6], [7, 15.4], [17, 15.4], [7.4, 18.3], [16.6, 18.3], [8.8, 11.6], [15.2, 11.6], [18.1, 20.2]];
export const PIECE_SIZE = 1.15;
