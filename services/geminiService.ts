
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { GeminiContentResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export async function analyzeLocationAndFetchHistory(imageFile: File): Promise<GeminiContentResult> {
  const base64Data = await fileToBase64(imageFile);
  const imagePart = {
    inlineData: {
      mimeType: imageFile.type,
      data: base64Data,
    },
  };

  const textPart = {
    text: "Identify the location, landmark, or monument in this image. Provide a detailed history of this location. If it's a natural landmark, describe its geological history. If it's man-made, describe its construction and significance.",
  };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      tools: [{googleSearch: {}}],
    },
  });

  const text = response.text;
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return { text, sources };
}

export async function fetchSafetyInsights(locationDescription: string): Promise<GeminiContentResult> {
    const textPart = {
        text: `Based on the following text which describes a location, summarize any publicly available safety information, recent notable incidents, or general advisories for visitors using Google Search. Focus on general public knowledge and avoid personal data or information from restricted databases. Be objective and factual. If no relevant safety information is found, state that clearly. Here is the text describing the location: "${locationDescription}"`,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart] },
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const text = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, sources };
}


export async function generateSpeech(text: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this aloud in a clear, narrative voice: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Failed to generate audio from the API.");
    }
    return base64Audio;
}
