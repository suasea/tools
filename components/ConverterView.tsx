import React, { useState, useRef } from 'react';
import { DocFormat, FileData } from '../types';
import { UploadIcon, FileIcon, RefreshIcon, DownloadIcon, WandIcon } from './Icons';
import { fileToBase64, getFormatFromMime, downloadFile } from '../utils/fileHelper';
import { convertDocument } from '../services/geminiService';

export const ConverterView: React.FC = () => {
  const [file, setFile] = useState<FileData | null>(null);
  const [targetFormat, setTargetFormat] = useState<DocFormat>(DocFormat.MD);
  const [isConverting, setIsConverting] = useState(false);
  const [resultContent, setResultContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      try {
        const base64 = await fileToBase64(selectedFile);
        setFile({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          format: getFormatFromMime(selectedFile.type, selectedFile.name),
          base64: base64,
          content: null 
        });
        setResultContent(null);
        setError(null);
      } catch (err) {
        setError("读取文件失败");
      }
    }
  };

  const handleConvert = async () => {
    if (!file || !file.base64) return;
    setIsConverting(true);
    setError(null);
    try {
      const result = await convertDocument(file.base64, file.type, targetFormat, file.name);
      setResultContent(result);
    } catch (err: any) {
      setError(err.message || "转换失败");
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (resultContent && file) {
      downloadFile(resultContent, file.name, targetFormat);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Panel: Input & Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <UploadIcon className="w-5 h-5 text-primary-600" />
          源文档
        </h2>

        <div 
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer flex-1 min-h-[200px]
            ${file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.txt,.md,.json"
          />
          
          {file ? (
            <div className="animate-fade-in">
              <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileIcon className="w-8 h-8" />
              </div>
              <p className="font-medium text-gray-900 truncate max-w-xs mx-auto">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB • {file.format.toUpperCase()}</p>
              <button 
                className="mt-4 text-sm text-primary-600 font-medium hover:text-primary-700 underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setResultContent(null);
                }}
              >
                移除文件
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-3">
                <UploadIcon className="w-6 h-6" />
              </div>
              <p className="text-gray-600 font-medium">点击或拖拽文件上传</p>
              <p className="text-xs text-gray-400 mt-2">支持 PDF, DOCX, TXT, MD, JSON</p>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">转换为</label>
          <div className="flex flex-wrap gap-3 mb-6">
            {[DocFormat.MD, DocFormat.TXT, DocFormat.JSON, DocFormat.DOCX].map((fmt) => (
              <button
                key={fmt}
                onClick={() => setTargetFormat(fmt)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${targetFormat === fmt 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={handleConvert}
            disabled={!file || isConverting}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-medium transition-all shadow-sm
              ${!file || isConverting 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'}`}
          >
            {isConverting ? (
              <>
                <RefreshIcon className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <WandIcon className="w-5 h-5" />
                开始转换
              </>
            )}
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              错误: {error}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Output Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            结果预览
          </h2>
          {resultContent && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-medium transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              下载
            </button>
          )}
        </div>

        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative">
          {resultContent ? (
             <textarea 
                readOnly
                value={resultContent}
                className="w-full h-full p-4 bg-transparent resize-none font-mono text-sm text-gray-800 focus:outline-none"
             />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl font-mono">Aa</span>
              </div>
              <p>转换后的内容将显示在这里。</p>
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-400 text-right">
            {resultContent ? `${resultContent.length} 字符` : '等待输入'}
        </div>
      </div>
    </div>
  );
};