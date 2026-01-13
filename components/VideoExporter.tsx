
import React, { useEffect, useRef, useState } from 'react';
import { Story, Scene } from '../types';
import { getAudioContext, AmbientGenerator } from '../utils/audio';
import { Loader2, Clapperboard, CheckCircle } from 'lucide-react';

interface VideoExporterProps {
  story: Story;
  onCancel: () => void;
  onComplete: () => void;
}

export const VideoExporter: React.FC<VideoExporterProps> = ({ story, onCancel, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameIdRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  // Constants for video quality
  const WIDTH = 1920;
  const HEIGHT = 1080;
  const FPS = 30;

  const startExport = async () => {
    if (!canvasRef.current) return;
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    // Setup Audio Capture
    // Fix: Using the correct method createMediaStreamDestination instead of createMediaStreamAudioDestination
    const audioDest = ctx.createMediaStreamDestination();
    audioDestRef.current = audioDest;
    
    // Setup Video Capture
    const canvasStream = canvasRef.current.captureStream(FPS);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.getAudioTracks()
    ]);

    // Setup Recorder
    // Note: Chrome supports video/webm; standard MP4 is harder in-browser but webm is high quality.
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000 // 8 Mbps
    });

    recorder.ondataavailable = (e) => {
      // Fix: Removing incorrect .utils property access and correctly pushing to chunksRef.current
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${story.title.toLowerCase().replace(/\s+/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsDone(true);
      setTimeout(onComplete, 2000);
    };

    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.start();
    isRecordingRef.current = true;

    // Start background music routed to destination
    const ambient = new AmbientGenerator();
    // Re-route ambient to our destination node
    // To do this properly we modify how AmbientGenerator works or hijack its output
    // For this simple demo, we rely on the AudioContext being the same and use a trick
    // by manually playing the scenes and music through the destination.
    
    playAllScenes(audioDest);
  };

  const playAllScenes = async (dest: MediaStreamAudioDestinationNode) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const audioCtx = getAudioContext();
    
    // 1. Setup Background Music
    let musicSource: any = null;
    if (story.backgroundMusic && story.backgroundMusic !== 'none') {
        // Procedural music logic (Simplified for export)
        // We'll just use a basic drone for the export version to ensure it hits the DestNode
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 110;
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        musicSource = osc;
    }

    // 2. Play through scenes
    for (let i = 0; i < story.scenes.length; i++) {
      setCurrentSceneIndex(i);
      const scene = story.scenes[i];
      const img = new Image();
      img.src = scene.imageData || '';
      await new Promise(resolve => img.onload = resolve);

      const duration = 4000; // Minimum time per scene if no audio
      const startTime = performance.now();
      
      // Play Narration
      let narrationDuration = 0;
      if (scene.audioData) {
        const source = audioCtx.createBufferSource();
        source.buffer = scene.audioData;
        source.connect(dest);
        source.start();
        narrationDuration = scene.audioData.duration * 1000;
      }

      const sceneDuration = Math.max(duration, narrationDuration + 500);

      // Render Loop for this scene
      const render = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / sceneDuration, 1);
        
        // Background Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Draw Ken Burns Image
        const scale = 1 + (progress * 0.1); // 1.0 to 1.1
        const w = WIDTH * scale;
        const h = HEIGHT * scale;
        const x = (WIDTH - w) / 2;
        const y = (HEIGHT - h) / 2;
        ctx.drawImage(img, x, y, w, h);

        // Draw Narrative Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, HEIGHT - 200, WIDTH, 200);
        
        ctx.fillStyle = '#fff';
        ctx.font = '48px Cinzel, serif';
        ctx.textAlign = 'center';
        
        // Simple multiline wrapping
        const words = scene.narrative.split(' ');
        let line = '';
        let lines = [];
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > WIDTH - 200 && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        
        lines.forEach((l, idx) => {
            ctx.fillText(l, WIDTH / 2, HEIGHT - 120 + (idx * 50));
        });

        setProgress(((i + progress) / story.scenes.length) * 100);

        if (progress < 1) {
            frameIdRef.current = requestAnimationFrame(render);
        }
      };

      frameIdRef.current = requestAnimationFrame(render);
      await new Promise(resolve => setTimeout(resolve, sceneDuration));
      cancelAnimationFrame(frameIdRef.current!);
    }

    // Wrap up
    if (musicSource) musicSource.stop();
    recorderRef.current?.stop();
    isRecordingRef.current = false;
  };

  useEffect(() => {
    startExport();
    return () => {
        if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="max-w-xl w-full text-center">
            <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
                {isDone ? (
                     <CheckCircle className="w-20 h-20 text-green-400 relative z-10" />
                ) : (
                     <Clapperboard className="w-20 h-20 text-indigo-400 animate-bounce relative z-10" />
                )}
            </div>

            <h2 className="text-3xl font-display text-white mb-2">
                {isDone ? 'Export Complete!' : 'Recording Story...'}
            </h2>
            <p className="text-slate-400 mb-8">
                {isDone ? 'Your video has been downloaded.' : `Capturing scene ${currentSceneIndex + 1} of ${story.scenes.length}. Please keep this tab active.`}
            </p>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-4 border border-slate-700">
                <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            
            <div className="flex justify-between text-xs font-mono text-slate-500 uppercase tracking-widest">
                <span>Rendering</span>
                <span>{Math.round(progress)}%</span>
            </div>

            {/* Hidden Preview Canvas - used for capture */}
            <div className="mt-12 opacity-40 border border-slate-700 rounded-lg overflow-hidden scale-50 md:scale-75 origin-top">
                <canvas 
                    ref={canvasRef} 
                    width={WIDTH} 
                    height={HEIGHT} 
                    className="max-w-full h-auto aspect-video"
                />
            </div>

            {!isDone && (
                <button 
                    onClick={onCancel}
                    className="mt-8 text-slate-500 hover:text-white transition-colors underline underline-offset-4"
                >
                    Cancel Export
                </button>
            )}
        </div>
    </div>
  );
};
