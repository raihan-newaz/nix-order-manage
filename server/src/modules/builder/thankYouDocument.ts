import { createNode } from './core/registry';
import { emptyDocument } from './core/schema';

export function thankYouDocument(title: string, slug: string) {
  const doc = emptyDocument(`${title.slice(0, 100)} · Thank you`, slug);
  doc.settings.lang = 'bn'; doc.seo.noindex = true;
  const card = createNode('flex'); card.name = 'Order confirmation';
  card.styles = { padding: 'clamp(32px,6vw,72px)', 'max-width': '880px', margin: '24px auto', 'text-align': 'center', 'align-items': 'center', background: '#f0fdf4', 'border-radius': '24px' };
  const badge = createNode('badge'); badge.props.text = 'অর্ডার গ্রহণ করা হয়েছে'; badge.styles = { color: '#166534', 'font-size': '16px' };
  const heading = createNode('heading'); heading.props.text = 'ধন্যবাদ! আপনার অর্ডারটি পেয়েছি।'; heading.props.level = 'h1'; heading.styles = { 'font-size': 'clamp(28px,5vw,44px)', margin: '0' };
  const text = createNode('paragraph'); text.props.text = 'অর্ডার নিশ্চিত করতে আমাদের প্রতিনিধি আপনার সাথে যোগাযোগ করবেন। অনুগ্রহ করে ফোনটি সচল রাখুন।';
  const link = createNode('button'); link.props.text = 'অর্ডার ট্র্যাক করুন'; link.props.href = '/track-order';
  card.children = [badge, heading, text, link]; doc.rootNodes = [card]; return doc;
}
