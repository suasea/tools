import React, { useState, useRef } from 'react';
import { UploadIcon, FileIcon, RefreshIcon, DownloadIcon, SparklesIcon, ImageIcon } from './Icons';
import { fileToBase64, getFormatFromMime } from '../utils/fileHelper';
import { processImage } from '../services/geminiService';

export const ImageToolsView: React.FC = () => {
  const [file, setFile] = useState<{ name: string; type: string; base64: string; size: number } | null>(null);
  const [mode, setMode] = useState<'remove' | 'add'>('remove');
  const [watermarkText, setWatermarkText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setError("请上传图片文件 (JPG, PNG, WEBP)");
        return;
      }
      try {
        const base64 = await fileToBase64(selectedFile);
        setFile({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          base64: base64,
        });
        setResultImage(null);
        setError(null);
      } catch (err) {
        setError("读取文件失败");
      }
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResultImage(null);
    try {
      const resultBase64 = await processImage(file.base64, file.type, mode, watermarkText);
      setResultImage(resultBase64);
    } catch (err: any) {
      setError(err.message || "处理失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${resultImage}`;
      link.download = `processed_${file?.name || 'image'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Panel: Input & Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary-600" />
          源图片
        </h2>

        <div 
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer flex-1 min-h-[200px] max-h-[400px] overflow-hidden relative
            ${file ? 'border-primary-300 bg-gray-900' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="image/*"
          />
          
          {file ? (
            <div className="w-full h-full flex items-center justify-center relative group">
              <img 
                src={`data:${file.type};base64,${file.base64}`} 
                alt="Source" 
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <p className="text-white font-medium">点击更换图片</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-3">
                <UploadIcon className="w-6 h-6" />
              </div>
              <p className="text-gray-600 font-medium">点击或拖拽图片上传</p>
              <p className="text-xs text-gray-400 mt-2">支持 JPG, PNG, WEBP</p>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择功能</label>
          <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
            <button
              onClick={() => setMode('remove')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'remove' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              去水印
            </button>
            <button
              onClick={() => setMode('add')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'add' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI 标识/水印
            </button>
          </div>

          {mode === 'add' && (
             <div className="mb-6 animate-fade-in">
               <label className="block text-sm font-medium text-gray-700 mb-2">水印内容或标识描述</label>
               <input
                 type="text"
                 value={watermarkText}
                 onChange={(e) => setWatermarkText(e.target.value)}
                 placeholder="例如：公司机密 或 生成一个龙形Logo"
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
               />
               <p className="text-xs text-gray-400 mt-1">AI 将根据您的描述在图片右下角智能添加水印或标识。</p>
             </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!file || isProcessing || (mode === 'add' && !watermarkText.trim())}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-medium transition-all shadow-sm
              ${!file || isProcessing || (mode === 'add' && !watermarkText.trim())
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'}`}
          >
            {isProcessing ? (
              <>
                <RefreshIcon className="w-5 h-5 animate-spin" />
                AI 处理中 (可能需要几秒)...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                {mode === 'remove' ? '一键去水印' : '生成并添加水印'}
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
            处理结果
          </h2>
          {resultImage && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-medium transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              下载图片
            </button>
          )}
        </div>

        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative flex items-center justify-center">
          {isProcessing ? (
             <div className="flex flex-col items-center justify-center text-primary-600 animate-pulse">
                <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                <p className="font-medium text-lg">AI 正在魔法生成中...</p>
                <p className="text-sm text-primary-400 mt-2">正在分析像素与重绘细节</p>
             </div>
          ) : resultImage ? (
             <img 
               src={`data:image/png;base64,${resultImage}`} 
               alt="Processed"
               className="max-w-full max-h-full object-contain shadow-lg"
             />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center mb-3">
                <SparklesIcon className="w-8 h-8" />
              </div>
              <p>处理后的图片将显示在这里。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};