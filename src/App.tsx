import { useState } from 'react';
import { supabase } from './services/supabase';
import { PdfViewer } from './components/PdfViewer';
import { computeSHA256 } from './lib/crypto';
import type { IHighlight, NewHighlight } from 'react-pdf-highlighter';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';

function App() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadAnnotationsForHash = async (hash: string) => {
    try {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('document_hash', hash)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase query error:', error);
        setDbError(`Database notice: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const mapped: IHighlight[] = data.map((d: any) => {
          let x1 = d.rect_x ?? 0;
          let y1 = d.rect_y ?? 0;
          let w = d.rect_w ?? 0;
          let h = d.rect_h ?? 0;

          // Normalize legacy pixel coordinates if present
          if (x1 > 1 || w > 1 || y1 > 1 || h > 1) {
            const refW = w > 500 && (x1 + w > w) ? w : 800;
            const refH = 1100;
            x1 = x1 > 1 ? x1 / refW : x1;
            y1 = y1 > 1 ? y1 / refH : y1;
            w = w > 1 ? (w > 500 ? 0.3 : w / refW) : w;
            h = h > 1 ? h / refH : h;
          }

          const boundingRect = {
            x1,
            y1,
            x2: x1 + w,
            y2: y1 + h,
            width: 1,
            height: 1,
            pageNumber: d.page || 1,
          };

          return {
            id: d.id ? d.id.toString() : String(Math.random()).slice(2),
            position: {
              pageNumber: d.page || 1,
              boundingRect,
              rects: [boundingRect],
              usePdfCoordinates: false,
            },
            content: { text: d.selected_text || '' },
            comment: {
              text: d.explanation || '',
              emoji: d.is_ai ? '🤖' : '✍️',
              ...({ is_ai: d.is_ai } as any),
            },
          };
        });
        setHighlights(mapped);
      } else {
        setHighlights([]);
      }
    } catch (err: any) {
      console.error('Failed to query Supabase annotations:', err);
      setDbError(err?.message || 'Error querying annotations');
      setHighlights([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAnnotations(true);
    setDbError(null);

    try {
      const hash = await computeSHA256(file);
      setDocumentHash(hash);

      const url = URL.createObjectURL(file);
      setPdfUrl(url);

      await loadAnnotationsForHash(hash);
    } catch (err: any) {
      console.error('Failed to hash or load PDF:', err);
      setDbError(err?.message || 'Failed to compute SHA-256 hash or load annotations');
    } finally {
      setLoadingAnnotations(false);
    }
  };

  const handleAddHighlight = async (highlight: NewHighlight, text: string, isAi: boolean) => {
    const newId = String(Math.random()).slice(2);

    const b = highlight.position.boundingRect;
    const pageW = b.width || 1;
    const pageH = b.height || 1;

    const normX = b.x1 / pageW;
    const normY = b.y1 / pageH;
    const normW = (b.x2 - b.x1) / pageW;
    const normH = (b.y2 - b.y1) / pageH;

    const normalizedBoundingRect = {
      x1: normX,
      y1: normY,
      x2: normX + normW,
      y2: normY + normH,
      width: 1,
      height: 1,
      pageNumber: highlight.position.pageNumber,
    };

    const newHighlight: IHighlight = {
      ...highlight,
      id: newId,
      position: {
        ...highlight.position,
        boundingRect: normalizedBoundingRect,
        rects: [normalizedBoundingRect],
        usePdfCoordinates: false,
      },
      comment: {
        text,
        emoji: isAi ? '🤖' : '✍️',
        ...({ is_ai: isAi } as any),
      },
    };

    // Optimistic update of local state
    setHighlights((prev) => [...prev, newHighlight]);

    // Persist normalized ratios to Supabase annotations table
    if (documentHash) {
      try {
        const { error } = await supabase.from('annotations').insert({
          id: newId,
          document_hash: documentHash,
          page: highlight.position.pageNumber,
          selected_text: highlight.content.text || '',
          rect_x: normX,
          rect_y: normY,
          rect_w: normW,
          rect_h: normH,
          explanation: text,
          is_ai: isAi,
        });

        if (error) {
          console.error('Failed to persist annotation to Supabase:', error);
          setDbError(`Failed to save to database: ${error.message}`);
        }
      } catch (err: any) {
        console.error('Supabase insert exception:', err);
        setDbError(err?.message || 'Failed to save annotation to database');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">PDF Knowledge Layer</h1>
          {documentHash && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-700 border border-gray-200"
              title={`SHA-256: ${documentHash}`}
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              Hash: {documentHash.slice(0, 12)}...
            </span>
          )}
          {loadingAnnotations && (
            <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing annotations...
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors pointer-events-none">
            <Upload className="w-4 h-4" />
            Upload PDF
          </button>
        </div>
      </header>

      {dbError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{dbError}</span>
          </div>
          <button
            onClick={() => setDbError(null)}
            className="text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {pdfUrl ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-140px)]">
            <PdfViewer
              url={pdfUrl}
              highlights={highlights}
              onAddHighlight={handleAddHighlight}
            />
          </div>
        ) : (
          <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white relative hover:bg-gray-50 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">No PDF selected</h2>
            <p className="text-gray-500 mt-2">Click or drag a PDF here to start annotating and gaining insights.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

