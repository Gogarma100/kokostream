import React, { useRef, useEffect, useState } from 'react';
import { Story, Scene, MusicMood, TransitionType } from '../types';
import { Play, ArrowUp, ArrowDown, Music, Volume2, StopCircle, Settings2, GripVertical, Save, CheckCircle, AlertTriangle, Download, Video } from 'lucide-react';
import { AmbientGenerator } from '../utils/audio';

interface StoryEditorProps {
  story: Story;
  onUpdateStory: (story: Story) => void;
  onPlay: () => void;
  onExport: () => void;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ story, onUpdateStory, onPlay, onExport }) => {
  const previewPlayerRef = useRef<AmbientGenerator | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'partial' | 'error'>('idle');

  useEffect(() => {
    previewPlayerRef.current = new AmbientGenerator();
    return () => {
      previewPlayerRef.current?.stop();
    };
  }, []);

  const moveScene = (index: number, direction: 'up' | 'down') => {
    const newScenes = [...story.scenes];
    if (direction === 'up' && index > 0) {
      [newScenes[index], newScenes[index - 1]] = [newScenes[index - 1], newScenes[index]];
    } else if (direction === 'down' && index < newScenes.length - 1) {
      [newScenes[index], newScenes[index + 1]] = [newScenes[index + 1], newScenes[index]];
    }
    onUpdateStory({ ...story, scenes: newScenes });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
        const newScenes = [...story.scenes];
        const [movedScene] = newScenes.splice(draggedIndex, 1);
        newScenes.splice(dropIndex, 0, movedScene);
        onUpdateStory({ ...story, scenes: newScenes });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const updateSceneTransition = (index: number, type: TransitionType, duration: number) => {
      const newScenes = [...story.scenes];
      newScenes[index] = {
          ...newScenes[index],
          transition: { type, duration }
      };
      onUpdateStory({ ...story, scenes: newScenes });
  };

  const handleMusicChange = (mood: MusicMood) => {
    onUpdateStory({ ...story, backgroundMusic: mood });
    if (mood === 'none') {
        previewPlayerRef.current?.stop();
    } else {
        previewPlayerRef.current?.play(mood);
    }
  };

  const handleDownload = () => {
    const exportData = {
      ...story,
      scenes: story.scenes.map(s => {
        const { audioData, ...rest } = s;
        return rest;
      })
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${story.title.toLowerCase().replace(/\s+/g, '-')}.kokostream`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    const prepareStoryForSave = (s: Story, stripImages = false, stripAudio = false) => {
        return {
            ...s,
            scenes: s.scenes.map(scene => {
                const { audioData, ...rest } = scene;
                return {
                    ...rest,
                    imageData: stripImages ? undefined : rest.imageData,
                    audioBase64: stripAudio ? undefined : rest.audioBase64
                };
            })
        };
    };

    try {
        const fullStory = prepareStoryForSave(story);
        localStorage.setItem('koko_story_draft', JSON.stringify(fullStory));
        setSaveStatus('saved');
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            try {
                const noImagesStory = prepareStoryForSave(story, true, false);
                localStorage.setItem('koko_story_draft', JSON.stringify(noImagesStory));
                setSaveStatus('partial');
            } catch (e2) {
                 try {
                    const textOnlyStory = prepareStoryForSave(story, true, true);
                    localStorage.setItem('koko_story_draft', JSON.stringify(textOnlyStory));
                    setSaveStatus('partial');
                 } catch (e3) {
                     setSaveStatus('error');
                 }
            }
        } else {
            setSaveStatus('error');
        }
    }

    setTimeout(() => {
        setSaveStatus(prev => prev === 'error' ? 'error' : 'idle');
    }, 3000);
  };

  const musicOptions: { id: MusicMood; label: string; desc: string }[] = [
      { id: 'none', label: 'Silence', desc: 'No background music' },
      { id: 'ethereal', label: 'Ethereal', desc: 'Dreamy, peaceful pads' },
      { id: 'suspense', label: 'Suspense', desc: 'Dark, dissonant tension' },
      { id: 'scifi', label: 'Sci-Fi', desc: 'Futuristic textures' },
  ];

  const transitionOptions: { id: TransitionType; label: string }[] = [
      { id: 'fade', label: 'Fade' },
      { id: 'slide-left', label: 'Slide Left' },
      { id: 'slide-right', label: 'Slide Right' },
      { id: 'zoom-in', label: 'Zoom In' },
      { id: 'zoom-out', label: 'Zoom Out' },
      { id: 'none', label: 'None (Cut)' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
         <div>
            <h2 className="text-2xl md:text-3xl font-display text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-indigo-400 mb-2">Review Storyboard</h2>
            <p className="text-slate-400 text-sm">Arranging scenes for "{story.title}"</p>
         </div>
         
         <div className="flex items-center gap-3 w-full md:w-auto">
             <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold border border-indigo-700 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 transition-all"
                title="Export as MP4 video"
             >
                <Video size={18} />
                <span className="hidden sm:inline">Export MP4</span>
             </button>

             <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                title="Download story as file"
             >
                <Download size={18} />
                <span className="hidden sm:inline">Save File</span>
             </button>

             <button
                onClick={() => {
                    previewPlayerRef.current?.stop();
                    onPlay();
                }}
                className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-indigo-500/50 transition-all transform hover:scale-105"
             >
                <Play size={20} fill="currentColor" />
                Start Show
             </button>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                    <div className="w-1 h-6 bg-teal-500 rounded-full"></div>
                    Scene Order
                </h3>
                {story.scenes.map((scene, index) => {
                    const isDragging = draggedIndex === index;
                    const isDragTarget = dragOverIndex === index;
                    
                    return (
                        <div 
                            key={scene.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`
                                relative bg-slate-900/80 backdrop-blur-sm border rounded-xl p-4 flex flex-col gap-4 transition-all duration-200 ease-out group
                                ${isDragging ? 'opacity-40 border-slate-700 scale-95' : 'opacity-100'}
                                ${isDragTarget ? 'border-teal-500 border-2 bg-slate-800 scale-[1.02] shadow-xl shadow-teal-900/20' : 'border-slate-700/50 hover:border-teal-500/30'}
                            `}
                        >
                            <div className="flex gap-4 items-center">
                                <div className="text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-400">
                                    <GripVertical size={20} />
                                </div>

                                <div className="flex flex-col items-center justify-center gap-1 min-w-[2rem]">
                                    <span className="text-slate-600 font-mono text-xs uppercase">No.</span>
                                    <span className="text-slate-300 font-bold text-xl">{index + 1}</span>
                                </div>

                                <div className="w-20 h-20 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 select-none">
                                    {scene.imageData ? (
                                        <img src={scene.imageData} alt={`Scene ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs bg-slate-900">
                                            Generating...
                                        </div>
                                    )}
                                </div>

                                <div className="flex-grow min-w-0 select-none">
                                    <p className="text-slate-300 text-sm line-clamp-2 italic">
                                        "{scene.narrative}"
                                    </p>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => moveScene(index, 'up')}
                                        disabled={index === 0}
                                        className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${index === 0 ? 'text-slate-700' : 'text-slate-400'}`}
                                        title="Move Up"
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => moveScene(index, 'down')}
                                        disabled={index === story.scenes.length - 1}
                                        className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${index === story.scenes.length - 1 ? 'text-slate-700' : 'text-slate-400'}`}
                                        title="Move Down"
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Settings2 size={14} />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Transition</span>
                                </div>
                                
                                <div className="flex gap-2 items-center flex-grow">
                                    <select
                                        value={scene.transition?.type || 'fade'}
                                        onChange={(e) => updateSceneTransition(index, e.target.value as any, scene.transition?.duration || 1000)}
                                        className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700 focus:border-teal-500 outline-none"
                                    >
                                        {transitionOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </select>
                                    
                                    <div className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1 border border-slate-700">
                                        <input
                                            type="number"
                                            min="100"
                                            max="5000"
                                            step="100"
                                            value={scene.transition?.duration || 1000}
                                            onChange={(e) => updateSceneTransition(index, scene.transition?.type || 'fade', parseInt(e.target.value))}
                                            className="bg-transparent text-slate-200 text-xs w-12 outline-none text-right"
                                        />
                                        <span className="text-slate-500 text-xs">ms</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                        Soundtrack
                    </h3>
                    <div className="space-y-3">
                        {musicOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleMusicChange(option.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group
                                    ${story.backgroundMusic === option.id 
                                        ? 'bg-indigo-900/40 border-indigo-500/50 ring-1 ring-indigo-500/50' 
                                        : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'}
                                `}
                            >
                                <div>
                                    <div className={`font-semibold ${story.backgroundMusic === option.id ? 'text-indigo-200' : 'text-slate-300'}`}>
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{option.desc}</div>
                                </div>
                                {story.backgroundMusic === option.id && option.id !== 'none' && (
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Volume2 size={16} className="animate-pulse" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                 </div>
            </div>
       </div>
    </div>
  );
};
