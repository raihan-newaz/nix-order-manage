import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument, parseDocument, safeUrl } from '../core/schema';
import { createNode, widgets } from '../core/registry';
import { compileCss, renderHtml, renderPage } from '../core/renderer';
import { applyCommand, execute, undo, redo } from '../core/commands';
import { migrateDocument } from '../core/migrations';
import { builderPermissions } from '../permissions';
import { csvCell, documentForms, validateSubmission } from '../core/forms';
import { createFormToken, verifyFormToken } from '../formService';
import { documentLoops } from '../core/loops';
import { tokenUsageCount } from '../core/styles';
import { emptyTheme, matchesRoute, parseTheme, selectThemeRule } from '../core/theme';
import { convertLegacyLanding, missingLegacySections } from '../landingConversion';
import { productInputSchema, productSlugSchema } from '../../inventory/productValidation';
import { thankYouDocument } from '../thankYouDocument';

test('offer price is reusable, editable, and renders legacy prices safely', () => {
  const widget = widgets.get('offer-price');
  assert.ok(widget);
  assert.equal(widget.category, 'Storefront');
  for (const key of ['animationStyle', 'animationDuration', 'strikeColor', 'saleColor']) {
    assert.ok(widget.controls.some(control => control.key === key));
  }
  const node = createNode('offer-price');
  node.props = { regularPrice: '৳1,650', offerPrice: '৳1,190', animationStyle: 'single', animationDuration: 5, strikeColor: '#123456', saleColor: '#654321' };
  const html = widget.render(node, '', '');
  assert.match(html, /রেগুলার মূল্য/);
  assert.match(html, /1,650/);
  assert.doesNotMatch(html, /৳1,650/);
  assert.match(html, /--offer-animation-duration:5s/);
  assert.match(html, /--offer-sale-color:#654321/);
  assert.doesNotMatch(html, /builder-cross-second/);
  node.props.strikeColor = 'red;position:absolute';
  assert.match(widget.render(node, '', ''), /--offer-strike-color:#ff1717/);
});

test('support phone links use current store settings and hide unconfigured numbers', () => {
  const doc = emptyDocument();
  const link = createNode('button');
  link.props.text = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M1 1"/></svg> হেল্পলাইন: {{site.phone}}';
  link.props.href = 'tel:{{site.phone}}';
  doc.rootNodes = [link];
  const live = renderPage(doc, { sitePhone: '01712345678' });
  assert.match(live.html, /tel:01712345678/);
  assert.match(live.html, /data-site-phone="true"/);
  assert.match(live.html, /<svg aria-hidden="true"/);
  assert.match(live.css, /align-items:center/);
  const whatsapp = createNode('button');
  whatsapp.props.href = 'https://wa.me/{{site.whatsapp}}';
  whatsapp.props.text = 'WhatsApp';
  doc.rootNodes = [whatsapp];
  assert.match(renderPage(doc, { sitePhone: '01712345678' }).html, /wa.me\/8801712345678/);
  doc.rootNodes = [link];
  assert.doesNotMatch(renderPage(doc, { sitePhone: '01XXXXXXXXX' }).html, /হেল্পলাইন/);
  assert.match(renderPage(doc, { editor: true, sitePhone: '01XXXXXXXXX' }).html, /Storefront Settings/);
});

test('builder rejects style breakouts and escaped external CSS loads', () => {
  for (const css of ['</style><script>alert(1)</script>', 'selector{background:url(https://example.com/x)}', '@import "https://example.com/x";', 'selector{background:u\\72l(https://example.com/x)}']) {
    const doc = emptyDocument(); const node = createNode('heading');
    node.advanced = { customCss: css }; doc.rootNodes = [node];
    assert.throws(() => renderHtml(doc), /Unsafe custom CSS/);
  }
  const doc = emptyDocument(); const node = createNode('heading');
  node.advanced = { customCss: '@media(max-width:600px){selector{color:red}}' }; doc.rootNodes = [node];
  assert.match(renderHtml(doc), /@media\(max-width:600px\)/);
});

test('shape divider attributes cannot inject markup', () => {
  const doc = emptyDocument(); const node = createNode('container'); doc.rootNodes = [node];
  node.shapeDividers = { top: { type: 'waves', color: '"><img src=x onerror=alert(1)>' } };
  assert.throws(() => renderHtml(doc), /Unsafe shape color/);
  node.shapeDividers = { top: { type: 'waves', height: 48, color: '#ffffff' } };
  assert.match(renderHtml(doc), /height:48px/);
});

test('catalog input rejects negative variant prices, fractional stock and duplicate variation IDs', () => {
  for (const input of [{ variants: [{ salePrice: -1 }] }, { variants: [{ stockQuantity: -2 }] }, { stockQuantity: 1.5 }, { variants: [{ id: '11111111-1111-4111-8111-111111111111' }, { id: '11111111-1111-4111-8111-111111111111' }] }]) assert.equal(productInputSchema.safeParse(input).success, false);
  assert.equal(productInputSchema.safeParse({ slug: 'borka-new', variants: [{ stockQuantity: 4, regularPrice: 1650, salePrice: 1190 }] }).success, true);
  assert.equal(productSlugSchema.safeParse('../checkout').success, false);
  assert.equal(productSlugSchema.safeParse('নতুন-বোরখা').success, true);
});

test('generated thank you design is editable, noindex and contains no checkout form', () => {
  const doc = thankYouDocument('Borka', 'thank-you-borka');
  assert.equal(doc.seo.noindex, true);
  assert.equal(documentForms(doc).length, 0);
  assert.match(renderHtml(doc), /অর্ডার ট্র্যাক করুন/);
});

test('documents round-trip without React implementation details', () => {
  const document = emptyDocument('Welcome', 'welcome'); document.rootNodes.push(createNode('flex'));
  document.rootNodes[0].children.push(createNode('heading'));
  assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(document))), document);
});
test('site templates match included routes, honor exclusions, and choose priority', () => {
  const theme = emptyTheme();
  theme.rules = [
    { id: '11111111-1111-4111-8111-111111111111', area: 'header', pageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', include: ['/b/*'], exclude: ['/b/private'], priority: 0 },
    { id: '22222222-2222-4222-8222-222222222222', area: 'header', pageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', include: ['/b/sale-*'], exclude: [], priority: 10 },
  ];
  assert.equal(matchesRoute('/b/*', '/b/sale-one'), true);
  assert.equal(matchesRoute('/b/sale-*', '/b/sale-one'), true);
  assert.equal(matchesRoute('/b/sale-*', '/b/sales'), false);
  assert.equal(selectThemeRule(theme, 'header', '/b/sale-one')?.pageId, theme.rules[1].pageId);
  assert.equal(selectThemeRule(theme, 'header', '/b/private'), undefined);
  assert.equal(selectThemeRule(theme, 'footer', '/b/sale-one'), undefined);
  assert.deepEqual(parseTheme(theme), theme);
  theme.rules.push({ ...theme.rules[0] });
  assert.throws(() => parseTheme(theme), /unique/);
});
test('header and footer fragments render with independent CSS scopes', () => {
  const main = emptyDocument('Main', 'welcome'); main.rootNodes.push(createNode('heading'));
  const header = emptyDocument('Header', 'welcome'); header.rootNodes.push(createNode('text'));
  const footer = emptyDocument('Footer', 'footer'); footer.rootNodes.push(createNode('text'));
  const html = renderHtml(main, { header: renderPage(header, { region: 'header' }), footer: renderPage(footer, { region: 'footer' }) });
  assert.match(html, /<header data-builder-page="header-welcome"/);
  assert.match(html, /<main data-builder-page="main-welcome"/);
  assert.match(html, /<footer data-builder-page="footer-footer"/);
  assert.match(html, /\[data-builder-page="header-welcome"\]/);
  assert.match(html, /\[data-builder-page="main-welcome"\]/);
});
test('navigation widget exposes a named landmark and editable links safely', () => {
  const doc = emptyDocument(); const nav = createNode('nav'); doc.rootNodes.push(nav);
  nav.props.label = 'Shop <sale>';
  const html = renderPage(doc).html;
  assert.match(html, /<nav[^>]*aria-label="Shop &lt;sale&gt;"/);
  assert.match(html, /href="\/shop"/);
  assert.ok(!html.includes('<sale>'));
});
test('legacy landing conversion keeps checkout outside Studio and imports dynamic visual sections', () => {
  const blocks = [
    { type: 'HERO', heading: 'Best offer', text: 'Order today', image: '/uploads/offer.png' },
    { type: 'FAQ', heading: 'Questions', items: [{ question: 'Delivery?', answer: 'Everywhere.' }] },
    { type: 'COUNTDOWN', heading: 'Ends soon', endAt: new Date().toISOString() },
    { type: 'VIDEO', heading: 'Watch', url: 'https://youtu.be/abc123def45' },
    { type: 'SIZE_CHART', heading: 'Fit', columns: ['Size', 'Chest'], rows: [['M', '42']] },
    { type: 'CHECKOUT', productIds: ['private-product-id'] },
  ];
  const result = convertLegacyLanding('Offer', 'landing-test', blocks);
  const parsed = parseDocument(result.document);
  const html = renderPage(parsed).html;
  assert.match(html, /Best offer/);
  assert.match(html, /Delivery\?/);
  assert.match(html, /data-builder-countdown-end/);
  assert.match(html, /youtube-nocookie\.com/);
  assert.match(html, /<table/);
  assert.ok(!html.includes('private-product-id'));
  assert.equal(result.warnings.length, 0);
  assert.equal(missingLegacySections(blocks, parsed).nodes.length, 0);
  const oldDraft = emptyDocument('Old draft', 'landing-test');
  const missing = missingLegacySections(blocks, oldDraft);
  assert.equal(missing.nodes.length, 3);
  assert.match(missing.warnings[0], /COUNTDOWN/);
});
for (const widget of widgets.all().filter(widget => widget.type !== 'component')) {
  test(`${widget.type}: default/configured render, responsive CSS and serialization`, () => {
    const document = emptyDocument(); const node = createNode(widget.type);
    if (['form-field', 'form-submit'].includes(node.type)) { const form = createNode('form'); form.children = [node]; document.rootNodes.push(form); }
    else document.rootNodes.push(node);
    assert.ok(renderPage(document).html.includes(node.id));
    if ('text' in node.props) node.props.text = '<script>alert(1)</script>';
    node.responsiveStyles.mobile = { 'font-size': '12px' };
    const output = renderHtml(JSON.parse(JSON.stringify(document)));
    assert.ok(!output.includes('<script>alert(1)</script>'));
    assert.ok(output.includes('@media(max-width:640px)'));
    assert.ok(output.includes('font-size:12px'));
    assert.deepEqual(migrateDocument(document), document);
    node.version = 100;
    assert.throws(() => renderPage(document), /version/);
  });
}
test('unknown widgets survive schema validation and have an editor fallback', () => {
  const doc = emptyDocument(); const node = createNode('text'); node.type = 'removed-widget'; doc.rootNodes.push(node);
  assert.ok(renderPage(doc, { editor: true }).html.includes('Unavailable widget'));
  assert.ok(!renderPage(doc).html.includes('Unavailable widget'));
});
test('rejects unsafe URLs, attributes, CSS and object keys', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.test', '/\\evil.test', 'https://a.test/\nscript']) assert.equal(safeUrl(url), false);
  for (const url of ['/shop', '#section', 'https://example.com', 'mailto:a@example.com', 'tel:+8801']) assert.equal(safeUrl(url), true);
  const doc = emptyDocument(); const node = createNode('button'); doc.rootNodes.push(node);
  node.props.href = 'javascript:alert(1)'; assert.throws(() => renderPage(doc), /Unsafe/); node.props.href = '/shop';
  node.attributes.onclick = 'alert(1)'; assert.throws(() => parseDocument(doc)); delete node.attributes.onclick;
  for (const value of ['red;}body{display:none', 'url(https://evil.test)', '</style><script>', 'u\\72l(test)', 'image-set("https://evil.test")']) {
    node.styles.color = value; assert.throws(() => parseDocument(doc));
  }
  assert.throws(() => parseDocument(JSON.parse('{"__proto__":{}}')), /Unsafe object key/);
});
test('duplicate UUIDs, nesting bombs and unknown breakpoints are rejected', () => {
  const doc = emptyDocument(); const node = createNode('flex'); doc.rootNodes.push(node, structuredClone(node)); assert.throws(() => parseDocument(doc), /duplicate/);
  doc.rootNodes.pop(); node.responsiveStyles.unknown = { display: 'none' }; assert.throws(() => parseDocument(doc), /breakpoint/); node.responsiveStyles = {};
  let parent = node; for (let i = 0; i < 40; i++) { const child = createNode('flex'); parent.children.push(child); parent = child; }
  assert.throws(() => parseDocument(doc), /depth/);
});
test('component cycles and expansion bombs fail before rendering', () => {
  const doc = emptyDocument(); const node = createNode('component'); node.props.component = 'card'; doc.rootNodes.push(node);
  const inner = createNode('component'); inner.props.component = 'card'; doc.components.card = { name: 'Card', nodes: [inner] };
  assert.throws(() => parseDocument(doc), /Circular/);
  doc.components.card.nodes = [createNode('heading')]; assert.ok(renderHtml(doc).includes('Your heading'));
  doc.components.card.nodes[0].props.text = 'Changed master'; assert.ok(renderHtml(doc).includes('Changed master'));
});
test('deterministic CSS follows descending breakpoints and class attachment order', () => {
  const doc = emptyDocument(); const node = createNode('heading');
  doc.classes.first = { styles: { color: 'red' }, responsiveStyles: {}, states: {} };
  doc.classes.second = { styles: { color: 'blue' }, responsiveStyles: {}, states: {} };
  node.classes = ['second', 'first']; node.styles.color = 'green'; node.states.hover = { color: 'black' };
  node.responsiveStyles.tablet = { 'font-size': '24px' }; node.responsiveStyles.mobile = { 'font-size': '14px' };
  doc.rootNodes.push(node); const css = compileCss(doc);
  assert.equal(css, compileCss(structuredClone(doc)));
  assert.ok(css.indexOf('color:blue') < css.indexOf('color:red'));
  assert.ok(css.indexOf('color:red') < css.indexOf('color:green'));
  assert.ok(css.indexOf('max-width:1024') < css.indexOf('max-width:640'));
  assert.ok(css.includes(':hover{color:black}'));
});
test('commands enforce structure, clone UUIDs, prevent cycles and preserve undo', () => {
  const doc = emptyDocument(); const parent = createNode('flex'); const child = createNode('heading'); parent.children.push(child); doc.rootNodes.push(parent);
  assert.throws(() => execute(doc, { type: 'move', id: parent.id, parentId: child.id }), /itself/);
  assert.throws(() => execute(doc, { type: 'insert', node: createNode('text'), parentId: child.id }), /container/);
  const duplicated = execute(doc, { type: 'duplicate', id: parent.id });
  assert.notEqual(duplicated.rootNodes[1].id, parent.id); assert.notEqual(duplicated.rootNodes[1].children[0].id, child.id);
  const state = applyCommand({ present: doc, past: [], future: [] }, { type: 'remove', id: child.id });
  assert.equal(state.present.rootNodes[0].children.length, 0);
  assert.deepEqual(undo(state).present, doc); assert.deepEqual(redo(undo(state)).present, state.present);
  parent.locked = true; assert.throws(() => execute(doc, { type: 'remove', id: child.id }), /Unlock/);
});
test('rapid changes coalesce into one history step and new actions discard redo', () => {
  const doc = emptyDocument(); const node = createNode('text'); doc.rootNodes.push(node);
  let state = applyCommand({ present: doc, past: [], future: [] }, { type: 'update', id: node.id, patch: { name: 'A' } }, 'name', 100);
  state = applyCommand(state, { type: 'update', id: node.id, patch: { name: 'B' } }, 'name', 200);
  assert.equal(state.past.length, 1); assert.equal(undo(state).present.rootNodes[0].name, node.name);
  assert.equal(applyCommand(undo(state), { type: 'remove', id: node.id }).future.length, 0);
});
test('dynamic values are allowlisted and never evaluated', () => {
  const doc = emptyDocument('Dynamic title'); const node = createNode('heading'); node.bindings.text = 'page.title'; doc.rootNodes.push(node);
  assert.ok(renderHtml(doc).includes('Dynamic title'));
  node.bindings.text = 'user.password'; assert.throws(() => parseDocument(doc));
});
test('future schemas fail closed; role permissions default deny', () => {
  assert.throws(() => migrateDocument({ ...emptyDocument(), schemaVersion: 2 }), /Unsupported/);
  assert.equal(builderPermissions('CALL_CENTER_AGENT').publish, false);
  assert.equal(builderPermissions('OPERATIONS_MANAGER', { 'builder.publish': false }).publish, false);
  assert.equal(builderPermissions('CALL_CENTER_AGENT', { 'builder.access': true, 'builder.edit': true }).edit, true);
  assert.equal(builderPermissions('SUPER_ADMIN', { 'builder.publish': false }).publish, true);
});

test('wrap and unwrap preserve descendants and enforce widget props before history changes', () => {
  const doc = emptyDocument(); const heading = createNode('heading'); doc.rootNodes.push(heading);
  const wrapped = execute(doc, { type: 'wrap', id: heading.id });
  assert.equal(wrapped.rootNodes[0].children[0].id, heading.id);
  assert.deepEqual(execute(wrapped, { type: 'unwrap', id: wrapped.rootNodes[0].id }), doc);
  assert.throws(() => execute(doc, { type: 'update', id: heading.id, patch: { props: { level: 'script' } } }), /Invalid/);
});

test('forms validate published field definitions, values, bounds and unexpected inputs', () => {
  const doc = emptyDocument(); const form = createNode('form'); doc.rootNodes.push(form);
  const email = form.children[0]; email.props = { ...email.props, fieldName: 'email', inputType: 'email', label: 'Email', required: true };
  const number = createNode('form-field'); number.props = { ...number.props, fieldName: 'quantity', inputType: 'number', label: 'Quantity', min: '1', max: '5' }; form.children.push(number);
  const definition = documentForms(doc)[0];
  assert.deepEqual(validateSubmission(definition, { email: 'hello@example.com', quantity: '3' }), { email: 'hello@example.com', quantity: '3' });
  assert.throws(() => validateSubmission(definition, { email: 'invalid', quantity: '8' }));
  assert.throws(() => validateSubmission(definition, { email: ['a@example.com', 'b@example.com'] }));
  assert.throws(() => validateSubmission(definition, { email: 'hello@example.com', injected: 'value' }));
  assert.throws(() => validateSubmission(definition, {}));
  number.props.fieldName = 'email'; assert.throws(() => documentForms(doc), /unique/);
});
test('forms reject nesting and unsupported component identity', () => {
  const doc = emptyDocument(); const form = createNode('form'); doc.rootNodes.push(form); form.children.push(createNode('form'));
  assert.throws(() => documentForms(doc), /nested/); form.children.pop();
  doc.components.form = { name: 'Form', nodes: [createNode('form')] }; assert.throws(() => documentForms(doc), /component/);
});
test('form tokens bind cookie, page, form and revision and expire', () => {
  const cookie = 'a'.repeat(64); const now = Date.now(); const expiry = now + 10000;
  const token = createFormToken(cookie, 'page', 'form', 1, expiry);
  assert.match(verifyFormToken(token, cookie, 'page', 'form', 1, now), /^[a-f0-9-]{36}$/);
  assert.throws(() => verifyFormToken(token, 'b'.repeat(64), 'page', 'form', 1, now));
  assert.throws(() => verifyFormToken(token, cookie, 'other', 'form', 1, now));
  assert.throws(() => verifyFormToken(token, cookie, 'page', 'form', 2, now));
  assert.throws(() => verifyFormToken(token, cookie, 'page', 'form', 1, expiry + 1));
  assert.throws(() => verifyFormToken('invalid', cookie, 'page', 'form', 1, now));
});
test('CSV exports quote strings and neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=HYPERLINK("example")'), '"\'=HYPERLINK(""example"")"');
  assert.equal(csvCell('ordinary text'), '"ordinary text"');
});

test('loops render escaped real records and reject unsafe or unbounded queries', () => {
  const doc = emptyDocument(); const loop = createNode('loop'); doc.rootNodes.push(loop);
  assert.equal(documentLoops(doc)[0].query.limit, 6);
  const output = renderPage(doc, { loops: { [loop.id]: [{ title: '<script>unsafe</script>', excerpt: 'A real record', image: '', url: '/product/example', price: '100', sku: 'SKU', category: 'Test' }] } });
  assert.ok(output.html.includes('&lt;script&gt;unsafe&lt;/script&gt;')); assert.ok(output.html.includes('href="/product/example"'));
  loop.props.limit = 10000; assert.throws(() => documentLoops(doc)); loop.props.limit = 6;
  loop.children.push(createNode('loop')); assert.throws(() => documentLoops(doc), /Nested/); loop.children.pop();
  loop.children.push(createNode('form')); assert.throws(() => documentLoops(doc), /forms/); loop.children.pop();
  loop.children[0].attributes.id = 'repeated-id'; assert.throws(() => documentLoops(doc), /IDs/);
});

test('token usage includes fallback expressions and references from other tokens', () => {
  assert.equal(tokenUsageCount({ styles: { color: 'var(--brand, red)', background: 'var( --brand )' }, tokens: { accent: 'var(--brand)', other: 'var(--brand-alt)' } }, 'brand'), 3);
  assert.equal(tokenUsageCount({ color: 'var(--brand)' }, '.*'), 0);
});

test('header/footer fragments do not nest duplicate landmarks', () => {
  for (const region of ['header', 'footer'] as const) {
    const doc = emptyDocument(); const node = createNode('section');
    node.props.tag = region; doc.rootNodes = [node];
    const result = renderPage(doc, { region });
    assert.equal((result.html.match(new RegExp('<' + region + ' ', 'g')) || []).length, 1);
    assert.match(result.html, /^<div data-builder-page=/);
  }
});
