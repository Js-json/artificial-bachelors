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
import { GlobalWorkerOptions, version } from 'pdfjs-dist';
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

import 'react-pdf-highlighter/dist/style.css';

interface PdfViewerProps {
  url: string;
  highlights: IHighlight[];
  onAddHighlight: (highlight: NewHighlight, text: string, isAi: boolean) => void;
}

const getSurroundingContext = (pageNumber: number, selectedText?: string): string => {
  try {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;
      while (container && container !== document.body) {
        if (
          container instanceof HTMLElement &&
          (container.classList.contains('textLayer') ||
            container.classList.contains('PdfHighlighter__page') ||
            container.getAttribute('data-page-number') === String(pageNumber))
        ) {
          break;
        }
        container = container.parentNode;
      }

      const fullText = (container?.textContent || '').replace(/\s+/g, ' ');

      if (selectedText && fullText.includes(selectedText)) {
        const idx = fullText.indexOf(selectedText);
        const start = Math.max(0, idx - 400);
        const end = Math.min(fullText.length, idx + selectedText.length + 400);
        return fullText.slice(start, end).trim();
      } else if (fullText) {
        return fullText.slice(0, 1000).trim();
      }
    }
  } catch (err) {
    console.warn('Could not extract surrounding context:', err);
  }
  return '';
};

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, highlights, onAddHighlight }) => {
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <PdfLoader url={url} beforeLoad={<div className="p-4 flex items-center justify-center h-full">Loading PDF...</div>}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={() => {}}
            scrollRef={() => {}}
            onSelectionFinished={(
              position,
              content,
              hideTipAndSelection
            ) => {
              console.log('--- Selection Captured ---');
              console.log('Selected text:', content.text);
              console.log('Page number:', position.pageNumber);
              console.log('Position data:', position);

              const surroundingContext = getSurroundingContext(position.pageNumber, content.text);

              return (
                <AnnotationPopup
                  content={content}
                  surroundingContext={surroundingContext}
                  onSave={(noteOrExplanation, isAi) => {
                    onAddHighlight(
                      {
                        position,
                        content,
                        comment: {
                          text: noteOrExplanation,
                          emoji: isAi ? '🤖' : '✍️',
                        },
                      },
                      noteOrExplanation,
                      isAi
                    );
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
              _viewportToScaled,
              _screenshot,
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

              const isAi = (highlight.comment as any)?.is_ai ?? (highlight.comment?.emoji === '🤖');

              return (
                <Popup
                  popupContent={
                    <div className="p-3 bg-white rounded-lg shadow-xl text-sm max-w-xs border border-gray-100 flex flex-col gap-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                        <span>💡 {isAi ? 'AI Explanation' : 'Human Note'}</span>
                      </div>
                      <p className="text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">{highlight.comment?.text}</p>
                    </div>
                  }
                  onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
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
