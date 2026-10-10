# Control SDK

Control metadata is independent of the editor UI. A Control has `key`, `label`,
`type`, optional `options`, and optional `dynamic`. Supported implementations are
text, textarea, number, select, switch, URL and media. The media control embeds the
existing MediaPicker, so existing upload validation and authorization still apply.

Inspector fields commit on blur/Enter. Canvas text commits on blur after plain-text
paste sanitation. This avoids serializing and rerendering the document for every
keystroke. Rapid inspector changes group into a bounded undo history step.

The style property catalog is shared with server validation. Grouped, searchable
fields accept CSS units, color formats, safe gradients, calc/clamp and var tokens.
An empty local value removes the override. Breakpoint fields show inherited base
values; pseudo states are edited separately at desktop base. Combined responsive
pseudo-state controls are not yet supported.

To add a control, extend the Control union, implement the accessible inspector
input, add widget-prop validation and test API rejection of invalid values. Do not
add a palette/control entry before its renderer and persistence work end-to-end.

The current UI uses CSS value fields for spacing, gradients, typography and
effects. Linked dimension controls, visual gradient/color editors, rich text,
repeaters, queries and condition builders are future controls, not dummy buttons.

The Content loop widget now includes bounded provider, search, category, sort and
record-limit query controls. The dynamic-source selector includes public `item.*`
fields for children of a loop. Its editor context reloads when the query changes
or the editor is reloaded. Form fields expose type, required, options and numeric
bounds; field keys cannot be dynamic because the published schema owns submission
validation. Arbitrary query expressions and conditional-form controls remain pending.
