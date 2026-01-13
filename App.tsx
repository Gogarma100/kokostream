
import React, { useState } from 'react';
import { AppState, Story, GenerationProgress } from './types';
import { generateStoryScript, generateSceneImage, generateSceneAudio } from './services/gemini';
import { StoryGenerator } from './components/StoryGenerator';
import { StoryPlayer } from './components/StoryPlayer';
import { StoryEditor } from './components/StoryEditor';
import { VideoExporter } from './components/VideoExporter';
import { decodeBase64, decodeAudioData, getAudioContext } from './utils/audio';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [story, setStory] = useState<Story | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (prompt: string) => {
    try {
      setAppState(AppState.GENERATING_SCRIPT);
      setError(null);
      setProgress({ totalScenes: 0, completedScenes: 0, currentStep: 'Drafting your story...' });

      const generatedStory = await generateStoryScript(prompt);
      generatedStory.backgroundMusic = 'ethereal';

      setStory(generatedStory);
      setAppState(AppState.GENERATING_ASSETS);
      
      const totalScenes = generatedStory.scenes.length;
      setProgress({ totalScenes, completedScenes: 0, currentStep: 'Painting scenes and recording voiceovers...' });

      const enrichedScenes = await Promise.all(
        generatedStory.scenes.map(async (scene, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 200));

            const [imgData, audioResult] = await Promise.all([
                generateSceneImage(scene.imagePrompt),
                generateSceneAudio(scene.narrative)
            ]);

            setProgress(prev => {
                if(!prev) return null;
                const completed = Math.min(prev.completedScenes + 1, totalScenes);
                return { ...prev, completedScenes: completed };
            });

            return {
                ...scene,
                imageData: imgData,
                audioData: audioResult.buffer,
                audioBase64: audioResult.base64
            };
        })
      );

      setStory({ ...generatedStory, scenes: enrichedScenes });
      setAppState(AppState.REVIEW_STORY);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate story. Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleLoadDraft = async (draft: Story) => {
      setAppState(AppState.GENERATING_ASSETS); 
      setProgress({ totalScenes: draft.scenes.length, completedScenes: 0, currentStep: 'Restoring draft...' });
      
      try {
          const restoredScenes = await Promise.all(draft.scenes.map(async (scene) => {
              let audioData = scene.audioData;
              if (!audioData && scene.audioBase64) {
                   try {
                       const ctx = getAudioContext();
                       const raw = decodeBase64(scene.audioBase64);
                       audioData = await decodeAudioData(raw, ctx);
                   } catch (e) {
                       console.warn("Failed to decode audio for scene", scene.id, e);
                   }
              }
              return { ...scene, audioData };
          }));
          
          setStory({ ...draft, scenes: restoredScenes });
          setAppState(AppState.REVIEW_STORY);
      } catch (e) {
          setError("Failed to restore draft.");
          setAppState(AppState.ERROR);
      }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setStory(null);
    setProgress(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-teal-500/30">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-900/20 rounded-full blur-[120px]"></div>
        </div>

      <main className="relative z-10 container mx-auto px-4 py-8 flex flex-col min-h-screen">
        
        {appState !== AppState.PLAYING && appState !== AppState.EXPORTING && (
           <header className="flex justify-between items-center py-4 mb-8">
              <div className="flex items-center gap-2 font-display font-bold text-2xl tracking-tighter text-white">
                <span className="text-teal-400">Koko</span>Stream
              </div>
           </header>
        )}

        <div className="flex-grow flex items-center justify-center">
            
            {appState === AppState.IDLE && (
                <StoryGenerator 
                    onGenerate={handleGenerate} 
                    onLoadDraft={handleLoadDraft}
                    isGenerating={false} 
                />
            )}

            {(appState === AppState.GENERATING_SCRIPT || appState === AppState.GENERATING_ASSETS) && (
                <div className="text-center animate-fade-in">
                    <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-teal-500 blur-xl opacity-20 animate-pulse"></div>
                        <Loader2 className="w-16 h-16 text-teal-400 animate-spin relative z-10" />
                    </div>
                    <h3 className="text-2xl font-display text-white mb-2">Creating Magic</h3>
                    <p className="text-slate-400 mb-6">{progress?.currentStep}</p>
                    
                    {progress && progress.totalScenes > 0 && (
                        <div className="w-64 h-2 bg-slate-800 rounded-full mx-auto overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 transition-all duration-500 ease-out"
                                style={{ width: `${(progress.completedScenes / progress.totalScenes) * 100}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            )}

            {appState === AppState.REVIEW_STORY && story && (
                <StoryEditor 
                    story={story} 
                    onUpdateStory={setStory}
                    onPlay={() => setAppState(AppState.PLAYING)}
                    onExport={() => setAppState(AppState.EXPORTING)}
                />
            )}

            {appState === AppState.EXPORTING && story && (
                <VideoExporter 
                    story={story} 
                    onCancel={() => setAppState(AppState.REVIEW_STORY)}
                    onComplete={() => setAppState(AppState.REVIEW_STORY)}
                />
            )}

            {appState === AppState.PLAYING && story && (
                <StoryPlayer story={story} onReset={resetApp} />
            )}

            {appState === AppState.ERROR && (
                <div className="text-center max-w-md p-8 bg-red-900/20 border border-red-500/30 rounded-xl">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
                    <p className="text-red-200 mb-6">{error}</p>
                    <button 
                        onClick={resetApp}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

        </div>
        
        {/* Fix: Updating power label with correct model naming */}
        <footer className="py-6 text-center text-slate-600 text-sm">
            Powered by Gemini 3 Flash, Gemini 2.5 Flash Image & Gemini 2.5 Flash TTS
        </footer>
      </main>

      <style>{`
        @keyframes kb-zoom-in {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        @keyframes kb-zoom-out {
          0% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes kb-pan-right {
          0% { transform: scale(1.15) translate(-3%, 0); }
          100% { transform: scale(1.15) translate(3%, 0); }
        }
        @keyframes kb-pan-left {
          0% { transform: scale(1.15) translate(3%, 0); }
          100% { transform: scale(1.15) translate(-3%, 0); }
        }
        
        .animate-kb-zoom-in { animation: kb-zoom-in 20s ease-out forwards; }
        .animate-kb-zoom-out { animation: kb-zoom-out 20s ease-out forwards; }
        .animate-kb-pan-right { animation: kb-pan-right 20s ease-out forwards; }
        .animate-kb-pan-left { animation: kb-pan-left 20s ease-out forwards; }

        .animate-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.7s ease-out forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
