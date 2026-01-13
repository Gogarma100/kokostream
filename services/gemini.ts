
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Story, Scene } from "../types";
import { decodeBase64, decodeAudioData, getAudioContext } from "../utils/audio";

// Initialize Gemini Client
// We assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. Generate the Story Script
export const generateStoryScript = async (topic: string): Promise<Story> => {
  // Fix: Using gemini-3-flash-preview as the recommended model for basic text/JSON tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a short, vivid story about "${topic}". The story must have exactly 4 distinct scenes. Each scene needs a narrative text (for voiceover) and a detailed image prompt.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                narrative: { type: Type.STRING, description: "The text to be spoken by the narrator. Keep it under 30 words per scene." },
                imagePrompt: { type: Type.STRING, description: "A highly detailed visual description of the scene for an image generator." }
              },
              required: ["id", "narrative", "imagePrompt"]
            }
          }
        },
        required: ["title", "scenes"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No script generated");
  const story = JSON.parse(text) as Story;

  // Initialize defaults
  story.scenes = story.scenes.map(s => ({
      ...s,
      transition: { type: 'fade', duration: 1000 }
  }));

  return story;
};

// 2. Generate Image for a Scene
export const generateSceneImage = async (prompt: string): Promise<string> => {
  // Using gemini-2.5-flash-image for speed and efficiency in this demo
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt + " Cinematic lighting, high resolution, digital art style." }
      ]
    },
    config: {
        // No special config needed for flash-image basics, 
        // usually returns image in response parts
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

// 3. Generate Audio (TTS) for a Scene
// Returns both the ready-to-play AudioBuffer and the base64 string for storage
export const generateSceneAudio = async (text: string): Promise<{ buffer: AudioBuffer, base64: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, storytelling voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const ctx = getAudioContext();
  const rawBytes = decodeBase64(base64Audio);
  const buffer = await decodeAudioData(rawBytes, ctx);
  
  return { buffer, base64: base64Audio };
};
