import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  // Page 1: Welcome & Overview
  const page1 = pdfDoc.addPage([600, 800]);
  
  // Header Banner
  page1.drawRectangle({
    x: 0,
    y: 720,
    width: 600,
    height: 80,
    color: rgb(0.08, 0.45, 0.91),
  });

  page1.drawText('PDF EDITOR PRO - SAMPLE DOCUMENT', {
    x: 40,
    y: 750,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Welcome to your all-in-one Web PDF Editor!', {
    x: 40,
    y: 730,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.85, 0.92, 1),
  });

  // Section 1: Features
  page1.drawText('Key Editing Capabilities:', {
    x: 40,
    y: 670,
    size: 15,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.1, 0.2),
  });

  const features = [
    '1. Add & Edit Custom Text: Click anywhere on any page to insert custom text.',
    '2. Freehand Pencil & Pen: Draw, sketch, and scribble directly on PDF pages.',
    '3. Translucent Highlighter: Highlight important sentences with custom colors.',
    '4. Shape Overlay: Draw Rectangles, Circles, Arrows, and Straight Lines.',
    '5. Image Stamps & Signatures: Upload transparent PNG signatures & images.',
    '6. Whiteout & Redaction: Cover sensitive information with privacy blocks.',
    '7. Page Operations: Rotate, reorder, delete, or insert new blank pages.',
    '8. True PDF Export: Save all changes into standard PDF files instantly.'
  ];

  let currentY = 640;
  features.forEach(feat => {
    page1.drawText(feat, {
      x: 50,
      y: currentY,
      size: 11,
      font: fontHelvetica,
      color: rgb(0.2, 0.25, 0.35),
    });
    currentY -= 24;
  });

  // Interactive Test Box
  page1.drawRectangle({
    x: 40,
    y: 380,
    width: 520,
    height: 50,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.2, 0.5, 0.9),
    borderWidth: 1,
  });

  page1.drawText('TRY THIS: Use the Highlighter tool above to highlight this text block, or select the Pencil tool to draw a checkmark below!', {
    x: 55,
    y: 400,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.3, 0.7),
  });

  // Redaction Sample Box
  page1.drawRectangle({
    x: 40,
    y: 280,
    width: 520,
    height: 70,
    color: rgb(0.98, 0.95, 0.95),
    borderColor: rgb(0.9, 0.3, 0.3),
    borderWidth: 1,
  });

  page1.drawText('CONFIDENTIAL SAMPLE DATA (Test Redaction Tool)', {
    x: 55,
    y: 325,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.7, 0.1, 0.1),
  });

  page1.drawText('Secret Key: SK-998822-CONFIDENTIAL-2026', {
    x: 55,
    y: 305,
    size: 10,
    font: fontCourier,
    color: rgb(0.3, 0.3, 0.3),
  });

  page1.drawText('Use the Whiteout tool to obscure the Secret Key string above.', {
    x: 55,
    y: 290,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer
  page1.drawText('Page 1 of 2 - PDF Editor Pro Demo Document', {
    x: 200,
    y: 30,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Page 2: Notes & Playground
  const page2 = pdfDoc.addPage([600, 800]);

  page2.drawText('PDF Editor Playground & Signature Page', {
    x: 40,
    y: 750,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page2.drawText('You can test page reordering, signature insertion, and page rotation here.', {
    x: 40,
    y: 725,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Signature Block Template
  page2.drawRectangle({
    x: 40,
    y: 500,
    width: 250,
    height: 120,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('AUTHORIZED SIGNATURE:', {
    x: 50,
    y: 595,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.35, 0.45),
  });

  page2.drawLine({
    start: { x: 50, y: 530 },
    end: { x: 270, y: 530 },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });

  page2.drawText('Sign above using Pencil tool or Upload Image', {
    x: 50,
    y: 515,
    size: 8,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Date Block Template
  page2.drawRectangle({
    x: 310,
    y: 500,
    width: 250,
    height: 120,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('DATE & STAMP:', {
    x: 320,
    y: 595,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.35, 0.45),
  });

  page2.drawText('Click Text Tool to type current date', {
    x: 320,
    y: 550,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer
  page2.drawText('Page 2 of 2 - PDF Editor Pro Demo Document', {
    x: 200,
    y: 30,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
