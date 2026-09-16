import React, { useState } from 'react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface AnnotationPopupProps {
  content: { text?: string; image?: string };
  surroundingContext?: string;
  onSave: (explanationOrNote: string, isAi: boolean) => void;
}

export const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  content,
  surroundingContext,
  onSave,
}) => {
  const [mode, setMode] = useState<'action' | 'note'>('action');
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleExplain = async () => {
    if (!content.text) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: content.text,
          surroundingContext: surroundingContext || '',
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }

      if (data.explanation) {
        setExplanation(data.explanation);
      } else {
        throw new Error('No explanation returned from server');
      }
    } catch (err: any) {
      console.error('Explanation error:', err);
      setError(err?.message || 'Failed to fetch AI explanation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 flex flex-col gap-3 min-w-[280px] max-w-md z-50">
      {mode === 'note' ? (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('action')}
              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Add My Note</p>
          </div>

          {content.text && (
            <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200 italic max-h-20 overflow-y-auto">
              "{content.text}"
            </div>
          )}

          <textarea
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="Type your explanation or summary..."
            className="w-full text-sm text-gray-800 border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-24"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={() => onSave(userNote.trim(), false)}
              disabled={!userNote.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save to Document
            </button>
          </div>
        </>
      ) : !explanation ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Selected Text Action</p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex flex-col gap-2 text-xs text-red-700">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>Failed to generate explanation</span>
              </div>
              <p className="text-red-600">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleExplain}
              disabled={loading || !content.text}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>🤖 Explain with AI</>
              )}
            </button>
            <button
              onClick={() => setMode('note')}
              disabled={loading}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              ✍️ Add My Note
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-800 bg-indigo-50/80 p-3 rounded-lg border border-indigo-100 max-h-56 overflow-y-auto space-y-1.5">
            <h4 className="font-semibold text-indigo-900 text-xs uppercase tracking-wider">AI Explanation</h4>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{explanation}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave(explanation, true)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Save to Document
            </button>
          </div>
        </>
      )}
    </div>
  );
};


