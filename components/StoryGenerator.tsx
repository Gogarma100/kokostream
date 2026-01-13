import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, History, Upload } from 'lucide-react';
import { Story } from '../types';

interface StoryGeneratorProps {
  onGenerate: (prompt: string) => void;
  onLoadDraft: (story: Story) => void;
  isGenerating: boolean;
}

export const StoryGenerator: React.FC<StoryGeneratorProps> = ({ onGenerate, onLoadDraft, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check for existing draft on mount
    try {
        const draft = localStorage.getItem('koko_story_draft');
        if (draft) setHasDraft(true);
    } catch (e) {
        // ignore
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt);
    }
  };

  const handleResume = () => {
      try {
          const draftJson = localStorage.getItem('koko_story_draft');
          if (draftJson) {
              const story = JSON.parse(draftJson) as Story;
              onLoadDraft(story);
          }
      } catch (e) {
          console.error("Failed to load draft", e);
      }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const story = JSON.parse(content) as Story;
        if (story && story.scenes) {
          onLoadDraft(story);
        } else {
          alert("Invalid story file format.");
        }
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to parse story file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const suggestions = [
    "A cyberpunk detective searching for a missing android in a neon city",
    "A lonely lighthouse keeper who befriends a whale",
    "The discovery of a hidden temple in the Amazon rainforest",
    "A space delivery driver's first day on Mars"
  ];

  return (
    <div className="max-w-2xl w-full mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="font-display text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-indigo-400 mb-4">
          KokoStream
        </h1>
        <p className="text-slate-400 text-lg">
          Turn your ideas into an audiovisual experience instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full relative group z-20">
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-slate-900 rounded-lg p-1.5 border border-slate-700">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a story..."
            className="w-full bg-transparent text-white px-4 py-3 outline-none text-lg placeholder-slate-500"
            disabled={isGenerating}
          />
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-md font-semibold transition-all
              ${isGenerating || !prompt.trim() 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/50'}
            `}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                Creating...
              </span>
            ) : (
              <>
                <Sparkles size={18} />
                Generate
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {hasDraft && !isGenerating && (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 bg-indigo-900/30 hover:bg-indigo-900/50 px-4 py-2 rounded-full text-sm transition-all border border-indigo-500/30 animate-fade-in"
            >
              <History size={14} />
              Resume draft
            </button>
        )}

        <button
          onClick={handleImportClick}
          disabled={isGenerating}
          className="flex items-center gap-2 text-teal-300 hover:text-teal-200 bg-teal-900/30 hover:bg-teal-900/50 px-4 py-2 rounded-full text-sm transition-all border border-teal-500/30 animate-fade-in"
        >
          <Upload size={14} />
          Import Story
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".kokostream,.json" 
          className="hidden" 
        />
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => setPrompt(suggestion)}
            className="text-left text-sm text-slate-400 p-3 rounded bg-slate-800/50 hover:bg-slate-800 hover:text-teal-200 transition-colors border border-transparent hover:border-slate-700"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
