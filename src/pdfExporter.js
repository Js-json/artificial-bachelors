import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function exportModifiedPdf(originalPdfBytes, pageList, pageAnnotationsMap) {
  let srcDoc;
  if (originalPdfBytes && originalPdfBytes.length > 0) {
    srcDoc = await PDFDocument.load(originalPdfBytes);
  } else {
    srcDoc = await PDFDocument.create();
  }

  // Create new destination PDF document
  const outDoc = await PDFDocument.create();
  const fontHelvetica = await outDoc.embedFont(StandardFonts.Helvetica);

  for (let idx = 0; idx < pageList.length; idx++) {
    const pageMeta = pageList[idx];
    let newPage;

    if (pageMeta.isBlank || pageMeta.originalIndex < 1) {
      newPage = outDoc.addPage([600, 800]);
    } else {
      const [copiedPage] = await outDoc.copyPages(srcDoc, [pageMeta.originalIndex - 1]);
      newPage = outDoc.addPage(copiedPage);
    }

    // Apply Page Rotation
    if (pageMeta.rotation !== 0) {
      const currentRotation = newPage.getRotation().angle;
      newPage.setRotation(newPage.getRotation());
    }

    const { width: pdfWidth, height: pdfHeight } = newPage.getSize();
    const annotations = pageAnnotationsMap[idx + 1] || [];

    for (let ann of annotations) {
      const canvasWidth = ann.canvasWidth || pdfWidth;
      const canvasHeight = ann.canvasHeight || pdfHeight;

      const scaleX = pdfWidth / canvasWidth;
      const scaleY = pdfHeight / canvasHeight;

      if (ann.type === 'whiteout') {
        const x = ann.x * scaleX;
        const y = pdfHeight - (ann.y + ann.height) * scaleY;
        const w = ann.width * scaleX;
        const h = ann.height * scaleY;

        newPage.drawRectangle({
          x: x,
          y: y,
          width: w,
          height: h,
          color: rgb(1, 1, 1),
        });
      } else if (ann.type === 'rect') {
        const x = ann.x * scaleX;
        const y = pdfHeight - (ann.y + ann.height) * scaleY;
        const w = ann.width * scaleX;
        const h = ann.height * scaleY;
        const c = hexToRgb(ann.color);

        newPage.drawRectangle({
          x: x,
          y: y,
          width: w,
          height: h,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: (ann.strokeWidth || 2) * scaleX,
          opacity: ann.opacity !== undefined ? ann.opacity : 1.0,
        });
      } else if (ann.type === 'text') {
        const x = ann.x * scaleX;
        const y = pdfHeight - ann.y * scaleY;
        const fontSize = (ann.fontSize || 16) * scaleY;
        const c = hexToRgb(ann.color);

        newPage.drawText(ann.text, {
          x: x,
          y: y,
          size: fontSize,
          font: fontHelvetica,
          color: rgb(c.r, c.g, c.b),
          opacity: ann.opacity !== undefined ? ann.opacity : 1.0,
        });
      } else if (ann.type === 'draw' || ann.type === 'highlight') {
        if (ann.points && ann.points.length > 1) {
          const c = hexToRgb(ann.color);
          const opacity = ann.type === 'highlight' ? 0.4 : (ann.opacity !== undefined ? ann.opacity : 1.0);
          const thickness = (ann.strokeWidth || 3) * scaleX;

          for (let p = 0; p < ann.points.length - 1; p++) {
            const p1 = ann.points[p];
            const p2 = ann.points[p + 1];

            const x1 = p1.x * scaleX;
            const y1 = pdfHeight - p1.y * scaleY;
            const x2 = p2.x * scaleX;
            const y2 = pdfHeight - p2.y * scaleY;

            newPage.drawLine({
              start: { x: x1, y: y1 },
              end: { x: x2, y: y2 },
              thickness: thickness,
              color: rgb(c.r, c.g, c.b),
              opacity: opacity,
            });
          }
        }
      } else if (ann.type === 'image' && ann.src) {
        try {
          let embeddedImage;
          if (ann.src.startsWith('data:image/png')) {
            embeddedImage = await outDoc.embedPng(ann.src);
          } else if (ann.src.startsWith('data:image/jpeg') || ann.src.startsWith('data:image/jpg')) {
            embeddedImage = await outDoc.embedJpg(ann.src);
          } else {
            // Convert to dataUrl fetch
            const imgBytes = await fetch(ann.src).then(res => res.arrayBuffer());
            embeddedImage = await outDoc.embedPng(imgBytes);
          }

          const x = ann.x * scaleX;
          const y = pdfHeight - (ann.y + ann.height) * scaleY;
          const w = ann.width * scaleX;
          const h = ann.height * scaleY;

          newPage.drawImage(embeddedImage, {
            x: x,
            y: y,
            width: w,
            height: h,
            opacity: ann.opacity !== undefined ? ann.opacity : 1.0,
          });
        } catch (err) {
          console.error('Failed to embed image in PDF export:', err);
        }
      }
    }
  }

  const modifiedPdfBytes = await outDoc.save();
  return modifiedPdfBytes;
}

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}
