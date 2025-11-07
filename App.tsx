
import React, { useState, useRef, useCallback } from 'react';
import { analyzeLocationAndFetchHistory, fetchSafetyInsights, generateSpeech } from './services/geminiService';
import { GeminiContentResult } from './types';
import { decode, decodeAudioData } from './utils/audioUtils';
import { UploadIcon, PlayIcon, PauseIcon, SpinnerIcon, ShieldIcon } from './components/icons';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiContentResult | null>(null);
  const [safetyInsights, setSafetyInsights] = useState<GeminiContentResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isSafetyLoading, setIsSafetyLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setAnalysis(null);
      setSafetyInsights(null);
      setError(null);
      setSafetyError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setIsLoading(true);
    setError(null);
    setSafetyError(null);
    setAnalysis(null);
    setSafetyInsights(null);

    if (isPlaying) {
        sourceNodeRef.current?.stop();
        setIsPlaying(false);
    }

    try {
      const analysisResult = await analyzeLocationAndFetchHistory(imageFile);
      setAnalysis(analysisResult);

      // After getting history, fetch safety insights
      setIsSafetyLoading(true);
      try {
        const safetyResult = await fetchSafetyInsights(analysisResult.text);
        setSafetyInsights(safetyResult);
      } catch (err) {
        console.error('Safety insights error:', err);
        setSafetyError('Could not fetch safety insights for this location.');
      } finally {
        setIsSafetyLoading(false);
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze the image. Please try another one.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = useCallback(async () => {
    if (!analysis?.text) return;

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      sourceNodeRef.current = null;
      return;
    }

    setIsAudioLoading(true);
    setError(null);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioData = await generateSpeech(analysis.text);
      const decodedBytes = decode(audioData);
      const audioBuffer = await decodeAudioData(decodedBytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        sourceNodeRef.current = null;
      };
      source.start(0);

      sourceNodeRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate or play audio.');
    } finally {
      setIsAudioLoading(false);
    }
  }, [analysis, isPlaying]);

  const triggerFileSelect = () => fileInputRef.current?.click();

  const renderSources = (sources: GeminiContentResult['sources']) => (
     <div>
        <h3 className="text-lg font-semibold text-gray-200 mt-4 mb-2">Sources</h3>
        <ul className="list-disc list-inside space-y-1">
            {sources.filter(s => s.web).map((source, index) => (
            <li key={index}>
                <a href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {source.web?.title || 'Untitled Source'}
                </a>
            </li>
            ))}
        </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            AI Location Historian
          </h1>
          <p className="text-gray-400 mt-2">Upload a photo to uncover the story behind the location.</p>
        </header>

        <main className="bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
          <div className="space-y-4">
             <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {!imageUrl && (
                 <button
                    onClick={triggerFileSelect}
                    className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-12 text-gray-400 hover:bg-gray-700 hover:border-gray-500 transition-colors duration-300"
                    >
                    <UploadIcon className="w-12 h-12 mb-2" />
                    <span className="font-semibold">Click to upload a photo</span>
                    <span className="text-sm">PNG, JPG, or WEBP</span>
                </button>
            )}

            {imageUrl && (
              <div className="space-y-4">
                <div className="relative group overflow-hidden rounded-lg">
                    <img src={imageUrl} alt="Uploaded location" className="w-full h-auto max-h-[60vh] object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={triggerFileSelect} className="bg-white text-black px-4 py-2 rounded-md font-semibold">Change Photo</button>
                    </div>
                </div>
                 <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors duration-300"
                    >
                    {isLoading ? <SpinnerIcon className="w-6 h-6" /> : 'Analyze Location'}
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="text-center p-8">
              <SpinnerIcon className="w-12 h-12 mx-auto text-purple-400" />
              <p className="mt-4 text-gray-300">Analyzing your image... this may take a moment.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {analysis && !isLoading && (
            <div className="border-t border-gray-700 pt-6 space-y-6 animate-fade-in">
              <div className='space-y-4'>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-100">Historical Analysis</h2>
                  <button
                    onClick={handlePlayAudio}
                    disabled={isAudioLoading}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {isAudioLoading ? <SpinnerIcon className="w-5 h-5" /> : (isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5" />) }
                    <span>{isPlaying ? 'Pause' : 'Listen'}</span>
                  </button>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{analysis.text}</p>
                
                {analysis.sources.length > 0 && renderSources(analysis.sources)}
              </div>

              <div className="border-t border-gray-700 pt-6 space-y-4">
                  <div className="flex items-center space-x-3">
                      <ShieldIcon className="w-7 h-7 text-yellow-400" />
                      <h2 className="text-2xl font-bold text-gray-100">Location Safety Insights</h2>
                  </div>
                  <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-sm" role="alert">
                      <strong className="font-bold">Disclaimer: </strong>
                      <span>This information is AI-generated from public web sources for general awareness and is not a substitute for official guidance. Do not use for emergency decisions.</span>
                  </div>

                  {isSafetyLoading && (
                      <div className="text-center p-4">
                          <SpinnerIcon className="w-8 h-8 mx-auto text-yellow-400" />
                          <p className="mt-2 text-gray-400">Fetching safety information...</p>
                      </div>
                  )}

                  {safetyError && (
                      <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
                          <strong className="font-bold">Error: </strong>
                          <span className="block sm:inline">{safetyError}</span>
                      </div>
                  )}
                  
                  {safetyInsights && !isSafetyLoading && (
                       <div className="space-y-4">
                           <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{safetyInsights.text}</p>
                           {safetyInsights.sources.length > 0 && renderSources(safetyInsights.sources)}
                       </div>
                  )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
