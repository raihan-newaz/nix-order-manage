import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../prisma';
import { saveLandingCheckout, publishLanding } from '../landingService';

test('publication flow: saving checkout draft keeps live StorePage blocks and status unchanged', async () => {
  const originalLink = prisma.builderLanding.findUnique;
  const originalStorePage = prisma.storePage.findUnique;
  const originalDraftFind = prisma.landingCheckoutDraft.findUnique;
  const originalDraftUpdate = prisma.landingCheckoutDraft.updateMany;
  const originalDraftCreate = prisma.landingCheckoutDraft.create;
  const originalStorePageUpdate = prisma.storePage.update;

  let storePageUpdated = false;

  const mockStorePage = {
    id: 'store-page-1',
    title: 'Live Landing',
    slug: 'flow-test-landing',
    metaTitle: 'Live Meta Title',
    metaDescription: 'Live Meta Description',
    status: 'PUBLISHED',
    isActive: true,
    blocks: JSON.stringify([
      {
        id: 'checkout-live',
        type: 'CHECKOUT',
        heading: 'Live Checkout Heading',
        productIds: ['prod-1'],
        selection: 'SINGLE',
        minProducts: 1,
        maxProducts: 1,
        couponEnabled: true,
        paymentMethods: ['COD'],
        buttonText: 'Order Now',
        style: { background: '#fff', color: '#000', accent: '#000' }
      }
    ]),
    checkoutDraft: null,
  };

  const mockBuilderLanding = {
    id: 'link-1',
    builderPageId: 'builder-page-1',
    storePageId: 'store-page-1',
    thankYouPageId: 'thank-you-1',
    storePage: mockStorePage,
    builderPage: { version: 1, publishedVersion: 1 },
  };

  try {
    (prisma.builderLanding as any).findUnique = async () => mockBuilderLanding;
    (prisma.storePage as any).findUnique = async () => mockStorePage;
    (prisma.landingCheckoutDraft as any).findUnique = async () => null;
    (prisma.landingCheckoutDraft as any).create = async () => ({ version: 1 });
    (prisma.storePage as any).update = async () => {
      storePageUpdated = true;
      return mockStorePage;
    };

    const newDraftCheckout = {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
      type: 'CHECKOUT',
      heading: 'Draft Checkout Heading (Work in Progress)',
      productIds: ['11111111-2222-4333-8444-555555555555'],
      selection: 'SINGLE',
      minProducts: 1,
      maxProducts: 1,
      couponEnabled: false,
      paymentMethods: ['COD'],
      buttonText: 'Draft Order Button',
      style: { background: '#000000', color: '#ffffff', accent: '#ffffff' }
    };

    await saveLandingCheckout('builder-page-1', {
      title: 'Updated Draft Title',
      metaTitle: 'Draft SEO',
      metaDescription: 'Draft Desc',
      checkout: newDraftCheckout,
      version: 0,
    });

    // Verify live StorePage was NOT modified by saving a draft
    assert.equal(storePageUpdated, false, 'StorePage must remain unchanged when saving draft checkout');
  } finally {
    prisma.builderLanding.findUnique = originalLink;
    prisma.storePage.findUnique = originalStorePage;
    prisma.landingCheckoutDraft.findUnique = originalDraftFind;
    prisma.landingCheckoutDraft.updateMany = originalDraftUpdate;
    prisma.landingCheckoutDraft.create = originalDraftCreate;
    prisma.storePage.update = originalStorePageUpdate;
  }
});

test('publication flow: failed publish leaves previous live revision intact', async () => {
  const originalLink = prisma.builderLanding.findUnique;
  const originalStorePageUpdate = prisma.storePage.update;
  const originalBuilderUpdate = prisma.builderPage.updateMany;

  let storePagePublished = false;
  let builderPagePublished = false;

  const mockStorePage = {
    id: 'store-page-1',
    title: 'Live Landing',
    slug: 'flow-test-landing',
    metaTitle: 'Live Meta Title',
    metaDescription: 'Live Meta Description',
    status: 'PUBLISHED',
    isActive: true,
    blocks: JSON.stringify([
      {
        id: 'checkout-live',
        type: 'CHECKOUT',
        heading: 'Live Checkout',
        productIds: ['prod-1'],
        selection: 'SINGLE',
        minProducts: 1,
        maxProducts: 1,
        couponEnabled: true,
        paymentMethods: ['COD'],
        buttonText: 'Order Now',
        style: { background: '#fff', color: '#000', accent: '#000' }
      }
    ]),
    checkoutDraft: {
      version: 2,
      title: 'Conflicting Draft',
      metaTitle: 'Draft Meta',
      metaDescription: 'Draft Desc',
      blocks: JSON.stringify([
        {
          id: 'checkout-draft',
          type: 'CHECKOUT',
          heading: 'Draft Heading',
          productIds: [], // Invalid: checkout requires at least 1 product
          selection: 'SINGLE',
          minProducts: 1,
          maxProducts: 1,
          couponEnabled: true,
          paymentMethods: ['COD'],
          buttonText: 'Submit',
          style: { background: '#fff', color: '#000', accent: '#000' }
        }
      ]),
    },
  };

  const mockBuilderLanding = {
    id: 'link-1',
    builderPageId: 'builder-page-1',
    storePageId: 'store-page-1',
    thankYouPageId: 'thank-you-1',
    storePage: mockStorePage,
    builderPage: {
      id: 'builder-page-1',
      version: 1,
      publishedVersion: 1,
      draft: JSON.stringify({
        schemaVersion: 1,
        id: 'builder-page-1',
        title: 'Draft Design',
        slug: 'test-landing',
        description: '',
        status: 'draft',
        themeConfig: { colorScheme: 'light', fontScale: 1 },
        globalStyles: {},
        cssRules: [],
        fonts: [],
        seo: { title: '', description: '' },
        breakpoints: { desktop: 1200, tablet: 768, mobile: 375 },
        rootNodes: [],
        revisions: [],
      }),
    },
  };

  try {
    (prisma.builderLanding as any).findUnique = async () => mockBuilderLanding;
    (prisma.storePage as any).update = async () => {
      storePagePublished = true;
    };
    (prisma.builderPage as any).updateMany = async () => {
      builderPagePublished = true;
      return { count: 1 };
    };

    // Attempt publish with stale version / invalid checkout
    let publishError: any = null;
    try {
      await publishLanding('builder-page-1', 999, { id: 'user-1', name: 'Admin' });
    } catch (err) {
      publishError = err;
    }

    assert.ok(publishError, 'Expected publish to fail due to version mismatch');
    assert.equal(storePagePublished, false, 'StorePage must not be updated if publish fails');
    assert.equal(builderPagePublished, false, 'BuilderPage must not be updated if publish fails');
  } finally {
    prisma.builderLanding.findUnique = originalLink;
    prisma.storePage.update = originalStorePageUpdate;
    prisma.builderPage.updateMany = originalBuilderUpdate;
  }
});
