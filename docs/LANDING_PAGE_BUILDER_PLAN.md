# Landing page builder plan

## Goal and reference

Build unlimited, product-focused landing pages at `/:slug`. Each page presents persuasive content first and an embedded single-page checkout at the bottom. The provided Arabic Fashion example uses a mobile stack of headline, video, repeated order buttons, gallery, benefits, size guide, product choices, customer details, delivery charge, order summary and payment. CartFlows documents this same landing-content-plus-checkout-form pattern.

## Architecture

- Reuse the existing `StorePage` persistence and publication API. Prefix landing slugs with `flow-`, avoiding a database migration. Keep normal information pages out of the landing page manager and vice versa.
- Save a validated ordered block tree in `StorePage.blocks`. Permit up to 50 blocks per page; there is no page-count limit. The server sanitizes rich HTML and validates URLs, colors, sizes, product IDs and style tokens.
- Render `/:slug` on the storefront, while redirecting old `/flow/:slug` links to the clean URL. Load selected products from the existing public product API. Checkout posts selected IDs/quantities to the existing server-side price/stock/order validation endpoint; client prices are display only.
- Use one checkout block at the end of the page. CTA blocks scroll to `#order`; no cart route is required. COD and existing online payment integration remain available.

## Editor scope

1. Landing page list: search, create, duplicate, publish/draft, active/inactive, trash/restore, preview.
2. Ten editable starting templates. A blank layout can be made by removing the supplied content sections.
3. Block builder: hero, standalone text/image, YouTube video, image grid or carousel, benefits, size chart, testimonial, FAQ, CTA, spacer and checkout; add, edit, duplicate, reorder and delete. Product offers are configured inside checkout.
4. Section controls: colors, alignment, spacing and width with mobile-first defaults. Live desktop/mobile preview and autosave draft.
5. Campaign controls: slug, SEO title/description, product offer IDs and checkout button text. Delivery charges and available payment methods come from the existing store settings.
6. Responsive storefront rendering at 360px, tablet and desktop widths; large touch targets and no horizontal overflow.

## Ten template presets

1. Hajj combo package; 2. DevPro service; 3. Organic beauty product; 4. Rice skin serum; 5. Three-piece dress; 6. Classy combo; 7. Henna hair pack; 8. Pitha collection; 9. Sajone leaf powder; 10. Loafer shoe.

The presets use category-specific Bengali copy and section order inspired by the supplied references. Merchants replace the sample copy and add their own product images; the templates do not import third-party page assets or unsupported customer claims.

## Video and typography

- Accept YouTube watch, Shorts, live, embed and short links after validating the HTTPS video ID.
- Aspect ratio supports Auto (Shorts default to 9:16; standard videos default to 16:9), plus manual 16:9, 9:16, 4:3 and 1:1 overrides.
- Muted autoplay is optional. It is muted because browsers block most autoplay with sound.
- Section typography can use the theme default, Manrope or Hind Siliguri. Hind Siliguri is already loaded for Bengali pages.
- Blocks reorder by desktop drag and drop, touch drag from the grip, keyboard arrow keys or the up/down controls. Checkout stays last.

## Safety and verification

- Only published/active landing pages render publicly. Admin mutation routes retain server-side role checks.
- Block content is escaped or sanitized; video embeds use a bounded YouTube URL parser. No arbitrary script injection.
- Verify schema validation, build in all three apps, draft/public routing, product variation selection, price calculation, COD/online payment navigation and responsive preview. A live order requires a running store with configured products and payment settings.

## Verification record

- Production builds passed for server, admin client and storefront after adding text, image and size chart sections.
- A temporary published landing page loaded from the local database. The content sections and checkout rendered in the browser; the temporary record was removed afterward.
- At 320, 375, 768 and 1280px, the document width matched the viewport width. Checkout used one column on phone widths and two on tablet/desktop.
- Increasing quantity and changing delivery area updated the displayed subtotal, delivery charge and total. No test order was submitted.
- A variable product kept checkout disabled until an available option was selected. Selecting that option and adding a second product updated the multi-product total. The temporary test page was removed.
- Image sections can display a single image or up to 12 images as a swipeable carousel. Gallery sections can display a grid or carousel. YouTube links are restricted to valid HTTPS video IDs before publishing.
- Carousel browser smoke test passed: next arrow, dot selection and keyboard arrow changed the visible image; mobile viewport had no horizontal overflow. The temporary test harness was removed.
- Unauthenticated admin API returned 401. A draft landing page returned 404 from the public API.
- Admin editor interaction and an actual COD/online payment order still require an authenticated staging session.

## Follow-on capabilities beyond this release

Elementor Pro's complete ecosystem is a separate product-scale program. The builder here concentrates on the controls necessary to create and operate conversion landing pages safely. The next phases are:

1. **Layout system:** nested containers, columns, reusable sections, global colors/type, breakpoint-specific controls, tablet preview, spacing/typography/border/shadow controls, background media and version history.
2. **Content widgets:** rich text formatting, icons, countdown, comparison table, pricing, tabs, accordions, forms, product cards, badges and verified reviews. Add visibility conditions and dynamic product/store data bindings.
3. **Conversion tools:** order bumps, coupons, post-purchase upsells/downsells, abandoned checkout recovery, campaign analytics, A/B tests and reusable checkout field layouts. Each needs server-side price and authorization checks.
4. **Operations:** revision restore, approval workflow, scheduled publication, import/export, localization, asset optimization and accessibility checks.
5. **Verification:** browser tests on actual mobile widths, checkout tests against a staging payment account, slow-network image/video testing, performance budgets and security review before deployment.
