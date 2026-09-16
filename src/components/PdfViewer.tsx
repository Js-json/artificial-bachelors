import React from 'react';
import {
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
  PdfLoader
} from 'react-pdf-highlighter';
import type { IHighlight, NewHighlight } from 'react-pdf-highlighter';
import { AnnotationPopup } from './AnnotationPopup';

// Worker configuration
import { pdfjs } from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

import 'react-pdf-highlighter/dist/style.css';

interface PdfViewerProps {
  url: string;
  highlights: IHighlight[];
  onAddHighlight: (highlight: NewHighlight, explanation?: string) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, highlights, onAddHighlight }) => {
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <PdfLoader url={url} beforeLoad={<div className="p-4 flex items-center justify-center h-full">Loading PDF...</div>}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={() => {}}
            scrollRef={(scrollTo) => {}}
            onSelectionFinished={(
              position,
              content,
              hideTipAndSelection,
              transformSelection
            ) => {
              console.log('--- Selection Captured ---');
              console.log('Selected text:', content.text);
              console.log('Page number:', position.pageNumber);
              console.log('Position data:', position);

              return (
                <AnnotationPopup
                  content={content}
                  onSave={(explanation) => {
                    onAddHighlight({ position, content }, explanation);
                    hideTipAndSelection();
                  }}
                />
              );
            }}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              viewportToScaled,
              screenshot,
              isScrolledTo
            ) => {
              const isTextHighlight = !Boolean(highlight.content && highlight.content.image);

              const component = isTextHighlight ? (
                <Highlight isScrolledTo={isScrolledTo} position={highlight.position} comment={highlight.comment} />
              ) : (
                <AreaHighlight
                  isScrolledTo={isScrolledTo}
                  highlight={highlight}
                  onChange={() => {}}
                />
              );

              return (
                <Popup
                  popupContent={<div className="p-2 bg-white rounded shadow-lg text-sm max-w-xs">{highlight.comment?.text || highlight.comment?.explanation}</div>}
                  onMouseOver={(popupContent) => setTip(highlight, (highlight) => popupContent)}
                  onMouseOut={hideTip}
                  key={index}
                >
                  {component}
                </Popup>
              );
            }}
            highlights={highlights}
          />
        )}
      </PdfLoader>
    </div>
  );
};
