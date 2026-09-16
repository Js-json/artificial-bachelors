import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import { PdfViewer } from './components/PdfViewer';
import type { IHighlight, NewHighlight } from 'react-pdf-highlighter';
import { Upload } from 'lucide-react';

function App() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);

  // Function to load highlights for a given PDF url
  const loadHighlights = async (url: string) => {
    try {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('pdf_id', url);
        
      if (error) throw error;
      
      if (data) {
        // Map data back to IHighlight format
        const mapped = data.map((d: any) => ({
          id: d.id.toString(),
          position: d.position,
          content: d.content,
          comment: { text: d.explanation }
        }));
        setHighlights(mapped);
      }
    } catch (err) {
      console.error('Failed to load highlights:', err);
    }
  };

  useEffect(() => {
    if (pdfUrl) {
      loadHighlights(pdfUrl);
    }
  }, [pdfUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, you'd upload this file to Supabase Storage and get a real URL
      // For this MVP, we use object URL for local state
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  };

  const handleAddHighlight = async (highlight: NewHighlight, explanation?: string) => {
    const newId = String(Math.random()).slice(2);
    const newHighlight: IHighlight = {
      ...highlight,
      id: newId,
      comment: {
        text: explanation || 'User note',
      },
    };
    
    // Optimistic update
    setHighlights((prev) => [...prev, newHighlight]);

    // Save to supabase
    if (pdfUrl) {
      try {
        await supabase.from('annotations').insert({
          id: newId,
          pdf_id: pdfUrl,
          position: highlight.position,
          content: highlight.content,
          explanation: explanation || 'User note'
        });
      } catch (err) {
        console.error('Failed to save highlight:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold text-gray-800">PDF Knowledge Layer</h1>
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

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {pdfUrl ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-120px)]">
            <PdfViewer
              url={pdfUrl}
              highlights={highlights}
              onAddHighlight={handleAddHighlight}
            />
          </div>
        ) : (
          <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white relative hover:bg-gray-50 transition-colors">
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
