import assert from 'node:assert/strict';
import test from 'node:test';

import {
  alignedTextX,
  fitFontSizeToWidth,
  parseCertificateVisualLayout,
  resolveCertificateFieldPlacement,
} from '../src/features/certificates/providers/certificate-layout.ts';

test('normalized top-left placement converts to PDF bottom-left coordinates', () => {
  const field = { xRatio: 0.2, yRatio: 0.4, widthRatio: 0.5, fontSize: 20, align: 'center' };
  const placement = resolveCertificateFieldPlacement({ field, pageWidth: 1000, pageHeight: 600 });
  assert.equal(placement.x, 200);
  assert.equal(placement.y, 360);
  assert.equal(placement.width, 500);
});

test('visual layout parser accepts v2 and rejects non-v2 layouts', () => {
  const parsed = parseCertificateVisualLayout({
    visualLayout: {
      version: 2,
      name: { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.6, fontSize: 30, align: 'center' },
      completionDate: { xRatio: 0.4, yRatio: 0.8, widthRatio: 0.2, fontSize: 11, align: 'center' },
      certificateId: { xRatio: 0.02, yRatio: 0.95, widthRatio: 0.2, fontSize: 9, align: 'left' },
    },
  });
  assert.equal(parsed?.version, 2);
  assert.equal(parsed?.name.align, 'center');
  assert.equal(parseCertificateVisualLayout({ visualLayout: { version: 1 } }), null);
});

test('alignment and long-name fitting stay inside configured field', () => {
  const placement = { x: 100, y: 300, width: 400, fontSize: 30, align: 'center' };
  assert.equal(alignedTextX({ placement, textWidth: 200 }), 200);
  assert.equal(alignedTextX({ placement: { ...placement, align: 'right' }, textWidth: 200 }), 300);
  const size = fitFontSizeToWidth({
    text: 'A VERY LONG CERTIFICATE NAME THAT MUST FIT',
    preferredFontSize: 30,
    maxWidth: 300,
    minimumFontSize: 12,
    measure: (text, fontSize) => text.length * fontSize * 0.6,
  });
  assert.ok(size < 30);
  assert.ok(size >= 12);
});
