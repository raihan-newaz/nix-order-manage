import { type Appearance, type BuilderNode, type PageDocument, parseDocument } from './schema';
import { escapeHtml, validateWidget, widgets } from './registry';
import { documentForms } from './forms';
import { documentLoops, type LoopData, type LoopItem } from './loops';
import { renderShapeDivider } from './shapes';

const declarations = (values: Record<string, string>) => Object.keys(values).sort().map(key => `${key}:${values[key]}`).join(';');
const block = (selector: string, values: Record<string, string>) => Object.keys(values).length ? `${selector}{${declarations(values)}}` : '';

export type Region = 'main' | 'header' | 'footer' | 'landing';

const keyframeAnimations = `
@keyframes builderFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes builderFadeInUp { from { opacity: 0; transform: translate3d(0, 40px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
@keyframes builderFadeInDown { from { opacity: 0; transform: translate3d(0, -40px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
@keyframes builderFadeInLeft { from { opacity: 0; transform: translate3d(-40px, 0, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
@keyframes builderFadeInRight { from { opacity: 0; transform: translate3d(40px, 0, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
@keyframes builderZoomIn { from { opacity: 0; transform: scale3d(0.7, 0.7, 0.7); } to { opacity: 1; transform: scale3d(1, 1, 1); } }
@keyframes builderBounceIn { from, 20%, 40%, 60%, 80%, to { animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1); } 0% { opacity: 0; transform: scale3d(0.3, 0.3, 0.3); } 20% { transform: scale3d(1.1, 1.1, 1.1); } 40% { transform: scale3d(0.9, 0.9, 0.9); } 60% { opacity: 1; transform: scale3d(1.03, 1.03, 1.03); } 80% { transform: scale3d(0.97, 0.97, 0.97); } to { opacity: 1; transform: scale3d(1, 1, 1); } }
@keyframes builderSlideInLeft { from { transform: translate3d(-100%, 0, 0); visibility: visible; } to { transform: translate3d(0, 0, 0); } }
@keyframes builderSlideInRight { from { transform: translate3d(100%, 0, 0); visibility: visible; } to { transform: translate3d(0, 0, 0); } }
`;

const fontFaceDeclarations = `
@font-face{font-family:'Hind Siliguri';font-style:normal;font-weight:300;src:url('/fonts/hind-siliguri-bengali-300.woff2') format('woff2');font-display:swap;}
@font-face{font-family:'Hind Siliguri';font-style:normal;font-weight:400;src:url('/fonts/hind-siliguri-bengali-400.woff2') format('woff2');font-display:swap;}
@font-face{font-family:'Hind Siliguri';font-style:normal;font-weight:500;src:url('/fonts/hind-siliguri-bengali-500.woff2') format('woff2');font-display:swap;}
@font-face{font-family:'Hind Siliguri';font-style:normal;font-weight:600;src:url('/fonts/hind-siliguri-bengali-600.woff2') format('woff2');font-display:swap;}
@font-face{font-family:'Hind Siliguri';font-style:normal;font-weight:700;src:url('/fonts/hind-siliguri-bengali-700.woff2') format('woff2');font-display:swap;}
`;

export function compileCss(doc: PageDocument, region: Region = 'main'): string {
  const scope = `[data-builder-page="${region}-${doc.slug}"]`;
  const selectorFor = (id: string) => `${scope} [data-builder-id="${id}"]`;
  const defaultFont = doc.settings.lang === 'bn'
    ? "'Hind Siliguri', 'Tiro Bangla', system-ui, -apple-system, sans-serif"
    : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hind Siliguri', sans-serif";

  const css: string[] = [
    fontFaceDeclarations,
    keyframeAnimations,
    `${scope}{font-family:${defaultFont};color:var(--text-primary,#172d28);line-height:1.5;overflow-wrap:break-word;position:relative}`,
    `${scope},${scope} *{box-sizing:border-box}${scope} img,${scope} video{max-width:100%;height:auto}${scope} figure{margin:0}${scope} :focus-visible{outline:2px solid currentColor;outline-offset:4px}`,
    `${scope} [data-builder-type="button"]{display:inline-block;padding:12px 24px;background:var(--brand-primary,#176b53);color:white;text-decoration:none;border-radius:6px;transition:all 0.2s ease}`,
    `${scope} [data-builder-type="button"]:hover{filter:brightness(1.08)}`,
    `${scope} [data-builder-type="notice"]{padding:20px;border-inline-start:4px solid var(--brand-primary,#176b53);background:#f0f5f2;border-radius:4px}`,
    `${scope} summary{cursor:pointer}${scope} [hidden]{display:none!important}`,
    `${scope} [data-builder-type="form-field"]{display:flex;flex-direction:column;gap:6px}${scope} input:not([type=radio]):not([type=checkbox]),${scope} select,${scope} textarea{font:inherit;padding:10px 14px;border:1px solid #b8c9bf;border-radius:6px;max-width:100%}${scope} input[type=checkbox]{align-self:flex-start}${scope} [data-builder-type="form-submit"]{font:inherit;padding:12px 24px;background:var(--brand-primary,#176b53);color:white;border:0;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s ease}${scope} fieldset{border:0;padding:0;margin:0;display:contents}${scope} .builder-honeypot{position:absolute;inset-inline-start:-10000px;width:1px;height:1px;overflow:hidden}`,
    `${scope} .builder-radio-card:has(input:checked), ${scope} .builder-radio-card input:checked ~ span{font-weight:600}`,
    `${scope} .builder-radio-card:has(input:checked){border-color:#0f766e!important;background:#ecfdf5!important;box-shadow:0 0 0 1px #0f766e}`,
    `${scope} .builder-radio-card:hover{border-color:#cbd5e1;background:#f1f5f9}`,
    `${scope} [data-builder-type="container"], ${scope} [data-builder-type="section"], ${scope} [data-builder-type="flex"]{position:relative}`,
    `${scope} .builder-offer-price{display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;padding:24px 16px;margin:0 auto;max-width:480px}`,
    `${scope} .builder-offer-highlight{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;border:1px solid #fcd34d;padding:4px 14px;border-radius:999px;font-size:.82rem;font-weight:700;letter-spacing:.02em;box-shadow:0 2px 8px rgba(217,119,6,0.15)}`,
    `${scope} .builder-offer-price-meta{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}`,
    `${scope} .builder-offer-regular-wrap{display:inline-flex;align-items:baseline;gap:6px}`,
    `${scope} .builder-offer-label{font-size:.88rem;color:#64748b;font-weight:600}`,
    `${scope} .builder-offer-regular, ${scope} .builder-offer-price-meta del{font-size:1.18rem;font-weight:700;color:#ef4444;opacity:.78;text-decoration:line-through;text-decoration-thickness:2.5px;text-decoration-color:#dc2626}`,
    `${scope} .builder-offer-discount-pill, ${scope} .builder-offer-price-meta strong{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;border:none;border-radius:999px;padding:5px 13px;font-size:.84rem;font-weight:800;letter-spacing:.03em;box-shadow:0 4px 12px rgba(16,185,129,0.3);text-transform:uppercase}`,
    `${scope} .builder-discount-tag{opacity:.85;font-size:.76rem;font-weight:600}`,
    `${scope} .builder-offer-price-oval{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:min(100%,320px);padding:24px 36px;border-radius:50%/42%;background:radial-gradient(ellipse at 50% 30%,#ffffff 0%,#f0fdf4 65%,#dcfce7 100%);box-shadow:0 14px 40px rgba(16,185,129,.18), 0 0 0 3px #10b981, inset 0 2px 10px rgba(255,255,255,.9);isolation:isolate;cursor:default;transition:transform .3s ease}`,
    `${scope} .builder-offer-price-oval:hover{transform:scale(1.02)}`,
    `${scope} .builder-offer-price-oval:before{content:'';position:absolute;inset:-8px;border:2.5px dashed #059669;border-radius:50%/42%;animation:builderOfferPulse 3s cubic-bezier(.4,0,.2,1) infinite;z-index:-1;opacity:.8}`,
    `${scope} .builder-offer-price-oval:after{content:'';position:absolute;inset:-15px;border:1.5px solid rgba(16,185,129,.35);border-radius:50%/42%;animation:builderOfferPulse 3s cubic-bezier(.4,0,.2,1) infinite 1.5s;z-index:-2;opacity:.5}`,
    `${scope} .builder-oval-glow{position:absolute;inset:0;border-radius:50%/42%;background:radial-gradient(circle,rgba(52,211,153,.2) 0%,transparent 70%);filter:blur(8px);z-index:-1;pointer-events:none}`,
    `${scope} .builder-offer-oval-label, ${scope} .builder-offer-price-oval span{font-size:.92rem;font-weight:700;color:#065f46;letter-spacing:.02em;margin-bottom:2px}`,
    `${scope} .builder-offer-oval-price, ${scope} .builder-offer-price-oval b{font-size:clamp(2.2rem,6vw,3.6rem);font-weight:900;line-height:1.1;background:linear-gradient(135deg,#065f46,#047857);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}`,
    `${scope} @keyframes builderOfferPulse{0%{transform:scale(0.98);opacity:.9}50%{transform:scale(1.05);opacity:.4}100%{transform:scale(0.98);opacity:.9}}`,
    `${scope} .builder-offer-price{gap:24px;padding:12px 0;max-width:100%;color:#111;font-family:'Hind Siliguri',sans-serif}`,
    `${scope} [data-site-phone="true"]{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}`,
    `${scope} [data-site-phone="true"]>i{margin:0!important;line-height:1;flex:none}`,
    `${scope} [data-site-phone="true"]>span{display:inline-flex;align-items:center;line-height:1.35}`,
    `${scope} [data-site-phone="true"]>span>svg{display:block;width:16px;height:16px;flex:none;margin-right:6px}`,
    `${scope} .builder-price-line{font-family:inherit;font-size:clamp(1.15rem,2.8vw,1.8rem);font-weight:700;line-height:1.6;display:flex;align-items:baseline;justify-content:center;gap:.22em;flex-wrap:wrap}`,
    `${scope} .builder-price-cross{position:relative;display:inline-block;color:var(--offer-strike-color,#ff1717);text-decoration:none;white-space:nowrap}`,
    `${scope} .builder-price-cross svg{position:absolute;inset:-12% -6%;width:112%;height:124%;overflow:visible;pointer-events:none}`,
    `${scope} .builder-price-cross path{fill:none;stroke:var(--offer-strike-color,#ff1717);stroke-width:3;stroke-linecap:round;stroke-dasharray:120;stroke-dashoffset:0;animation:builderPriceCross var(--offer-animation-duration,3.6s) ease-in-out infinite}`,
    `${scope} .builder-price-cross .builder-cross-second{animation-delay:.16s}`,
    `${scope} .builder-price-static .builder-price-cross path{animation:none;stroke-dashoffset:0;opacity:1}`,
    `${scope} .builder-price-sale{color:var(--offer-sale-color,#22c33e);font-size:inherit;font-weight:800;white-space:nowrap}`,
    `@keyframes builderPriceCross{0%{stroke-dashoffset:120;opacity:1}24%,82%{stroke-dashoffset:0;opacity:1}94%,100%{stroke-dashoffset:0;opacity:0}}`,
    `@media(prefers-reduced-motion:reduce){${scope} .builder-price-cross path{animation:none;stroke-dashoffset:0;opacity:1}}`,
    `${scope} .builder-icon-wrapper{display:inline-flex;align-items:center;justify-content:center;font-size:2rem;color:var(--brand-primary,#176b53)}`,
    `${scope} .elementor-headline{display:inline-flex;align-items:center;justify-content:center;flex-wrap:wrap;position:relative;font-family:inherit;margin:0;line-height:1.4;text-align:center}`,
    `${scope} .elementor-headline-plain-text{color:inherit;font-size:inherit;font-weight:inherit}`,
    `${scope} .elementor-headline-dynamic-wrapper{position:relative;display:inline-block;padding:0.1em 0.35em;margin:0 0.15em;z-index:1}`,
    `${scope} .elementor-headline-dynamic-text{position:relative;z-index:2;font-weight:800;color:inherit}`,
    `${scope} .elementor-headline-svg{position:absolute;top:-18%;left:-10%;width:120%;height:136%;pointer-events:none;z-index:1;fill:none;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1600;stroke-dashoffset:1600;animation:builderHeadlineStroke 2.6s cubic-bezier(0.65,0,0.35,1) infinite alternate}`,
    `${scope} @keyframes builderHeadlineStroke{0%{stroke-dashoffset:1600}40%,100%{stroke-dashoffset:0}}`
  ];

  css.push(`${scope}{${Object.keys(doc.tokens).sort().map(key => `--${key}:${doc.tokens[key]}`).join(';')}}`);

  const entries: Array<[string, Appearance]> = [];
  const customCssBlocks: string[] = [];

  const visit = (nodes: BuilderNode[]) => {
    for (const node of nodes) {
      for (const name of node.classes) entries.push([selectorFor(node.id), doc.classes[name]]);
      entries.push([selectorFor(node.id), node]);
      if (node.advanced?.customCss) {
        const processed = String(node.advanced.customCss).replace(/selector/g, selectorFor(node.id));
        customCssBlocks.push(processed);
      }
      visit(node.children);
    }
  };

  visit(doc.rootNodes);
  Object.values(doc.components).forEach(component => visit(component.nodes));

  const emit = (selector: string, appearance: Appearance) => {
    css.push(block(selector, appearance.styles));
    for (const [state, values] of Object.entries(appearance.states)) {
      css.push(block(`${selector}:${state}`, values));
    }
  };

  entries.forEach(([selector, appearance]) => emit(selector, appearance));

  for (const bp of [...doc.breakpoints].sort((a, b) => b.maxWidth - a.maxWidth)) {
    css.push(`@media(max-width:${bp.maxWidth}px){${entries.map(([selector, appearance]) => block(selector, appearance.responsiveStyles[bp.id] || {})).join('')}}`);
  }

  if (customCssBlocks.length) {
    css.push(...customCssBlocks);
  }

  css.push(`@media(prefers-reduced-motion:reduce){${scope} *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`);
  return css.join('\n');
}

export interface RenderOptions {
  editor?: boolean;
  siteName?: string;
  sitePhone?: string;
  year?: string;
  forms?: Record<string, { action: string; token: string }>;
  loops?: LoopData;
  region?: Region;
  header?: Pick<RenderResult, 'html' | 'css'>;
  footer?: Pick<RenderResult, 'html' | 'css'>;
}

export interface RenderResult {
  html: string;
  css: string;
  warnings: string[];
  document: PageDocument;
}

export function renderPage(input: unknown, options: RenderOptions = {}): RenderResult {
  const doc = parseDocument(input);
  documentForms(doc);
  documentLoops(doc);

  const context: Record<string, string> = {
    'page.title': doc.title,
    'page.slug': doc.slug,
    'site.name': options.siteName || 'NIX',
    'date.year': options.year || String(new Date().getFullYear())
  };
  const supportPhone = /^(?:\+?88)?01[3-9]\d{8}$/.test(options.sitePhone || '') ? options.sitePhone! : '';
  const supportWhatsApp = supportPhone ? `88${supportPhone.replace(/^(?:\+?88)/, '').replace(/\D/g, '')}` : '';

  const warnings: string[] = [];
  let lastHeading = 0;

  const render = (nodes: BuilderNode[], owner?: string, item?: LoopItem): string => nodes.map(original => {
    validateWidget(original);
    if (original.hidden && !options.editor) return '';
    const node = { ...original, props: { ...original.props } };
    const usesSupportPhone = Object.values(node.props).some(value => typeof value === 'string' && (value.includes('{{site.phone}}') || value.includes('{{site.whatsapp}}')));
    if (usesSupportPhone && !supportPhone && !options.editor) return '';
    if (usesSupportPhone) {
      for (const [key, value] of Object.entries(node.props)) {
        if (typeof value === 'string') node.props[key] = value.split('{{site.phone}}').join(supportPhone || 'Storefront Settings-এ নম্বর দিন').split('{{site.whatsapp}}').join(supportWhatsApp || '');
      }
      if (!supportPhone) { node.props.href = '#'; node.props.url = '#'; }
    }

    for (const [key, source] of Object.entries(node.bindings)) {
      node.props[key] = source.startsWith('item.')
        ? item?.[source.slice(5) as keyof LoopItem] ?? (options.editor ? node.props[key] : '')
        : context[source] || '';
    }

    if (node.type === 'image' && !node.props.alt) {
      warnings.push(`${node.name}: add alternative text or mark the image decorative.`);
    }
    if (node.type === 'heading') {
      const level = Number(String(node.props.level).slice(1));
      if (level > lastHeading + 1) warnings.push(`${node.name}: heading hierarchy skips a level.`);
      lastHeading = level;
    }

    const attrs = ` data-builder-id="${node.id}" data-builder-type="${node.type}"${usesSupportPhone ? ' data-site-phone="true"' : ''}${owner ? ` data-builder-owner="${owner}"` : ''}${node.hidden ? ' hidden' : ''}${Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}`;
    const widget = widgets.get(node.type);

    if (!widget) return options.editor ? `<div${attrs} role="note">Unavailable widget: ${escapeHtml(node.type)}</div>` : '';

    let children: string;
    if (node.type === 'loop') {
      const records = options.loops?.[node.id] || [];
      children = records.length
        ? records.slice(0, Number(node.props.limit)).map(record => render(node.children, owner, record)).join('')
        : options.editor
          ? `<p data-builder-empty>No matching records. Edit the item template below.</p>${render(node.children, owner)}`
          : `<p>${escapeHtml(node.props.emptyMessage)}</p>`;
    } else {
      children = node.type === 'component'
        ? render(doc.components[String(node.props.component)].nodes, owner || node.id, item)
        : render(node.children, owner, item);
    }

    let topShapeHtml = '';
    let bottomShapeHtml = '';
    if (node.shapeDividers?.top?.type) {
      topShapeHtml = renderShapeDivider(node.shapeDividers.top.type, 'top', node.shapeDividers.top);
    }
    if (node.shapeDividers?.bottom?.type) {
      bottomShapeHtml = renderShapeDivider(node.shapeDividers.bottom.type, 'bottom', node.shapeDividers.bottom);
    }

    const combinedChildren = `${topShapeHtml}${children || (options.editor && widget.children ? '<div data-builder-empty>Drop elements here</div>' : '')}${bottomShapeHtml}`;

    try {
      return widget.render(node, combinedChildren, attrs, { form: options.forms?.[node.id] });
    } catch {
      warnings.push(`${node.name}: unable to render this element`);
      return options.editor ? `<div${attrs}>Unable to render this element</div>` : '';
    }
  }).join('');

  const region = options.region || 'main';
  const content = render(doc.rootNodes);
  // A footer/header widget already supplies its landmark; do not nest another one.
  const hasLandmark = (region === 'header' || region === 'footer') && content.includes('<' + region + ' ');
  const tag = region === 'landing' || hasLandmark ? 'div' : region;
  const html = `<${tag} data-builder-page="${region}-${doc.slug}" lang="${doc.settings.lang}" dir="${doc.settings.direction}">${content}</${tag}>`;
  return { html, css: compileCss(doc, region), warnings, document: doc };
}

export function renderHtml(input: unknown, options: RenderOptions = {}): string {
  const result = renderPage(input, options);
  const doc = result.document;
  return `<!doctype html><html lang="${doc.settings.lang}" dir="${doc.settings.direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.seo.title || doc.title)}</title><meta name="description" content="${escapeHtml(doc.seo.description)}">${doc.seo.noindex || options.editor ? '<meta name="robots" content="noindex,nofollow">' : ''}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Lato:wght@300;400;700&family=Montserrat:wght@300;400;500;600;700;800&family=Open+Sans:wght@300;400;500;600;700&family=Oswald:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Tiro+Bangla:ital@0;1&display=swap"><link rel="stylesheet" href="/eicons/css/elementor-icons.min.css"><link rel="stylesheet" href="/font-awesome/css/all.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style>body{margin:0}${options.header?.css || ''}${result.css}${options.footer?.css || ''}</style><script src="/api/builder/runtime.js" defer></script></head><body>${options.header?.html || ''}${result.html}${options.footer?.html || ''}</body></html>`;
}
