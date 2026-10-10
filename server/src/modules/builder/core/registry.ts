import type { BuilderNode } from './schema';
import { safeUrl } from './schema';
import { fieldOptions, fieldTypes } from './forms';

export type Control = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'wysiwyg' | 'number' | 'slider' | 'select' | 'select2' | 'choose' | 'switch' | 'color' | 'url' | 'media' | 'gallery' | 'icons' | 'repeater' | 'dimensions' | 'code';
  options?: string[] | Array<{ label: string; value: string; icon?: string }>;
  unit?: string[];
  dynamic?: boolean;
  min?: number;
  max?: number;
  step?: number;
};

export interface WidgetDefinition {
  type: string;
  name: string;
  category: string;
  version: number;
  children: boolean;
  // Widget defaults deliberately accept heterogeneous JSON values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaults: Record<string, any>;
  controls: Control[];
  render: (node: BuilderNode, children: string, attributes: string, context?: { form?: { action: string; token: string } }) => string;
  migrate?: (node: BuilderNode) => BuilderNode;
}

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export const urlAttribute = (value: unknown) => safeUrl(String(value || '')) ? escapeHtml(value) : '';

const text = (key = 'text', label = 'Text'): Control => ({ key, label, type: 'text', dynamic: true });
const select = (key: string, label: string, options: string[]): Control => ({ key, label, type: 'select', options });

export class WidgetRegistry {
  private readonly definitions = new Map<string, WidgetDefinition>();

  register(definition: WidgetDefinition) {
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(definition.type) || this.definitions.has(definition.type)) {
      throw new Error(`Invalid or duplicate widget registration: ${definition.type}`);
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: string) {
    return this.definitions.get(type);
  }

  all() {
    return [...this.definitions.values()];
  }
}

export const widgets = new WidgetRegistry();

const add = (
  type: string,
  name: string,
  category: string,
  defaults: WidgetDefinition['defaults'],
  controls: Control[],
  render: WidgetDefinition['render'],
  children = false
) => widgets.register({ type, name, category, version: 1, defaults, controls, render, children });

// 1. Layout Elements
for (const type of ['container', 'flex', 'grid', 'section', 'column']) {
  add(
    type,
    type === 'container' ? 'Container' : type === 'flex' ? 'Flex layout' : type === 'grid' ? 'Grid layout' : type === 'section' ? 'Section' : 'Column',
    'Layout',
    { tag: type === 'section' ? 'section' : 'div' },
    [select('tag', 'HTML Tag', ['div', 'section', 'main', 'article', 'aside', 'header', 'footer', 'nav'])],
    (n, c, a) => {
      const tag = ['div', 'section', 'main', 'article', 'aside', 'header', 'footer', 'nav'].includes(String(n.props.tag)) ? n.props.tag : 'div';
      return `<${tag}${a}>${c}</${tag}>`;
    },
    true
  );
}

export function renderContentWithSvg(raw: unknown): string {
  const str = String(raw ?? '');
  if (!str.includes('<svg')) return escapeHtml(str);
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /<svg[\s\S]*?<\/svg>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(str.slice(lastIndex, match.index)));
    }
    parts.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(escapeHtml(str.slice(lastIndex)));
  }
  return parts.join('');
}

// 2. Heading & Basic Typography
add('heading', 'Heading', 'Basic', { text: 'Your heading', level: 'h2', size: 'default', align: 'left' }, [
  text(),
  select('level', 'Heading level', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p']),
  select('size', 'Size', ['default', 'small', 'medium', 'large', 'xl', 'xxl']),
  select('align', 'Alignment', ['left', 'center', 'right', 'justify'])
], (n, _, a) => {
  const tag = /^(h[1-6]|div|span|p)$/.test(String(n.props.level)) ? n.props.level : 'h2';
  return `<${tag}${a}>${renderContentWithSvg(n.props.text)}</${tag}>`;
});

for (const [type, name, tag] of [
  ['text', 'Text', 'span'],
  ['paragraph', 'Paragraph', 'p'],
  ['blockquote', 'Blockquote', 'blockquote'],
  ['code', 'Code block', 'pre'],
  ['badge', 'Badge', 'span'],
  ['text-editor', 'Text Editor', 'div']
] as const) {
  add(type, name, 'Basic', { text: 'Write something meaningful.' }, [{ ...text(), type: 'textarea' }], (n, _, a) => {
    return `<${tag}${a}>${renderContentWithSvg(n.props.text)}</${tag}>`;
  });
}

add('html', 'Custom HTML', 'Advanced', { html: '', content: '' }, [
  { key: 'html', label: 'HTML Code', type: 'textarea' },
  { key: 'content', label: 'Content', type: 'textarea' }
], (n, _, a) => {
  const code = String(n.props.html || n.props.content || '');
  return `<div${a}>${code}</div>`;
});

add('offer-price', 'Offer Price', 'Storefront', {
  regularLabel: 'রেগুলার মূল্য', regularPrice: '১,৮৫০', currencyLabel: 'টাকা',
  offerLabel: 'অফার মূল্য মাত্র', offerPrice: '১,৩৯০', discount: '',
  highlight: '', animationStyle: 'cross', animationDuration: 3.6,
  strikeColor: '#ff1717', saleColor: '#22c33e',
}, [
  text('regularLabel', 'Regular price label'), text('regularPrice', 'Regular price'), text('currencyLabel', 'Currency label'),
  text('offerLabel', 'Offer label'), text('offerPrice', 'Offer price'),
  text('discount', 'Discount badge'), text('highlight', 'Highlight / Top tag'),
  select('animationStyle', 'Price animation', ['cross', 'single', 'none']),
  { key: 'animationDuration', label: 'Animation duration (seconds)', type: 'number', min: 1, max: 10, step: 0.1 },
  { key: 'strikeColor', label: 'Strike color', type: 'color' },
  { key: 'saleColor', label: 'Offer price color', type: 'color' },
], (n, _, a) => {
  const label = (key: string, fallback: string) => escapeHtml(n.props[key] === undefined ? fallback : n.props[key]);
  const price = (key: string) => escapeHtml(String(n.props[key] ?? '').replace(/^[৳\s]+/, ''));
  const color = (value: unknown, fallback: string) => /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : fallback;
  const duration = Math.min(10, Math.max(1, Number(n.props.animationDuration) || 3.6));
  const animation = ['cross', 'single', 'none'].includes(String(n.props.animationStyle)) ? String(n.props.animationStyle) : 'cross';
  const lines = `<svg aria-hidden="true" viewBox="0 0 100 60" preserveAspectRatio="none"><path class="builder-cross-first" d="M4 5 Q48 20 96 55"/>${animation === 'cross' || animation === 'none' ? '<path class="builder-cross-second" d="M3 55 Q52 18 97 5"/>' : ''}</svg>`;
  const highlightHtml = n.props.highlight ? `<div class="builder-offer-highlight"><span>✦ ${escapeHtml(n.props.highlight)}</span></div>` : '';
  const discountHtml = n.props.discount ? `<span class="builder-offer-discount-pill"><span class="builder-discount-tag">Save</span><b>${escapeHtml(n.props.discount)}</b></span>` : '';
  return `<div${a} class="builder-offer-price${animation === 'none' ? ' builder-price-static' : ''}" style="--offer-strike-color:${color(n.props.strikeColor, '#ff1717')};--offer-sale-color:${color(n.props.saleColor, '#22c33e')};--offer-animation-duration:${duration}s">${highlightHtml}<div class="builder-price-line"><span>${label('regularLabel', 'রেগুলার মূল্য')}</span> <del class="builder-price-cross">${price('regularPrice')}${lines}</del> <span>${label('currencyLabel', 'টাকা')}</span></div><div class="builder-price-line"><span>${label('offerLabel', 'অফার মূল্য মাত্র')}</span> <b class="builder-price-sale">${price('offerPrice')}</b> <span>${label('currencyLabel', 'টাকা')}</span></div>${discountHtml}</div>`;

});

add('animated-headline', 'Animated Headline', 'General', {
  beforeText: 'রেগুলার মূল্য',
  highlightedText: '১৬৫০',
  afterText: 'টাকা',
  marker: 'circle',
  markerColor: '#e11d48',
  tag: 'h3',
  link: ''
}, [
  text('beforeText', 'Before Text'),
  text('highlightedText', 'Highlighted Text'),
  text('afterText', 'After Text'),
  select('marker', 'Marker Shape', ['x', 'underline', 'underline_zigzag', 'circle', 'curly']),
  text('markerColor', 'Marker Color (Hex / CSS)'),
  select('tag', 'HTML Tag', ['h1', 'h2', 'h3', 'h4', 'div', 'p']),
  { key: 'link', label: 'Link URL', type: 'url' }
], (n, _, a) => {
  const marker = String(n.props.marker || 'circle');
  const tag = /^(h[1-6]|div|p)$/.test(String(n.props.tag)) ? n.props.tag : 'h3';
  const color = n.props.markerColor ? ` stroke="${escapeHtml(n.props.markerColor)}"` : ' stroke="#e11d48"';
  let svgPath = '';
  if (marker === 'x') {
    svgPath = '<path d="M497.4,23.9C301.6,40,155.9,80.6,4,144.4"></path><path d="M14.1,27.6c204.5,20.3,393.8,74,467.3,111.7"></path>';
  } else if (marker === 'underline_zigzag') {
    svgPath = '<path d="M9.3,127.3c49.3-3,150.7-7.6,199.7-7.4c121.9,0.4,189.9,0.4,282.3,7.2C380.1,129.6,181.2,130.6,70,139 c82.6-2.9,254.2-1,335.9,1.3c-56,1.4-137.2-0.3-197.1,9"></path>';
  } else if (marker === 'underline') {
    svgPath = '<path d="M7.7,145.6C109,125,299.9,116.2,401,121.3c42.1,2.2,87.6,11.8,87.3,25.7"></path>';
  } else if (marker === 'curly') {
    svgPath = '<path d="M3,146.1c17.1-8.8,33.5-2.7,49-2.2c18.1,0.6,35.8-4.4,53.9-4.3c18,0.1,35.9-4.6,53.8-4.1c18,0.5,36-4.9,54-4.5 c17.9,0.4,35.9-5.2,53.8-4.7c17.9,0.5,35.9-5.4,53.8-5c17.9,0.4,35.9-5.7,53.8-5.3c17.9,0.4,35.9-5.9,53.8-5.6 c17.9,0.3,35.9-6.1,53.8-5.9"></path>';
  } else {
    // circle / oval
    svgPath = '<path d="M325,18C228.7-8.3,118.5,8.3,78,21C22.4,38.4,4.6,54.6,5.6,77.6c1.4,32.4,52.2,54,142.6,58.6 c55,2.8,170.5,2.8,237.4-4.8c66.9-7.6,108.5-23.3,108.8-49.8C494.8,40.1,415.6,14.4,308,8.4"></path>';
  }
  const svg = `<svg class="elementor-headline-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 150" preserveAspectRatio="none"${color}>${svgPath}</svg>`;
  const inner = `<span class="elementor-headline-plain-text">${escapeHtml(n.props.beforeText || '')} </span><span class="elementor-headline-dynamic-wrapper"><span class="elementor-headline-dynamic-text">${escapeHtml(n.props.highlightedText || '')}</span>${svg}</span><span class="elementor-headline-plain-text"> ${escapeHtml(n.props.afterText || '')}</span>`;
  const content = n.props.link ? `<a href="${urlAttribute(n.props.link)}" style="color:inherit;text-decoration:none;">${inner}</a>` : inner;
  return `<${tag}${a} class="elementor-headline e-animated">${content}</${tag}>`;
});

export function formatIconClass(icon: unknown, fallback?: string): string {
  const str = String(icon || fallback || '').trim();
  if (!str) return '';
  if (str.includes(' ') || str.startsWith('eicon-') || str.startsWith('fa-')) {
    return str;
  }
  return `fas fa-${str}`;
}

// 3. Buttons & Links
for (const type of ['link', 'button']) {
  add(type, type === 'button' ? 'Button' : 'Link', 'Basic', {
    text: 'Click here',
    href: '#',
    newTab: false,
    type: 'default',
    size: 'medium',
    icon: '',
    iconPosition: 'before',
    iconSpacing: 8
  }, [
    text(),
    { key: 'href', label: 'Destination URL', type: 'url', dynamic: true },
    { key: 'newTab', label: 'Open in new tab', type: 'switch' },
    select('type', 'Button Type', ['default', 'info', 'success', 'warning', 'danger']),
    select('size', 'Size', ['small', 'medium', 'large', 'xl']),
    text('icon', 'Icon (FontAwesome / SVG)'),
    select('iconPosition', 'Icon Position', ['before', 'after']),
    { key: 'iconSpacing', label: 'Icon Spacing (px)', type: 'number' }
  ], (n, _, a) => {
    const iconClass = formatIconClass(n.props.icon);
    const spacing = Number(n.props.iconSpacing ?? 8);
    const iconMargin = iconClass && n.props.text ? (n.props.iconPosition === 'after' ? `margin-left:${spacing}px;` : `margin-right:${spacing}px;`) : '';
    const iconHtml = iconClass ? `<i class="${escapeHtml(iconClass)}"${iconMargin ? ` style="${iconMargin}"` : ''}></i>` : '';
    const textHtml = n.props.text ? `<span>${renderContentWithSvg(n.props.text)}</span>` : '';
    const content = n.props.iconPosition === 'after'
      ? `${textHtml}${iconHtml}`
      : `${iconHtml}${textHtml}`;
    const url = n.props.href || n.props.url || '#';
    return `<a${a} href="${urlAttribute(url)}"${n.props.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${content || 'Click here'}</a>`;
  });
}

// 4. Media Elements
add('image', 'Image', 'Basic', { src: '', alt: '', caption: '', link: '', aspectRatio: 'auto', customAspectRatio: '', objectFit: 'cover' }, [
  { key: 'src', label: 'Choose Image', type: 'media', dynamic: true },
  text('alt', 'Alt Text'),
  text('caption', 'Caption'),
  { key: 'link', label: 'Link URL', type: 'url' },
  {
    key: 'aspectRatio',
    label: 'Aspect Ratio',
    type: 'select',
    options: [
      { label: 'Auto (Original)', value: 'auto' },
      { label: '1:1 (Square)', value: '1/1' },
      { label: '4:5 (Portrait / Instagram)', value: '4/5' },
      { label: '3:4 (Fashion / Portrait)', value: '3/4' },
      { label: '16:9 (Landscape)', value: '16/9' },
      { label: '9:16 (Story / Mobile)', value: '9/16' },
      { label: '4:3 (Classic)', value: '4/3' },
      { label: '21:9 (Ultrawide Banner)', value: '21/9' },
      { label: 'Custom', value: 'custom' }
    ]
  },
  text('customAspectRatio', 'Custom Ratio (e.g. 16/9, 3/2, 1.2)'),
  {
    key: 'objectFit',
    label: 'Object Fit',
    type: 'select',
    options: [
      { label: 'Cover', value: 'cover' },
      { label: 'Contain', value: 'contain' },
      { label: 'Fill', value: 'fill' },
      { label: 'Scale Down', value: 'scale-down' },
      { label: 'None', value: 'none' }
    ]
  }
], (n, _, a) => {
  const rawRatio = n.props.aspectRatio === 'custom' && n.props.customAspectRatio
    ? n.props.customAspectRatio
    : (n.props.aspectRatio && n.props.aspectRatio !== 'auto' ? n.props.aspectRatio : '');
  const objectFit = n.props.objectFit || 'cover';
  const ratioStyle = rawRatio ? `aspect-ratio:${rawRatio};` : '';
  const img = n.props.src
    ? `<img src="${urlAttribute(n.props.src)}" alt="${escapeHtml(n.props.alt)}" loading="lazy" decoding="async" style="width:100%;height:${rawRatio ? '100%' : 'auto'};display:block;border-radius:inherit;${ratioStyle}object-fit:${objectFit};">`
    : `<div style="background:#f1f5f9;padding:32px 16px;text-align:center;color:#94a3b8;border-radius:8px;border:1px dashed #cbd5e1;${ratioStyle}"><i class="eicon-image-bold" style="font-size:32px;display:block;margin-bottom:6px;"></i><span style="font-size:12px;">No image selected</span></div>`;
  const wrapped = n.props.link ? `<a href="${urlAttribute(n.props.link)}" style="display:block;color:inherit;text-decoration:none;">${img}</a>` : img;
  return `<figure${a}>${wrapped}${n.props.caption ? `<figcaption style="margin-top:6px;font-size:12px;color:#64748b;">${escapeHtml(n.props.caption)}</figcaption>` : ''}</figure>`;
});

for (const type of ['video', 'audio']) {
  add(type, type === 'video' ? 'Video' : 'Audio', 'Basic', { src: '', autoplay: false, loop: false, controls: true }, [
    { key: 'src', label: 'Media URL', type: 'url', dynamic: true },
    { key: 'autoplay', label: 'Autoplay', type: 'switch' },
    { key: 'loop', label: 'Loop', type: 'switch' },
    { key: 'controls', label: 'Player controls', type: 'switch' }
  ], (n, _, a) => {
    const src = String(n.props.src || '');
    let embedUrl = '';
    if (type === 'video') try {
      const url = new URL(src);
      const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
      const segments = url.pathname.split('/').filter(Boolean);
      const youtubeId = host === 'youtu.be' ? segments[0] : host === 'youtube.com' ? (segments[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(segments[0]) ? segments[1] : '') : host === 'youtube-nocookie.com' && segments[0] === 'embed' ? segments[1] : '';
      if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
        const loopParam = n.props.loop ? `&loop=1&playlist=${youtubeId}` : '';
        const autoplayParam = n.props.autoplay ? `&autoplay=1&mute=1&playsinline=1` : '';
        embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&controls=${n.props.controls === false ? 0 : 1}${autoplayParam}${loopParam}`;
      }
      const vimeoId = segments[segments.length - 1] || '';
      if ((host === 'vimeo.com' || host === 'player.vimeo.com') && /^\d+$/.test(vimeoId)) {
        const vimeoLoop = n.props.loop ? '&loop=1' : '';
        const vimeoAutoplay = n.props.autoplay ? '&autoplay=1&muted=1' : '';
        embedUrl = `https://player.vimeo.com/video/${vimeoId}?${vimeoAutoplay}${vimeoLoop}`;
      }
    } catch { /* A local media URL is rendered as a video element. */ }
    if (embedUrl) {
      return `<div${a} style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:inherit;"><iframe src="${urlAttribute(embedUrl)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:inherit;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }
    return `<${type}${a} src="${urlAttribute(src)}"${n.props.controls !== false ? ' controls' : ''}${n.props.autoplay ? ' autoplay muted' : ''}${n.props.loop ? ' loop' : ''} preload="metadata"></${type}>`;
  });
}

// 5. Icons & Dividers
add('divider', 'Divider', 'Basic', { style: 'solid', weight: 1, width: 100, align: 'center', text: '', icon: '' }, [
  select('style', 'Style', ['solid', 'double', 'dotted', 'dashed']),
  { key: 'text', label: 'Center Text', type: 'text' },
  { key: 'icon', label: 'Center Icon', type: 'text' }
], (n, _, a) => {
  if (n.props.text || n.props.icon) {
    const iconClass = formatIconClass(n.props.icon);
    const inner = iconClass ? `<i class="${escapeHtml(iconClass)}"></i>` : escapeHtml(n.props.text);
    return `<div${a} style="display:flex;align-items:center;gap:12px;"><div style="flex:1;border-bottom:1px solid currentColor;"></div><span>${inner}</span><div style="flex:1;border-bottom:1px solid currentColor;"></div></div>`;
  }
  return `<hr${a}>`;
});

add('spacer', 'Spacer', 'Basic', { height: 40 }, [{ key: 'height', label: 'Height (px)', type: 'number' }], (n, _, a) => `<div${a} style="height:${Number(n.props.height) || 40}px;" aria-hidden="true"></div>`);
add('anchor', 'Menu Anchor', 'Basic', { anchor: 'section' }, [text('anchor', 'Anchor ID Name')], (n, _, a) => `<div${a} id="${escapeHtml(String(n.props.anchor).replace(/[^a-zA-Z0-9_-]/g, ''))}"></div>`);
add('google-maps', 'Google Maps', 'Basic', { address: 'Dhaka, Bangladesh', zoom: 14, height: 300 }, [
  text('address', 'Location Address'),
  { key: 'zoom', label: 'Zoom Level (1–20)', type: 'number' },
  { key: 'height', label: 'Height (px)', type: 'number' }
], (n, _, a) => {
  const query = encodeURIComponent(String(n.props.address || 'Dhaka, Bangladesh'));
  return `<div${a} style="overflow:hidden;height:${Number(n.props.height) || 300}px;"><iframe width="100%" height="100%" frameborder="0" scrolling="no" src="https://maps.google.com/maps?q=${query}&z=${Number(n.props.zoom) || 14}&output=embed"></iframe></div>`;
});

add('icon', 'Icon', 'Basic', { icon: 'fas fa-star', view: 'default', shape: 'circle', link: '', url: '' }, [
  text('icon', 'Icon Name (FontAwesome)'),
  select('view', 'View', ['default', 'stacked', 'framed']),
  select('shape', 'Shape', ['circle', 'square']),
  { key: 'link', label: 'Link URL', type: 'url' }
], (n, _, a) => {
  const iconClass = formatIconClass(n.props.icon, 'fas fa-star');
  const icon = `<i class="${escapeHtml(iconClass)}"></i>`;
  const url = n.props.url || n.props.link;
  const wrapped = url ? `<a href="${urlAttribute(url)}">${icon}</a>` : icon;
  return `<div${a}>${wrapped}</div>`;
});

// 6. Advanced Elementor Widgets
add('icon-box', 'Icon Box', 'General', { icon: 'fas fa-gem', title: 'Feature Title', description: 'Describe the feature or benefit in detail here.', link: '', url: '', position: 'top' }, [
  text('icon', 'Icon Name'),
  text('title', 'Title & Description'),
  { key: 'description', label: 'Description', type: 'textarea' },
  select('position', 'Icon Position', ['top', 'left', 'right']),
  { key: 'link', label: 'Link URL', type: 'url' }
], (n, _, a) => {
  const iconClass = formatIconClass(n.props.icon, 'fas fa-gem');
  const icon = `<div class="builder-icon-wrapper"><i class="${escapeHtml(iconClass)}"></i></div>`;
  const content = `<div class="builder-icon-box-content"><h3>${escapeHtml(n.props.title)}</h3><p>${escapeHtml(n.props.description)}</p></div>`;
  return `<div${a} style="display:flex;flex-direction:${n.props.position === 'left' ? 'row' : n.props.position === 'right' ? 'row-reverse' : 'column'};gap:16px;">${icon}${content}</div>`;
});

add('image-box', 'Image Box', 'General', { src: '', title: 'Image Title', description: 'Describe the product or highlight.', position: 'top' }, [
  { key: 'src', label: 'Image URL', type: 'media', dynamic: true },
  text('title', 'Title'),
  { key: 'description', label: 'Description', type: 'textarea' },
  select('position', 'Image Position', ['top', 'left', 'right'])
], (n, _, a) => {
  const img = n.props.src ? `<img src="${urlAttribute(n.props.src)}" alt="${escapeHtml(n.props.title)}" loading="lazy" style="max-width:100%;height:auto;display:block;border-radius:inherit;object-fit:cover;">` : '';
  const content = `<div><h3 style="margin:0 0 6px 0;font-size:16px;">${escapeHtml(n.props.title)}</h3><p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(n.props.description)}</p></div>`;
  return `<div${a} style="display:flex;flex-direction:${n.props.position === 'left' ? 'row' : n.props.position === 'right' ? 'row-reverse' : 'column'};gap:16px;align-items:center;">${img}${content}</div>`;
});

add('star-rating', 'Star Rating', 'General', { rating: 5, scale: '5', title: '' }, [
  { key: 'rating', label: 'Rating Value', type: 'number' },
  select('scale', 'Scale', ['5', '10']),
  text('title', 'Title')
], (n, _, a) => {
  const max = Number(n.props.scale) || 5;
  const val = Math.min(max, Math.max(0, Number(n.props.rating) || 5));
  const stars = Array.from({ length: max }, (_, i) => `<span style="color:${i < val ? '#f59e0b' : '#d1d5db'};">★</span>`).join('');
  return `<div${a}>${n.props.title ? `<strong>${escapeHtml(n.props.title)}</strong> ` : ''}${stars} <small>(${val}/${max})</small></div>`;
});

add('image-carousel', 'Image Carousel', 'Media', {
  images: '',
  autoplay: true,
  interval: 3500,
  arrows: true,
  dots: true,
  ratio: '4:5'
}, [
  { key: 'images', label: 'Image URLs (One per line or JSON array)', type: 'textarea' },
  { key: 'autoplay', label: 'Autoplay', type: 'switch' },
  { key: 'interval', label: 'Autoplay Interval (ms)', type: 'number' },
  { key: 'arrows', label: 'Show Navigation Arrows', type: 'switch' },
  { key: 'dots', label: 'Show Pagination Dots', type: 'switch' },
  select('ratio', 'Aspect Ratio', ['1:1', '4:5', '16:9', '4:3', 'auto'])
], (n, _, a) => {
  let list: string[] = [];
  try {
    const parsed = JSON.parse(String(n.props.images || '[]'));
    if (Array.isArray(parsed)) list = parsed.map(String).filter(Boolean);
  } catch {
    list = String(n.props.images || '').split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (!list.length) {
    return `<div${a} style="padding:40px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;">No images added to carousel</div>`;
  }
  const id = `carousel-${n.id.slice(0, 8)}`;
  const ratio = String(n.props.ratio || '4:5').replace(':', '/');
  const slidesHtml = list.map((src, idx) => `
    <div class="carousel-slide" style="flex:0 0 100%;min-width:100%;position:relative;display:flex;align-items:center;justify-content:center;scroll-snap-align:start;">
      <img src="${urlAttribute(src)}" alt="Slide ${idx + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;" />
    </div>
  `).join('');

  const dotsHtml = n.props.dots !== false ? `
    <div class="carousel-dots-wrap" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;padding:6px 12px;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);border-radius:20px;">
      ${list.map((_, idx) => `<button type="button" class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Slide ${idx + 1}" style="width:10px;height:10px;border-radius:50%;background:${idx === 0 ? '#ffffff' : 'rgba(255,255,255,0.5)'};border:none;padding:0;cursor:pointer;transition:all 0.2s;"></button>`).join('')}
    </div>
  ` : '';

  const arrowsHtml = n.props.arrows !== false ? `
    <button type="button" class="carousel-prev" aria-label="Previous image" style="position:absolute;top:50%;left:12px;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;box-shadow:0 4px 14px rgba(0,0,0,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;color:#0f172a;transition:all 0.2s;">
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <button type="button" class="carousel-next" aria-label="Next image" style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;box-shadow:0 4px 14px rgba(0,0,0,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;color:#0f172a;transition:all 0.2s;">
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
  ` : '';

  const initScript = `
    <script>
      (function(){
        const el = document.getElementById('${id}');
        if(!el) return;
        const track = el.querySelector('.carousel-track');
        const prev = el.querySelector('.carousel-prev');
        const next = el.querySelector('.carousel-next');
        const dots = el.querySelectorAll('.carousel-dot');
        let current = 0;
        const total = ${list.length};
        function goTo(idx) {
          current = (idx + total) % total;
          track.style.transform = 'translateX(-' + (current * 100) + '%)';
          dots.forEach((d, i) => {
            d.style.background = i === current ? '#ffffff' : 'rgba(255,255,255,0.5)';
            d.style.transform = i === current ? 'scale(1.2)' : 'scale(1)';
          });
        }
        if(prev) prev.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goTo(current - 1); });
        if(next) next.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goTo(current + 1); });
        dots.forEach(d => d.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goTo(Number(d.dataset.index)); }));
        ${n.props.autoplay !== false ? `
          let timer = setInterval(() => goTo(current + 1), ${Number(n.props.interval) || 3500});
          el.addEventListener('mouseenter', () => clearInterval(timer));
          el.addEventListener('mouseleave', () => { clearInterval(timer); timer = setInterval(() => goTo(current + 1), ${Number(n.props.interval) || 3500}); });
        ` : ''}
      })();
    </script>
  `;

  return `<div${a} id="${id}" class="elementor-image-carousel-wrapper e-image-carousel" data-autoplay="${n.props.autoplay !== false ? 'true' : 'false'}" data-interval="${Number(n.props.interval) || 3500}" style="position:relative;overflow:hidden;border-radius:inherit;aspect-ratio:${ratio};"><div class="carousel-track" style="display:flex;height:100%;transition:transform 0.45s cubic-bezier(0.25, 1, 0.5, 1);">${slidesHtml}</div>${arrowsHtml}${dotsHtml}</div>`;
});

add('icon-list', 'Icon List', 'General', { items: '✓ Premium Quality Materials\n✓ 100% Original Brand Warranty\n✓ Cash on Delivery Available\n✓ 7 Days Easy Return Policy', layout: 'vertical', iconColor: '#059669' }, [
  { key: 'items', label: 'Items (One per line with optional icon prefix)', type: 'textarea' },
  select('layout', 'Layout', ['vertical', 'horizontal']),
  text('iconColor', 'Icon Color')
], (n, _, a) => {
  const items = String(n.props.items || '').split('\n').filter(Boolean);
  const isHoriz = n.props.layout === 'horizontal';
  const iconColor = n.props.iconColor || '#059669';

  const defaultCheckSvg = `<svg viewBox="0 0 512 512" width="20" height="20" fill="${escapeHtml(iconColor)}" style="flex-shrink:0;"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>`;
  const rulerSvg = `<svg viewBox="0 0 512 512" width="20" height="20" fill="${escapeHtml(iconColor)}" style="flex-shrink:0;"><path d="M12.5 388.1L388.1 12.5c16.7-16.7 43.7-16.7 60.3 0l51 51c16.7 16.7 16.7 43.7 0 60.3L123.9 499.5c-16.7 16.7-43.7 16.7-60.3 0l-51-51c-16.7-16.7-16.7-43.7 0-60.3zM256 181.1l-22.6 22.6 17 17c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0l-17-17-22.6 22.6 34 34c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0l-34-34-22.6 22.6 17 17c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0l-17-17-22.6 22.6 34 34c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0l-34-34-22.6 22.6c-4.2 4.2-4.2 10.9 0 15.1l51 51c4.2 4.2 10.9 4.2 15.1 0L476.9 123.9c4.2-4.2 4.2-10.9 0-15.1l-51-51c-4.2-4.2-10.9-4.2-15.1 0L256 181.1z"/></svg>`;

  const listItems = items.map(item => {
    let cleanText = item.trim();
    let chosenSvg = defaultCheckSvg;
    if (cleanText.startsWith('[icon:ruler]')) {
      chosenSvg = rulerSvg;
      cleanText = cleanText.replace('[icon:ruler]', '').trim();
    } else if (cleanText.startsWith('[icon:check]')) {
      chosenSvg = defaultCheckSvg;
      cleanText = cleanText.replace('[icon:check]', '').trim();
    } else if (cleanText.startsWith('✓') || cleanText.startsWith('✔')) {
      cleanText = cleanText.replace(/^[✓✔]\s*/, '').trim();
    }
    return `<li class="elementor-icon-list-item" style="display:flex;align-items:center;gap:16px;margin:0;padding:6px 0;"><span class="elementor-icon-list-icon" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${chosenSvg}</span><span class="elementor-icon-list-text" style="line-height:1.65;font-size:inherit;">${escapeHtml(cleanText)}</span></li>`;
  }).join('');

  return `<ul${a} class="elementor-icon-list-items" style="list-style:none;margin:0;display:flex;flex-direction:${isHoriz ? 'row' : 'column'};flex-wrap:wrap;gap:14px;">${listItems}</ul>`;
});

add('counter', 'Counter', 'General', { start: 0, end: 100, prefix: '', suffix: '+', title: 'Happy Customers', duration: 2000 }, [
  { key: 'start', label: 'Start Number', type: 'number' },
  { key: 'end', label: 'End Number', type: 'number' },
  text('prefix', 'Prefix'),
  text('suffix', 'Suffix'),
  text('title', 'Title'),
  { key: 'duration', label: 'Duration (ms)', type: 'number' }
], (n, _, a) => `<div${a}><div style="font-size:2.5rem;font-weight:bold;line-height:1;">${escapeHtml(n.props.prefix)}${escapeHtml(n.props.end)}${escapeHtml(n.props.suffix)}</div><div>${escapeHtml(n.props.title)}</div></div>`);

add('progress', 'Progress bar', 'Content', { text: 'Fast Delivery Rate', value: 98 }, [
  text('text', 'Accessible label'),
  { key: 'value', label: 'Value (0–100)', type: 'number' }
], (n, _, a) => {
  const val = Math.max(0, Math.min(100, Number(n.props.value) || 0));
  return `<div${a}><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>${escapeHtml(n.props.text)}</span><span>${val}%</span></div><div style="background:#e5e7eb;border-radius:9999px;height:10px;overflow:hidden;"><div style="background:var(--brand-primary,#176b53);width:${val}%;height:100%;border-radius:9999px;"></div></div></div>`;
});

add('testimonial', 'Testimonial', 'General', {
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.',
  name: 'John Doe',
  job: 'Designer',
  image: '',
  imageSize: 'full',
  link: '',
  imagePosition: 'aside',
  align: 'center'
}, [
  { key: 'content', label: 'Content', type: 'textarea', dynamic: true },
  { key: 'image', label: 'Choose Image', type: 'media', dynamic: true },
  select('imageSize', 'Image Resolution', ['thumbnail', 'medium', 'large', 'full']),
  text('name', 'Name'),
  text('job', 'Title'),
  { key: 'link', label: 'Link', type: 'url', dynamic: true },
  select('imagePosition', 'Image Position', ['aside', 'top']),
  select('align', 'Alignment', ['start', 'center', 'end', 'justify'])
], (n, _, a) => {
  const content = escapeHtml(n.props.content ?? n.props.text ?? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.');
  const name = escapeHtml(n.props.name || 'John Doe');
  const job = escapeHtml(n.props.job || n.props.title || 'Designer');
  const imgSrc = n.props.image || n.props.avatar || '';
  const isAside = (n.props.imagePosition || 'aside') === 'aside';
  const align = n.props.align || 'center';
  const url = n.props.link || n.props.url || '';

  const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="%23d1d5db"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c38.7 0 70 31.3 70 70s-31.3 70-70 70s-70-31.3-70-70s31.3-70 70-70zm0 288c-63.5 0-119.5-31.8-153.8-80.6C118.4 303.8 163.5 288 213.3 288h85.3c49.9 0 94.9 15.8 111.2 47.4C375.5 384.2 319.5 416 256 416z"/></svg>`;
  const imgHtml = `<div class="elementor-testimonial-image" style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;"><img src="${urlAttribute(imgSrc || placeholderSvg)}" alt="${name}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"></div>`;

  const detailsHtml = `<div class="elementor-testimonial-details" style="display:flex;flex-direction:column;gap:2px;"><strong class="elementor-testimonial-name" style="font-size:14px;color:inherit;">${name}</strong><span class="elementor-testimonial-job" style="font-size:12px;color:rgba(100,116,139,1);">${job}</span></div>`;

  const metaInner = `<div class="elementor-testimonial-meta-inner" style="display:flex;flex-direction:${isAside ? 'row' : 'column'};align-items:center;gap:12px;${isAside ? '' : 'text-align:center;'}">${imgHtml}${detailsHtml}</div>`;
  const metaHtml = url ? `<a href="${urlAttribute(url)}" style="text-decoration:none;color:inherit;">${metaInner}</a>` : metaInner;

  return `<div${a} class="elementor-testimonial-wrapper" style="text-align:${align === 'start' ? 'left' : align === 'end' ? 'right' : align};display:flex;flex-direction:column;align-items:${align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'};gap:16px;padding:16px 0;"><div class="elementor-testimonial-content" style="font-size:15px;line-height:1.6;color:inherit;max-width:800px;">${content}</div><div class="elementor-testimonial-meta">${metaHtml}</div></div>`;
});

add('social-icons', 'Social Icons', 'General', { facebook: 'https://facebook.com', instagram: 'https://instagram.com', whatsapp: 'https://wa.me/880', youtube: '' }, [
  { key: 'facebook', label: 'Facebook URL', type: 'url' },
  { key: 'instagram', label: 'Instagram URL', type: 'url' },
  { key: 'whatsapp', label: 'WhatsApp Link', type: 'url' },
  { key: 'youtube', label: 'YouTube URL', type: 'url' }
], (n, _, a) => {
  const links: string[] = [];
  if (n.props.facebook) links.push(`<a href="${urlAttribute(n.props.facebook)}" target="_blank" rel="noopener" style="color:currentColor;font-size:1.25rem;">FB</a>`);
  if (n.props.instagram) links.push(`<a href="${urlAttribute(n.props.instagram)}" target="_blank" rel="noopener" style="color:currentColor;font-size:1.25rem;">IG</a>`);
  if (n.props.whatsapp) links.push(`<a href="${urlAttribute(n.props.whatsapp)}" target="_blank" rel="noopener" style="color:currentColor;font-size:1.25rem;">WA</a>`);
  if (n.props.youtube) links.push(`<a href="${urlAttribute(n.props.youtube)}" target="_blank" rel="noopener" style="color:currentColor;font-size:1.25rem;">YT</a>`);
  return `<div${a} style="display:flex;gap:16px;align-items:center;">${links.join('')}</div>`;
});

add('alert', 'Alert', 'General', { title: 'Special Notice!', description: 'Free home delivery across Bangladesh on orders over ৳1500.', type: 'info' }, [
  text('title', 'Alert Title'),
  { key: 'description', label: 'Alert Description', type: 'textarea' },
  select('type', 'Alert Type', ['info', 'success', 'warning', 'danger'])
], (n, _, a) => `<div${a} role="alert" style="padding:16px;border-radius:6px;background:#f0fdf4;border-left:4px solid #16a34a;"><strong>${escapeHtml(n.props.title)}</strong><p style="margin:4px 0 0 0;">${escapeHtml(n.props.description)}</p></div>`);

// 7. E-Commerce & Landing Page Power Widgets
add('product-price', 'Product Price', 'Storefront', { regularPrice: 1500, salePrice: 1200, currency: '৳', discountBadge: true }, [
  { key: 'regularPrice', label: 'Regular Price', type: 'number', dynamic: true },
  { key: 'salePrice', label: 'Sale Price', type: 'number', dynamic: true },
  text('currency', 'Currency Symbol'),
  { key: 'discountBadge', label: 'Show Discount % Badge', type: 'switch' }
], (n, _, a) => {
  const reg = Number(n.props.regularPrice) || 0;
  const sale = Number(n.props.salePrice) || reg;
  const cur = String(n.props.currency || '৳');
  const discount = reg > sale && reg > 0 ? Math.round(((reg - sale) / reg) * 100) : 0;
  return `<div${a} style="display:flex;align-items:center;gap:12px;font-family:inherit;"><span style="font-size:1.8rem;font-weight:bold;color:var(--brand-primary,#176b53);">${cur}${sale}</span>${reg > sale ? `<span style="font-size:1.2rem;text-decoration:line-through;color:#9ca3af;">${cur}${reg}</span>` : ''}${discount > 0 && n.props.discountBadge ? `<span style="background:#ef4444;color:white;font-size:0.85rem;font-weight:bold;padding:2px 8px;border-radius:4px;">${discount}% OFF</span>` : ''}</div>`;
});

add('countdown', 'Countdown Timer', 'Storefront', { hours: 24, endAt: '', label: 'Limited Time Offer Ends In:' }, [
  text('label', 'Offer Headline'),
  text('endAt', 'Deadline (ISO date and time)'),
  { key: 'hours', label: 'Duration (Hours)', type: 'number' }
], (n, _, a) => {
  const end = Date.parse(String(n.props.endAt || ''));
  const endAt = Number.isFinite(end) ? new Date(end).toISOString() : '';
  const hours = Math.min(8760, Math.max(1, Number(n.props.hours) || 24));
  const remaining = Math.max(0, Math.floor(((endAt ? end : Date.now() + hours * 3600000) - Date.now()) / 1000));
  const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
  return `<div${a} data-builder-countdown-end="${escapeHtml(endAt)}" data-builder-countdown-hours="${hours}" style="padding:16px;background:#1f2937;color:white;border-radius:8px;text-align:center;"><div style="font-size:0.9rem;margin-bottom:8px;opacity:0.9;">${escapeHtml(n.props.label)}</div><div style="display:inline-flex;gap:12px;font-weight:bold;font-size:1.4rem;">${values.map((value, index) => `<div><span data-countdown-unit="${['days', 'hours', 'minutes', 'seconds'][index]}">${String(value).padStart(2, '0')}</span><br><small style="font-size:0.7rem;">${['Days', 'Hours', 'Mins', 'Secs'][index]}</small></div>`).join(':')}</div></div>`;
});

add('size-chart', 'Size Chart', 'Storefront', { columns: 'Size | Chest | Length', rows: 'S | 40 | 26\nM | 42 | 27', note: '' }, [
  { key: 'columns', label: 'Column names (separate with |)', type: 'text' },
  { key: 'rows', label: 'Rows (one per line, separate cells with |)', type: 'textarea' },
  { key: 'note', label: 'Note', type: 'textarea' }
], (n, _, a) => {
  const columns = String(n.props.columns || '').split('|').map(value => value.trim()).filter(Boolean).slice(0, 12);
  const rows = String(n.props.rows || '').split(/\r?\n/).filter(Boolean).slice(0, 50).map(row => row.split('|').map(value => value.trim()));
  return `<div${a} style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;text-align:left;"><thead><tr>${columns.map(column => `<th scope="col" style="border:1px solid #d9e2dc;padding:10px;">${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map((_, index) => `<td style="border:1px solid #d9e2dc;padding:10px;">${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>${n.props.note ? `<p style="margin:8px 0 0;font-size:0.875rem;">${escapeHtml(n.props.note)}</p>` : ''}</div>`;
});

add('trust-badges', 'Trust Badges', 'Storefront', { badges: 'Cash on Delivery\n100% Original Guarantee\n7 Days Easy Return\nFast All-BD Shipping' }, [
  { key: 'badges', label: 'Badges (One per line)', type: 'textarea' }
], (n, _, a) => {
  const items = String(n.props.badges || '').split('\n').filter(Boolean);
  return `<div${a} style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;text-align:center;">${items.map(b => `<div style="padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:0.85rem;font-weight:600;">✓ ${escapeHtml(b)}</div>`).join('')}</div>`;
});

// 8. Site & Interactive
add('nav', 'Navigation menu', 'Site', { label: 'Primary navigation' }, [text('label', 'Accessible menu name')], (n, c, a) => `<nav${a} aria-label="${escapeHtml(n.props.label)}">${c}</nav>`, true);
add('details', 'Accordion panel', 'Interactive', { text: 'Open this section', open: false }, [text('text', 'Summary'), { key: 'open', label: 'Initially expanded', type: 'switch' }], (n, c, a) => `<details${a}${n.props.open ? ' open' : ''}><summary>${escapeHtml(n.props.text)}</summary>${c}</details>`, true);

// 9. Forms & Dynamic
add('form', 'Form', 'Forms', { formName: 'Contact form', successMessage: 'Thank you. Your response has been received.' }, [
  text('formName', 'Form name'),
  { key: 'successMessage', label: 'Success message', type: 'textarea' }
], (n, c, a, context) => {
  const form = context?.form;
  return `<form${a} aria-label="${escapeHtml(n.props.formName)}" method="post"${form ? ` action="${urlAttribute(form.action)}"` : ''}>${form ? `<input type="hidden" name="_token" value="${escapeHtml(form.token)}"><div class="builder-honeypot" aria-hidden="true"><label>Leave this empty<input name="_website" tabindex="-1" autocomplete="off"></label></div>${c}` : `<fieldset disabled>${c}</fieldset>`}</form>`;
}, true);

add('form-field', 'Form field', 'Forms', {
  fieldName: 'field',
  label: 'Your name',
  inputType: 'text',
  placeholder: '',
  required: false,
  options: 'Option one\nOption two',
  defaultValue: '',
  min: '',
  max: ''
}, [
  { ...text('fieldName', 'Field key'), dynamic: false },
  text('label', 'Field label'),
  select('inputType', 'Field type', fieldTypes),
  text('placeholder', 'Placeholder'),
  { key: 'required', label: 'Required', type: 'switch' },
  { key: 'options', label: 'Select / Radio options (one per line)', type: 'textarea' },
  text('defaultValue', 'Default value'),
  text('min', 'Minimum number'),
  text('max', 'Maximum number')
], (n, _, a) => {
  const p = n.props;
  const id = `field-${n.id}`;
  const type = String(p.inputType);
  const required = p.required ? ' required' : '';
  const attrs = ` id="${id}" name="${escapeHtml(p.fieldName)}"${required}`;
  const placeholder = ` placeholder="${escapeHtml(p.placeholder)}"`;
  let input: string;
  if (type === 'textarea') {
    input = `<textarea${attrs}${placeholder} maxlength="2000">${escapeHtml(p.defaultValue)}</textarea>`;
  } else if (type === 'select') {
    input = `<select${attrs}><option value="">Choose an option</option>${fieldOptions(n).map(option => `<option${option === p.defaultValue ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
  } else if (type === 'radio') {
    const opts = fieldOptions(n);
    input = `<div class="builder-radio-group" style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">${opts.map((option, idx) => {
      const radioId = `${id}_${idx}`;
      const checked = (option === p.defaultValue || (!p.defaultValue && idx === 0)) ? ' checked' : '';
      return `<label for="${radioId}" class="builder-radio-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;background:#f8fafc;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;margin:0;"><input type="radio" id="${radioId}" name="${escapeHtml(p.fieldName)}" value="${escapeHtml(option)}"${checked}${required} style="margin:0;width:18px;height:18px;accent-color:#0f766e;cursor:pointer;"> <span>${escapeHtml(option)}</span></label>`;
    }).join('')}</div>`;
  } else {
    input = `<input${attrs} type="${escapeHtml(type)}"${placeholder}${type === 'checkbox' ? ' value="on"' : ` value="${escapeHtml(p.defaultValue)}"`}${['number', 'range'].includes(type) ? `${p.min !== '' ? ` min="${escapeHtml(p.min)}"` : ''}${p.max !== '' ? ` max="${escapeHtml(p.max)}"` : ''}` : ' maxlength="2000"'}>`;
  }
  const labelEl = type === 'radio'
    ? `<div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#334155;">${escapeHtml(p.label)}${p.required ? ' <span aria-hidden="true" style="color:#ef4444;">*</span>' : ''}</div>`
    : `<label for="${id}">${escapeHtml(p.label)}${p.required ? ' <span aria-hidden="true">*</span>' : ''}</label>`;
  return `<div${a}${type === 'hidden' ? ' hidden' : ''}>${labelEl}${input}</div>`;
});

add('form-submit', 'Submit button', 'Forms', { text: 'Send response' }, [text('text', 'Button label')], (n, _, a) => `<button${a} type="submit">${escapeHtml(n.props.text)}</button>`);
add('component', 'Reusable component', 'Components', { component: '' }, [text('component', 'Component key')], (_, c, a) => `<div${a}>${c}</div>`, false);

add('loop', 'Content loop', 'Dynamic', {
  provider: 'products',
  limit: 6,
  search: '',
  category: '',
  sort: 'newest',
  emptyMessage: 'No matching content.'
}, [
  select('provider', 'Data source', ['products', 'pages']),
  { key: 'limit', label: 'Maximum records (1–24)', type: 'number' },
  { ...text('search', 'Search records'), dynamic: false },
  { ...text('category', 'Product category'), dynamic: false },
  select('sort', 'Order', ['newest', 'oldest', 'title']),
  text('emptyMessage', 'Empty-state message')
], (_, c, a) => `<div${a}>${c}</div>`, true);

add('notice', 'Notice', 'Content', { text: 'A useful note for your visitors.' }, [{ ...text(), type: 'textarea' }], (n, _, a) => `<aside${a}>${escapeHtml(n.props.text)}</aside>`);

export function createNode(type: string): BuilderNode {
  const widget = widgets.get(type);
  if (!widget) throw new Error(`Unknown widget: ${type}`);
  const id = globalThis.crypto.randomUUID();
  const node: BuilderNode = {
    id,
    type,
    version: widget.version,
    name: widget.name,
    props: { ...widget.defaults, ...(type === 'form-field' ? { fieldName: `field_${id.slice(0, 8)}` } : {}) },
    attributes: {},
    classes: [],
    bindings: {},
    styles: type === 'flex' || type === 'form' ? { display: 'flex', 'flex-direction': 'column', gap: '24px', padding: '24px' } : type === 'grid' ? { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '24px', padding: '24px' } : type === 'spacer' ? { height: '40px' } : type === 'container' || type === 'section' ? { padding: '24px' } : {},
    responsiveStyles: {},
    states: {},
    children: [],
    locked: false,
    hidden: false
  };

  if (type === 'form') node.children = [createNode('form-field'), createNode('form-submit')];
  if (type === 'section') {
    const col1 = createNode('column');
    const col2 = createNode('column');
    node.styles = { display: 'flex', gap: '24px', padding: '32px 16px' };
    col1.styles = { flex: '1' };
    col2.styles = { flex: '1' };
    node.children = [col1, col2];
  }
  if (type === 'nav') {
    node.styles = { display: 'flex', gap: '16px', 'align-items': 'center', 'flex-wrap': 'wrap' };
    const first = createNode('link'); first.props.text = 'Home'; first.props.href = '/';
    const second = createNode('link'); second.props.text = 'Shop'; second.props.href = '/shop';
    node.children = [first, second];
  }
  if (type === 'loop') {
    node.styles = { display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '24px', padding: '24px' };
    const card = createNode('flex'); card.props.tag = 'article';
    const heading = createNode('heading'); heading.bindings.text = 'item.title';
    const paragraph = createNode('paragraph'); paragraph.bindings.text = 'item.excerpt';
    const link = createNode('button'); link.props.text = 'Learn more'; link.bindings.href = 'item.url';
    card.children = [heading, paragraph, link];
    node.children = [card];
  }
  return node;
}

export function validateWidget(node: BuilderNode): void {
  const widget = widgets.get(node.type);
  if (!widget) return;
  if (node.version > widget.version) throw new Error(`Unsupported version of ${node.type}`);
  if (!widget.children && node.children.length) throw new Error(`${node.type} cannot contain children`);
  for (const key of Object.keys(node.bindings)) {
    if (!widget.controls.some(control => control.key === key && control.dynamic) || (node.type === 'form-field' && key === 'fieldName')) {
      throw new Error(`Unsupported dynamic binding: ${key}`);
    }
  }
  for (const control of widget.controls) {
    const value = node.props[control.key];
    if (value === undefined) continue;
    if ((control.type === 'url' || control.type === 'media') && !safeUrl(String(value))) {
      throw new Error(`Unsafe ${control.label}`);
    }
    if (control.type === 'select') {
      const opts = control.options?.map(o => (typeof o === 'string' ? o : o.value));
      if (opts && !opts.includes(String(value))) throw new Error(`Invalid ${control.label}`);
    }
    if (control.type === 'number' && typeof value !== 'number') {
      throw new Error(`Invalid ${control.label}`);
    }
    if (control.type === 'switch' && typeof value !== 'boolean') {
      throw new Error(`Invalid ${control.label}`);
    }
  }
}
