# Widget SDK

The framework-independent SDK is in `server/src/modules/builder/core/registry.ts`.
Definitions are registered once before application startup. The editor palette,
inspector, nesting rules and renderer use the same registry. Addons are trusted
application code, not uploaded JavaScript. Duplicate registrations are rejected.

Each definition declares a stable lowercase type, display name/category, widget
version, whether it accepts children, scalar defaults, control definitions and a
render function. Optional migration code transforms older widget props. Stored
documents refer only to the stable type/version, never React module names.

```ts
widgets.register({
  type: 'delivery-note', name: 'Delivery note', category: 'Store', version: 1,
  children: false, defaults: { text: 'Delivery information' },
  controls: [{ key: 'text', label: 'Message', type: 'textarea' }],
  render: (node, _children, attributes) =>
    `<aside${attributes}>${escapeHtml(node.props.text)}</aside>`,
});
```

The built-in `notice` is a complete addon example. Register additions in a shared
module imported by both editor and public renderer. Escape text with escapeHtml,
URLs with urlAttribute, and use only fixed/allowlisted HTML tag names. Never
concatenate unvalidated props into HTML, CSS, scripts or selectors. A plugin that
needs richer props must extend schema validation and tests explicitly.

Nested widgets receive rendered arbitrary children. The core includes semantic
containers, Flexbox/Grid, text/heading, paragraph, blockquote, code, badge,
link/button, image/video/audio, divider/spacer/anchor, nested native details,
progress, notice, native forms/typed fields/submit buttons and reusable component instances. The native details widget
provides keyboard-operable accordion panels without a script bundle.

Every new widget needs default/configured render, escaping, serialization,
responsive CSS, migration and malformed-input tests in core.test.ts. Add browser
tests for interactive behavior and accessible names. No external runtime script
is supported by this milestone's strict public CSP; introduce one through an
explicit reviewed asset pipeline rather than inline event handlers.

Forms accept arbitrary layout children but cannot nest or be placed inside
component masters. The form container automatically starts with a text field and
submit button. Field keys are generated uniquely and regenerated when copying a
field. Supported field types: text, email, phone, URL, number, textarea, select,
checkbox/acceptance, date, time, range and hidden. Validation uses the published
definition; fields outside a form, duplicate keys and unsupported types are rejected.
