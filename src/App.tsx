import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import EEGViewer from './components/EEGViewer';
import { parseEDF, parseCSV } from './utils/parsers';
import { ParsedEDF, AnalysisResult, CSVMetadata } from './types';

const App: React.FC = () => {
  // --- Data State ---
  const [parsedData, setParsedData] = useState<ParsedEDF | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [csvMetadata, setCsvMetadata] = useState<CSVMetadata | null>(null); // New state for dynamic headers
  const [fileName, setFileName] = useState("");

  // --- UI/Playback State ---
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Orchestrates the file loading process.
   * It handles the EDF (binary signal) and the CSV (clinical metadata/detections).
   */
  const handleFilesSelect = async (edf: File, csv: File) => {
    try {
      // 1. Parse the Raw EEG signal
      const data = await parseEDF(edf);
      
      // 2. Parse the CSV and extract the dynamic metadata (Gender, Age, etc.)
      const csvContent = await csv.text();
      const { results, metadata } = parseCSV(csvContent);
      
      // 3. Update global state
      setParsedData(data);
      setAnalysisResults(results);
      setCsvMetadata(metadata); // Stores the specific file's patient info
      setFileName(edf.name);
      
      // Reset playhead for new file
      setCurrentTime(0);
    } catch (err) {
      console.error("File Processing Error:", err);
      alert("Error loading files. Please ensure the EDF and CSV formats are correct.");
    }
  };

  /**
   * Resets the application state to the upload screen.
   */
  const handleReset = () => {
    setParsedData(null);
    setAnalysisResults([]);
    setCsvMetadata(null);
    setFileName("");
    setIsPlaying(false);
    setSelectedResult(null);
  };

  return (
    <main className="min-h-screen bg-slate-950">
      {parsedData ? (
        /* Main Visualization Mode */
        <EEGViewer 
          data={parsedData} 
          fileName={fileName} 
          analysisResults={analysisResults}
          csvMetadata={csvMetadata} // Passed to enable dynamic CSV export
          selectedResult={selectedResult} 
          setSelectedResult={setSelectedResult}
          currentTime={currentTime} 
          setCurrentTime={setCurrentTime}
          isPlaying={isPlaying} 
          setIsPlaying={setIsPlaying}
          onReset={handleReset}
        />
      ) : (
        /* Initial File Selection Mode */
        <FileUpload onFilesSelect={handleFilesSelect} />
      )}
    </main>
  );
};

export default App;