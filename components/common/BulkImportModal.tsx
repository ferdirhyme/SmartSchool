import React, { useState, useCallback } from 'react';

export interface Result {
  successes: string[];
  failures: { row: number; reason: string; data: string }[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<Result>;
  title: string;
  templateHeaders: string[];
  templateFileName: string;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  title,
  templateHeaders,
  templateFileName,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Result | null>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setIsProcessing(false);
    setResults(null);
    onClose();
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResults(null);
    setFile(e.target.files?.[0] || null);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResults(null);
    const importResult = await onImport(file);
    setResults(importResult);
    setIsProcessing(false);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + templateHeaders.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", templateFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={resetState}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 m-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={resetState} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-2">Instructions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Upload a CSV file with the following columns in order. The first row must be the header.
            </p>
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-sm font-mono">
              {templateHeaders.join(', ')}
            </div>
            <button onClick={handleDownloadTemplate} className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-500">
              Download Template
            </button>
          </div>

          <div>
            <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload CSV File
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/50 dark:file:text-brand-300 dark:hover:file:bg-brand-900"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={!file || isProcessing}
              className="inline-flex items-center justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Import Data'}
            </button>
          </div>

          {results && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Import Results</h3>
              <div className="p-4 border rounded-md max-h-60 overflow-y-auto">
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Successfully imported: {results.successes.length}
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium mt-2">
                  Failed to import: {results.failures.length}
                </p>
                {results.failures.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
                    {results.failures.map((fail, index) => (
                      <li key={index}>
                        <strong>Row {fail.row}:</strong> {fail.reason} - <span className="font-mono text-xs">`{fail.data}`</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;