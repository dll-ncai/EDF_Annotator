import React, { useState } from 'react';
import { Activity, FileText } from 'lucide-react';

interface FileUploadProps {
  onFilesSelect: (edfFile: File, csvFile: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedEDF, setSelectedEDF] = useState<File | null>(null);
  const [selectedCSV, setSelectedCSV] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => {
        if (file.name.toLowerCase().endsWith('.edf')) setSelectedEDF(file);
        else if (file.name.toLowerCase().endsWith('.csv')) setSelectedCSV(file);
      });
    }
  };

  const handleContinue = () => {
    if (selectedEDF && selectedCSV) onFilesSelect(selectedEDF, selectedCSV);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full blur-[120px]"></div>
      </div>

      <div 
        className={`relative w-full max-w-3xl p-12 text-center border-2 border-dashed rounded-3xl transition-all duration-500 backdrop-blur-xl ${dragActive ? 'border-indigo-400 bg-slate-800/80 scale-[1.02] shadow-[0_0_50px_rgba(99,102,241,0.2)]' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 shadow-2xl'}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      >
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg transform rotate-3 hover:rotate-6 transition-transform">
          <Activity className="w-12 h-12 text-white" />
        </div>
        
        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">NeuroXplain</h2>
        <p className="text-slate-400 mb-10 text-lg">Analysis & Visualization Suite</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {['edf', 'csv'].map((type) => {
            const isEDF = type === 'edf';
            const file = isEDF ? selectedEDF : selectedCSV;
            const setFile = isEDF ? setSelectedEDF : setSelectedCSV;
            return (
              <label key={type} className="group relative flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all cursor-pointer overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <FileText className={`w-10 h-10 mb-3 transition-colors ${file ? 'text-emerald-400' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                <span className="text-base font-semibold text-slate-300 mb-1 uppercase tracking-wider">{type.toUpperCase()} Source</span>
                <span className="text-xs text-slate-500 truncate max-w-[200px]">{file ? file.name : 'Click to browse'}</span>
                <input type="file" accept={isEDF ? ".edf" : ".csv"} className="hidden" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                {file && <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>}
              </label>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selectedEDF || !selectedCSV}
          className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all duration-300 transform ${selectedEDF && selectedCSV ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] hover:-translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
        >
          Initialize Viewer
        </button>
      </div>
    </div>
  );
};

export default FileUpload;