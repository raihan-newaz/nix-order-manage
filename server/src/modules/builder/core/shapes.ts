import { safeCssValue } from './styles';

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface ShapeDefinition {
  name: string;
  viewBox: string;
  svg: string;
  hasNegative?: boolean;
}

export const shapes: Record<string, ShapeDefinition> = {
  waves: {
    name: 'Waves',
    viewBox: '0 0 1000 100',
    svg: '<path d="M421.9,6.5c22.6-2.5,51.5,0.4,75.5,5.3c23.6,4.9,70.9,23.5,100.5,35.7c75.8,32.2,133.7,44.5,192.6,49.7c23.6,2.1,48.7,3.5,103.4-2.5c54.7-6,106.2-25.6,106.2-25.6V0H0v30.3c0,0,72,32.6,158.4,30.5c39.2-0.7,92.8-6.7,134-22.4c21.2-8.1,52.2-18.2,79.7-24.2C399.3,7.9,411.6,7.5,421.9,6.5z"/>',
    hasNegative: true
  },
  'wave-brush': {
    name: 'Wave Brush',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v100c52.6-1.5,99.6-11.2,143.1-23.7c47.7-13.7,91.3-30.8,137.9-42.3c48-11.9,98.1-17.7,148.5-17.3c49.2,0.4,97.7,6.8,144.3,18.7c43.6,11.2,85.2,26.4,128.5,38.8c46.7,13.4,96.3,23.2,148.6,25.3c50.7,2.1,100.8-4.9,149.1-19.5V0H0z"/>',
    hasNegative: false
  },
  mountains: {
    name: 'Mountains',
    viewBox: '0 0 1000 100',
    svg: '<path opacity="0.33" d="M473,67.3c-203.9,88.3-263.1-34-320.3,0C66,119.1,0,59.7,0,59.7V0h1000v59.7c0,0-62.1,26.1-94.9,29.3c-32.8,3.3-62.8-12.3-75.8-22.1C806,49.6,745.3,8.7,694.9,4.7S492.4,59,473,67.3z"/><path opacity="0.66" d="M734,67.3c-45.5,0-77.2-23.2-129.1-39.1c-28.6-8.7-150.3-10.1-254,39.1s-91.7-34.4-149.2,0C115.7,118.3,0,39.8,0,39.8V0h1000v36.5c0,0-28.2-18.5-92.1-18.5C810.2,18.1,775.7,67.3,734,67.3z"/><path d="M766.1,28.9c-200-57.5-266,65.5-395.1,19.5C242,1.8,242,5.4,184.8,20.6C128,35.8,132.3,44.9,89.9,52.5C28.6,63.7,0,0,0,0h1000c0,0-9.9,40.9-83.6,48.1S829.6,47,766.1,28.9z"/>',
    hasNegative: false
  },
  drops: {
    name: 'Drops',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v100c50-20,100-30,150-10c50,20,100,20,150,0c50-20,100-20,150,10c50,30,100,10,150-10c50-20,100,0,150,20c50,20,100,0,150-30c35-21,70-40,100-80V0H0z"/>',
    hasNegative: true
  },
  clouds: {
    name: 'Clouds',
    viewBox: '0 0 1000 100',
    svg: '<path opacity="0.4" d="M0,0v60c30,15,70,15,100-5c35-23,75-10,110,10c40,23,90,18,130-10c45-31,95-20,140,5c45,25,95,15,140-10c40-23,90-25,130-5c45,22,95,20,140-5c35-20,75-20,110,0V0H0z"/><path d="M0,0v40c35,20,75,20,110,0c45-25,95-27,140-5c40,20,90,18,130-5c45-25,95-15,140,10c45,25,95,36,140,5c40-28,90-33,130-10c35,20,75,33,110,10c30-20,70-20,100-5V0H0z"/>',
    hasNegative: true
  },
  zigzag: {
    name: 'Zigzag',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v80l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60l50-60l50,60V0H0z"/>',
    hasNegative: false
  },
  pyramids: {
    name: 'Pyramids',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v100l250-70l250,70l250-70l250,70V0H0z"/>',
    hasNegative: true
  },
  triangle: {
    name: 'Triangle',
    viewBox: '0 0 1000 100',
    svg: '<path d="M500,97L0,0h1000L500,97z"/>',
    hasNegative: true
  },
  'triangle-asymmetrical': {
    name: 'Triangle Asymmetrical',
    viewBox: '0 0 1000 100',
    svg: '<path d="M700,97L0,0h1000L700,97z"/>',
    hasNegative: true
  },
  tilt: {
    name: 'Tilt',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v100L1000,0H0z"/>',
    hasNegative: false
  },
  curve: {
    name: 'Curve',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v60c300,50,700,50,1000,0V0H0z"/>',
    hasNegative: true
  },
  'curve-asymmetrical': {
    name: 'Curve Asymmetrical',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v40c300,80,800,20,1000,0V0H0z"/>',
    hasNegative: true
  },
  arrow: {
    name: 'Arrow',
    viewBox: '0 0 1000 100',
    svg: '<path d="M500,100L0,0h1000L500,100z"/>',
    hasNegative: true
  },
  split: {
    name: 'Split',
    viewBox: '0 0 1000 100',
    svg: '<path d="M500,0L0,100V0h1000v100L500,0z"/>',
    hasNegative: true
  },
  book: {
    name: 'Book',
    viewBox: '0 0 1000 100',
    svg: '<path d="M0,0v80c250-40,500,40,500,40s250-80,500-40V0H0z"/>',
    hasNegative: true
  }
};

export function renderShapeDivider(
  shapeKey: string,
  side: 'top' | 'bottom',
  options: {
    color?: string;
    height?: number | string;
    flip?: boolean;
    invert?: boolean;
    bringToFront?: boolean;
  } = {}
): string {
  const shape = Object.prototype.hasOwnProperty.call(shapes, shapeKey) ? shapes[shapeKey] : undefined;
  if (!shape) return '';
  const color = safeCssValue(String(options.color || 'currentColor')) ? escapeAttribute(String(options.color || 'currentColor')) : 'currentColor';
  const rawHeight = typeof options.height === 'number' ? `${options.height}px` : options.height || '50px';
  const height = safeCssValue(rawHeight) ? escapeAttribute(rawHeight) : '50px';
  const flip = options.flip ? 'scaleX(-1)' : '';
  const invert = options.invert ? 'scaleY(-1)' : '';
  const transform = [flip, invert].filter(Boolean).join(' ') || undefined;
  const zIndex = options.bringToFront ? 10 : 1;

  const styleParts = [
    `position:absolute`,
    `left:0`,
    `width:100%`,
    `overflow:hidden`,
    `line-height:0`,
    `direction:ltr`,
    `z-index:${zIndex}`,
    `${side}:0`,
    side === 'bottom' ? 'transform:rotate(180deg)' : ''
  ].filter(Boolean).join(';');

  const svgTransform = transform ? ` style="transform:${transform};transform-origin:center;"` : '';

  return `<div class="builder-shape-divider builder-shape-${side}" style="${styleParts}" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.viewBox}" preserveAspectRatio="none" style="display:block;width:calc(100% + 1.3px);height:${height};fill:${color};"${svgTransform}>${shape.svg}</svg></div>`;
}
