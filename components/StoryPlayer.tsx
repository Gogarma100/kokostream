
import React, { useEffect, useRef, useState } from 'react';
import { Story, Scene, TransitionType } from '../types';
import { Play, Pause, RefreshCw, Volume2, VolumeX, SkipForward, SkipBack, X } from 'lucide-react';
import { getAudioContext, AmbientGenerator } from '../utils/audio';

interface StoryPlayerProps {
  story: Story;
  onReset: () => void;
}

type TransitionStage = 'enter' | 'active' | 'exit';

export const StoryPlayer: React.FC<StoryPlayerProps> = ({ story, onReset }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // State for advanced transitions
  const [layoutStage, setLayoutStage] = useState<TransitionStage>('active');
  
  // Refs for audio management
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const musicPlayerRef = useRef<AmbientGenerator | null>(null);
  const isPlayingRef = useRef(false);

  const currentScene: Scene = story.scenes[currentSceneIndex];

  // Rotate through different animation effects for the content (Ken Burns)
  const animationEffects = [
    'animate-kb-zoom-in',
    'animate-kb-pan-right',
    'animate-kb-zoom-out',
    'animate-kb-pan-left'
  ];
  const currentEffect = animationEffects[currentSceneIndex % animationEffects.length];

  // Initialize Music
  useEffect(() => {
    musicPlayerRef.current = new AmbientGenerator();
    if (story.backgroundMusic && story.backgroundMusic !== 'none') {
      musicPlayerRef.current.play(story.backgroundMusic);
    }
    
    // Auto-start the story on mount
    playScene(0);

    return () => {
      stopAudio();
      musicPlayerRef.current?.stop();
    };
  }, []);

  // Handle Mute Toggle
  useEffect(() => {
    if (musicPlayerRef.current) {
      musicPlayerRef.current.setVolume(isMuted ? 0 : 0.08);
    }
  }, [isMuted]);

  // Stop current audio (narrative) and pending timeouts
  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  };

  const playScene = async (index: number) => {
    stopAudio();
    setCurrentSceneIndex(index);
    setIsFinished(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    // Transition State: ENTER
    setLayoutStage('enter');

    // Small delay to trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLayoutStage('active');
      });
    });

    const scene = story.scenes[index];
    if (!scene.audioData) {
      // Fallback if no audio (advance faster)
      transitionTimeoutRef.current = window.setTimeout(() => {
        advanceNext(index);
      }, 3000);
      return;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = scene.audioData;
    source.connect(ctx.destination);
    
    audioSourceRef.current = source;
    
    source.onended = () => {
      if (isPlayingRef.current) {
        advanceNext(index);
      }
    };

    source.start();
  };

  const advanceNext = (currentIndex: number) => {
    if (currentIndex < story.scenes.length - 1) {
      const nextScene = story.scenes[currentIndex + 1];
      const transitionDuration = nextScene.transition?.duration || 1000;
      
      setLayoutStage('exit');
      
      transitionTimeoutRef.current = window.setTimeout(() => {
        playScene(currentIndex + 1);
      }, transitionDuration / 2); // Start next scene halfway through transition for better overlap
    } else {
      setIsFinished(true);
      setIsPlaying(false);
      isPlayingRef.current = false;
      musicPlayerRef.current?.stop();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      isPlayingRef.current = false;
      musicPlayerRef.current?.setVolume(0);
    } else {
      musicPlayerRef.current?.setVolume(isMuted ? 0 : 0.08);
      if (isFinished) {
        playScene(0); 
      } else {
        playScene(currentSceneIndex);
      }
    }
  };

  const handleNext = () => {
    if (currentSceneIndex < story.scenes.length - 1) {
      playScene(currentSceneIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSceneIndex > 0) {
      playScene(currentSceneIndex - 1);
    }
  };

  // Map transition types to CSS classes
  const getTransitionClasses = (type: TransitionType | undefined) => {
    const t = type || 'fade';
    if (layoutStage === 'enter') {
      switch (t) {
        case 'slide-left': return 'translate-x-full opacity-0';
        case 'slide-right': return '-translate-x-full opacity-0';
        case 'zoom-in': return 'scale-50 opacity-0';
        case 'zoom-out': return 'scale-150 opacity-0';
        case 'fade': default: return 'opacity-0';
      }
    }
    if (layoutStage === 'exit') {
      switch (t) {
        case 'slide-left': return '-translate-x-full opacity-0';
        case 'slide-right': return 'translate-x-full opacity-0';
        case 'zoom-in': return 'scale-150 opacity-0';
        case 'zoom-out': return 'scale-50 opacity-0';
        case 'fade': default: return 'opacity-0';
      }
    }
    return 'translate-x-0 scale-100 opacity-100';
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden animate-fade-in">
      {/* Background Layer with Blur */}
      <div className="absolute inset-0 z-0">
        {currentScene.imageData && (
          <img 
            src={currentScene.imageData} 
            alt="Background Blur" 
            className="w-full h-full object-cover blur-3xl opacity-30 scale-110"
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow relative z-10 flex items-center justify-center p-4 md:p-12 overflow-hidden">
        <div 
          className={`
            relative w-full max-w-6xl aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5 transition-all duration-1000 ease-in-out
            ${getTransitionClasses(currentScene.transition?.type)}
          `}
        >
          {currentScene.imageData && (
            <img 
              src={currentScene.imageData} 
              alt={story.title}
              className={`w-full h-full object-cover ${isPlaying ? currentEffect : ''}`}
            />
          )}
          
          {/* Narrative Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-8 md:p-12">
            <p className="text-white text-xl md:text-3xl font-display text-center leading-relaxed drop-shadow-lg max-w-4xl mx-auto">
              {currentScene.narrative}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className="h-full bg-teal-400 transition-all duration-300 ease-linear"
              style={{ width: `${((currentSceneIndex + 1) / story.scenes.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* End Screen Overlay */}
        {isFinished && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-20 text-center p-6 animate-fade-in">
             <div className="mb-6">
                <h2 className="text-4xl md:text-5xl font-display text-white mb-2">The End</h2>
                <p className="text-slate-400 italic">"{story.title}"</p>
             </div>
             <div className="flex gap-4">
                <button 
                  onClick={() => playScene(0)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all"
                >
                  <RefreshCw size={20} />
                  Watch Again
                </button>
                <button 
                  onClick={onReset}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full font-bold transition-all"
                >
                  <X size={20} />
                  Exit
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div className="relative z-20 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 px-8">
        <button 
          onClick={onReset}
          className="absolute left-8 text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <SkipBack size={20} />
          <span className="hidden sm:inline text-xs uppercase tracking-widest font-bold">Menu</span>
        </button>

        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrevious}
            disabled={currentSceneIndex === 0}
            className={`p-2 rounded-full transition-colors ${currentSceneIndex === 0 ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            <SkipBack size={24} fill="currentColor" />
          </button>

          <button 
            onClick={handlePlayPause}
            className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
          </button>

          <button 
            onClick={handleNext}
            disabled={currentSceneIndex === story.scenes.length - 1}
            className={`p-2 rounded-full transition-colors ${currentSceneIndex === story.scenes.length - 1 ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            <SkipForward size={24} fill="currentColor" />
          </button>
        </div>

        <div className="absolute right-8 flex items-center gap-4">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <div className="hidden lg:block text-slate-500 text-xs font-mono">
              SCENE {currentSceneIndex + 1} / {story.scenes.length}
            </div>
        </div>
      </div>
    </div>
  );
};
