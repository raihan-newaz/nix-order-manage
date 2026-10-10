import { createNode } from './core/registry';
import { emptyDocument, safeUrl, type BuilderNode, type PageDocument } from './core/schema';

type LegacyBlock = { type?: unknown; heading?: unknown; eyebrow?: unknown; text?: unknown; image?: unknown; images?: unknown; caption?: unknown; label?: unknown; buttonText?: unknown; items?: unknown; height?: unknown; style?: unknown; url?: unknown; endAt?: unknown; autoplay?: unknown; columns?: unknown; rows?: unknown; note?: unknown };
const string = (value: unknown) => typeof value === 'string' ? value : '';
const imageUrl = (value: unknown) => { const url = string(value); return safeUrl(url) ? url : ''; };
const node = (type: string, props: Record<string, string | number | boolean> = {}): BuilderNode => { const result = createNode(type); Object.assign(result.props, props); return result; };
const heading = (value: unknown, level = 'h2') => node('heading', { text: string(value), level });
const paragraph = (value: unknown) => node('paragraph', { text: string(value) });
const image = (src: unknown, alt: unknown) => node('image', { src: imageUrl(src), alt: string(alt), caption: '' });
const section = (block: LegacyBlock) => {
  const container = node('flex'); container.props.tag = 'section';
  container.styles = { display: 'flex', 'flex-direction': 'column', gap: '20px', padding: 'clamp(24px,5vw,72px)' };
  const style = block.style && typeof block.style === 'object' && !Array.isArray(block.style) ? block.style as Record<string, unknown> : {};
  if (typeof style.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(style.background)) container.styles['background-color'] = style.background;
  if (typeof style.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(style.color)) container.styles.color = style.color;
  if (style.align === 'center') container.styles['text-align'] = 'center';
  container.name = `${string(block.type).replaceAll('_', ' ')} section`;
  return container;
};

const recoverableSection = (block: LegacyBlock, index: number): BuilderNode | null => {
  if (!['COUNTDOWN', 'VIDEO', 'SIZE_CHART'].includes(string(block.type))) return null;
  const group = section(block);
  group.name = `Legacy ${string(block.type)} section ${index + 1}`;
  if (block.type === 'COUNTDOWN') {
    group.children.push(node('countdown', { label: string(block.heading), endAt: string(block.endAt), hours: 24 }));
  } else if (block.type === 'VIDEO') {
    if (block.heading) group.children.push(heading(block.heading));
    group.children.push(node('video', { src: imageUrl(block.url), autoplay: Boolean(block.autoplay), loop: false, controls: true }));
  } else {
    if (block.heading) group.children.push(heading(block.heading));
    const columns = Array.isArray(block.columns) ? block.columns.map(string).slice(0, 12) : [];
    const rows = Array.isArray(block.rows) ? block.rows.slice(0, 50).map(row => Array.isArray(row) ? row.map(string).slice(0, 12).join(' | ') : '') : [];
    group.children.push(node('size-chart', { columns: columns.join(' | '), rows: rows.join('\n'), note: string(block.note) }));
  }
  return group;
};

export function missingLegacySections(rawBlocks: unknown, document: PageDocument): { nodes: BuilderNode[]; warnings: string[] } {
  if (!Array.isArray(rawBlocks)) return { nodes: [], warnings: [] };
  const names = new Set<string>();
  const collectNames = (items: BuilderNode[]) => { for (const item of items) { names.add(item.name); collectNames(item.children); } };
  collectNames(document.rootNodes);
  const nodes = rawBlocks.flatMap((block, index) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
    const recovered = recoverableSection(block as LegacyBlock, index);
    return recovered && !names.has(recovered.name) ? [recovered] : [];
  });
  return { nodes, warnings: nodes.map(item => `${item.name.replace(/^Legacy /, '').replaceAll('_', ' ')} is missing from the Studio draft.`) };
}

export function convertLegacyLanding(title: string, slug: string, rawBlocks: unknown): { document: PageDocument; warnings: string[] } {
  const document = emptyDocument(title, slug);
  const warnings: string[] = [];
  if (!Array.isArray(rawBlocks)) return { document, warnings: ['Legacy sections could not be read. The Studio draft starts blank.'] };
  for (const [index, raw] of rawBlocks.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { warnings.push(`Section ${index + 1} was skipped.`); continue; }
    const block = raw as LegacyBlock;
    if (block.type === 'CHECKOUT') continue;
    const recovered = recoverableSection(block, index);
    if (recovered) { document.rootNodes.push(recovered); continue; }
    if (block.type === 'SPACER') { const spacer = node('spacer'); spacer.styles.height = `${Math.min(120, Math.max(8, Number(block.height) || 32))}px`; document.rootNodes.push(spacer); continue; }
    const group = section(block);
    if (block.type === 'HERO') {
      if (block.eyebrow) group.children.push(node('badge', { text: string(block.eyebrow) }));
      group.children.push(heading(block.heading, 'h1'));
      if (block.text) group.children.push(paragraph(block.text));
      if (block.image) group.children.push(image(block.image, block.heading));
      group.children.push(node('button', { text: string(block.buttonText) || 'Order now', href: '#order' }));
    } else if (block.type === 'TEXT_SECTION') {
      group.children.push(heading(block.heading), paragraph(block.text));
    } else if (block.type === 'IMAGE_SECTION' || block.type === 'GALLERY') {
      if (block.heading) group.children.push(heading(block.heading));
      const urls = block.type === 'GALLERY' ? block.images : block.images && Array.isArray(block.images) && block.images.length ? block.images : [block.image];
      for (const url of Array.isArray(urls) ? urls.slice(0, 12) : []) if (imageUrl(url)) group.children.push(image(url, block.heading));
      if (block.caption) group.children.push(paragraph(block.caption));
    } else if (block.type === 'FEATURES') {
      group.children.push(heading(block.heading));
      if (Array.isArray(block.items)) for (const item of block.items.slice(0, 12)) group.children.push(paragraph(`• ${string(item)}`));
    } else if (block.type === 'TESTIMONIALS') {
      group.children.push(heading(block.heading));
      if (Array.isArray(block.items)) for (const item of block.items.slice(0, 12)) if (item && typeof item === 'object') {
        const quote = item as Record<string, unknown>; group.children.push(node('blockquote', { text: `${string(quote.quote)} — ${string(quote.author)}` }));
      }
    } else if (block.type === 'FAQ') {
      group.children.push(heading(block.heading));
      if (Array.isArray(block.items)) for (const item of block.items.slice(0, 12)) if (item && typeof item === 'object') {
        const faq = item as Record<string, unknown>; const details = node('details', { text: string(faq.question) }); details.children.push(paragraph(faq.answer)); group.children.push(details);
      }
    } else if (block.type === 'CTA') {
      group.children.push(heading(block.heading)); if (block.text) group.children.push(paragraph(block.text));
      group.children.push(node('button', { text: string(block.label) || 'Order now', href: '#order' }));
    } else { warnings.push(`${string(block.type) || 'Unknown'} section ${index + 1} needs manual rebuilding in Studio.`); continue; }
    document.rootNodes.push(group);
  }
  return { document, warnings };
}
