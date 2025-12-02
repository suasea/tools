import React, { useState, useRef } from 'react';
import { UploadIcon, CameraIcon, DownloadIcon, RefreshIcon } from './Icons';
import { fileToBase64 } from '../utils/fileHelper';
import { generatePortraitSeries, PORTRAIT_STYLES, PortraitResult } from '../services/geminiService';

export const PhotoStudioView: React.FC = () => {
  const [file, setFile] = useState<{ name: string; type: string; base64: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<PortraitResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setError("请上传人物照片 (JPG, PNG)");
        return;
      }
      try {
        const base64 = await fileToBase64(selectedFile);
        setFile({
          name: selectedFile.name,
          type: selectedFile.type,
          base64: base64,
        });
        setResults([]); 
        setError(null);
      } catch (err) {
        setError("读取文件失败");
      }
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    // Initialize empty results to show loading skeletons
    setResults([]); 

    try {
      const generatedImages = await generatePortraitSeries(file.base64, file.type);
      setResults(generatedImages);
    } catch (err: any) {
      setError(err.message || "写真生成过程中出现错误");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (base64: string, styleName: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = `${styleName}_${file?.name || 'portrait'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Left Panel: Upload & Controls (Takes up 4 cols on large screens) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-primary-600" />
            上传人物照片
          </h2>

          <div 
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer flex-1 min-h-[300px] relative overflow-hidden
              ${file ? 'border-primary-300 bg-gray-900' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept="image/*"
              disabled={isProcessing}
            />
            
            {file ? (
              <div className="w-full h-full flex items-center justify-center relative group">
                <img 
                  src={`data:${file.type};base64,${file.base64}`} 
                  alt="Source" 
                  className="max-w-full max-h-full object-contain"
                />
                {!isProcessing && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium">更换照片</p>
                    </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-3">
                  <UploadIcon className="w-8 h-8" />
                </div>
                <p className="text-gray-600 font-medium text-lg">点击上传人物照</p>
                <p className="text-sm text-gray-400 mt-2">请上传清晰的正脸照片<br/>支持 JPG, PNG</p>
              </>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={!file || isProcessing}
              className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-lg text-white font-bold text-lg transition-all shadow-md
                ${!file || isProcessing 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-pink-500 to-primary-600 hover:from-pink-600 hover:to-primary-700 shadow-primary-200 transform hover:-translate-y-0.5'}`}
            >
              {isProcessing ? (
                <>
                  <RefreshIcon className="w-6 h-6 animate-spin" />
                  正在拍摄中...
                </>
              ) : (
                <>
                  <CameraIcon className="w-6 h-6" />
                  开始拍摄 (生成6张)
                </>
              )}
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">
              AI 摄影师将为您拍摄 6 组不同风格的写真大片
            </p>
             {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                错误: {error}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Gallery Grid (Takes up 8 cols) */}
      <div className="lg:col-span-8 bg-gray-50 rounded-xl border border-gray-200 p-6 overflow-y-auto h-[calc(100vh-12rem)]">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
          <span>成片预览</span>
          <span className="text-sm font-normal text-gray-500">{results.length > 0 ? `已生成 ${results.filter(r => r.image).length} 张` : '等待拍摄'}</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {PORTRAIT_STYLES.map((style, index) => {
             // Find result if available
             const result = results.find(r => r.styleId === style.id);
             
             return (
               <div key={style.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                 <div className="aspect-[3/4] bg-gray-100 relative group">
                    {result?.image ? (
                        <>
                            <img 
                                src={`data:image/png;base64,${result.image}`} 
                                alt={style.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button 
                                    onClick={() => handleDownload(result.image!, style.name)}
                                    className="p-2 bg-white text-gray-900 rounded-full hover:bg-gray-100 shadow-lg transform hover:scale-110 transition-transform"
                                    title="下载"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            {isProcessing ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
                                    <span className="text-xs text-gray-500 font-medium">冲洗中...</span>
                                </div>
                            ) : (
                                <div className="text-gray-300">
                                    <div className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                                         <span className="text-xs">{index + 1}</span>
                                    </div>
                                    <span className="text-xs">待生成</span>
                                </div>
                            )}
                        </div>
                    )}
                 </div>
                 <div className="p-3 border-t border-gray-50 bg-white">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium text-gray-800 text-sm">{style.name}</h3>
                        {result?.error && (
                             <span className="text-xs text-red-500">生成失败</span>
                        )}
                    </div>
                 </div>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
};