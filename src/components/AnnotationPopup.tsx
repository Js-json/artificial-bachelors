import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AnnotationPopupProps {
  content: { text?: string; image?: string };
  onSave: (explanation?: string) => void;
}

export const AnnotationPopup: React.FC<AnnotationPopupProps> = ({ content, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleExplain = async () => {
    if (!content.text) return;
    setLoading(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content.text })
      });
      const data = await res.json();
      if (data.explanation) {
        setExplanation(data.explanation);
      }
    } catch (error) {
      console.error('Explanation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 flex flex-col gap-3 min-w-[250px] max-w-sm z-50">
      {!explanation ? (
        <>
          <p className="text-sm text-gray-700 font-medium">Selected text action</p>
          <div className="flex gap-2">
            <button
              onClick={handleExplain}
              disabled={loading || !content.text}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Explain with AI
            </button>
            <button
              onClick={() => onSave()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm transition-colors"
            >
              Just Highlight
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-800 bg-indigo-50 p-3 rounded border border-indigo-100 max-h-48 overflow-y-auto">
            <strong>AI Explanation:</strong>
            <p className="mt-1">{explanation}</p>
          </div>
          <button
            onClick={() => onSave(explanation)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
          >
            Save Annotation
          </button>
        </>
      )}
    </div>
  );
};
