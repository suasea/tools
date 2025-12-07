import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadIcon, FileIcon, RefreshIcon, DownloadIcon, SparklesIcon, ImageIcon } from './Icons';
import { fileToBase64, getFormatFromMime } from '../utils/fileHelper';
import { processImage } from '../services/geminiService';

// Helper to format bytes to human readable string
const formatFileSize = (base64String: string) => {
  if (!base64String) return '0 B';
  // Base64 length * 0.75 is approx file size in bytes
  const bytes = base64String.length * 0.75;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper to get image dimensions
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = `data:image/png;base64,${base64}`; // Type doesn't strictly matter for dims
  });
};

type ToolMode = 'remove' | 'add' | 'compress';
type CompressFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export const ImageToolsView: React.FC = () => {
  const [file, setFile] = useState<{ name: string; type: string; base64: string; size: number } | null>(null);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number } | null>(null);
  
  const [mode, setMode] = useState<ToolMode>('remove');
  
  // AI Tools State
  const [watermarkText, setWatermarkText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResultImage, setAiResultImage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Compression State
  const [compressFormat, setCompressFormat] = useState<CompressFormat>('image/jpeg');
  const [compressQuality, setCompressQuality] = useState<number>(0.8);
  const [compressScale, setCompressScale] = useState<number>(1.0);
  const [compressedImage, setCompressedImage] = useState<{ base64: string; width: number; height: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Prevent duplicate upload
      if (file && file.name === selectedFile.name && file.size === selectedFile.size) {
          return;
      }

      if (!selectedFile.type.startsWith('image/')) {
        setAiError("请上传图片文件 (JPG, PNG, WEBP, GIF, BMP)");
        return;
      }
      try {
        const base64 = await fileToBase64(selectedFile);
        const dims = await getImageDimensions(base64);
        
        setFile({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          base64: base64,
        });
        setOriginalDims(dims);
        
        // Reset results
        setAiResultImage(null);
        setCompressedImage(null);
        setAiError(null);
        
        // Set default format based on input
        if (selectedFile.type === 'image/png') setCompressFormat('image/png');
        else if (selectedFile.type === 'image/webp') setCompressFormat('image/webp');
        else setCompressFormat('image/jpeg');

      } catch (err) {
        setAiError("读取文件失败");
      }
    }
  };

  const handleAiProcess = async () => {
    if (!file) return;
    setIsProcessingAI(true);
    setAiError(null);
    setAiResultImage(null);
    try {
      const resultBase64 = await processImage(file.base64, file.type, mode === 'remove' ? 'remove' : 'add', watermarkText);
      setAiResultImage(resultBase64);
    } catch (err: any) {
      setAiError(err.message || "处理失败");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Compression Logic
  const performCompression = useCallback(async () => {
    if (!file || !originalDims) return;
    setIsCompressing(true);

    const img = new Image();
    img.src = `data:${file.type};base64,${file.base64}`;
    
    await new Promise((resolve) => { img.onload = resolve; });

    const originalSize = file.base64.length; // Approximate comparison using string length
    let currentScale = compressScale;
    let attempt = 0;
    let finalBase64 = '';
    let finalW = 0;
    let finalH = 0;
    
    // Canvas setup
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Recursive loop to ensure output is smaller than input
    while (attempt < 10) {
        finalW = Math.floor(originalDims.width * currentScale);
        finalH = Math.floor(originalDims.height * currentScale);

        canvas.width = finalW;
        canvas.height = finalH;
        
        if (ctx) {
            // High quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, finalW, finalH);
        }

        // For PNG, quality param is often ignored by browsers, relying on scale reduction
        finalBase64 = canvas.toDataURL(compressFormat, compressQuality);
        const resultData = finalBase64.split(',')[1]; // Get raw base64 part
        
        // Check if smaller
        if (resultData.length < originalSize) {
            setCompressedImage({
                base64: resultData,
                width: finalW,
                height: finalH
            });
            break; 
        } else {
            // If output is bigger (common with PNG or converting JPG->PNG), force reduce scale
            // Reduce scale by 5% and try again
            currentScale = currentScale * 0.95;
            attempt++;
        }
    }

    // Fallback if loop finishes and still too big (rare, but stop infinite loop)
    if (attempt >= 10) {
         setCompressedImage({
            base64: finalBase64.split(',')[1],
            width: finalW,
            height: finalH
        });
    }

    setIsCompressing(false);

  }, [file, originalDims, compressFormat, compressQuality, compressScale]);

  // Trigger compression when settings change (Debounced slightly)
  useEffect(() => {
      if (mode === 'compress' && file) {
          const timer = setTimeout(() => {
              performCompression();
          }, 300); // 300ms debounce
          return () => clearTimeout(timer);
      }
  }, [mode, file, compressFormat, compressQuality, compressScale, performCompression]);


  const handleDownload = (dataBase64: string, prefix: string) => {
    if (dataBase64) {
      const link = document.createElement('a');
      let ext = 'jpg';
      if (mode === 'compress') {
          if (compressFormat === 'image/png') ext = 'png';
          else if (compressFormat === 'image/webp') ext = 'webp';
      } else {
          ext = 'png'; // AI usually returns PNG
      }
      
      link.href = `data:${mode === 'compress' ? compressFormat : 'image/png'};base64,${dataBase64}`;
      link.download = `${prefix}_${file?.name.split('.')[0] || 'image'}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Panel: Input & Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary-600" />
          源图片
        </h2>

        <div 
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer min-h-[180px] max-h-[300px] overflow-hidden relative mb-6
            ${file ? 'border-primary-300 bg-gray-900' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
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
              <p className="text-xs text-gray-400 mt-2">支持 JPG, PNG, WEBP, GIF, BMP</p>
            </>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex p-1 bg-gray-100 rounded-lg mb-6 shrink-0">
            <button
              onClick={() => setMode('remove')}
              className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
                mode === 'remove' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI 去水印
            </button>
            <button
              onClick={() => setMode('add')}
              className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
                mode === 'add' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI 加标识
            </button>
            <button
              onClick={() => setMode('compress')}
              className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
                mode === 'compress' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              智能压缩
            </button>
        </div>

        {/* Controls Area */}
        <div className="flex-1">
            {mode === 'compress' && (
                <div className="animate-fade-in space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">输出格式</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['image/jpeg', 'image/png', 'image/webp'] as CompressFormat[]).map((fmt) => (
                                <button
                                    key={fmt}
                                    onClick={() => setCompressFormat(fmt)}
                                    className={`py-2 px-2 text-xs font-medium border rounded-lg transition-colors
                                        ${compressFormat === fmt 
                                            ? 'bg-primary-50 border-primary-500 text-primary-700' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {fmt.split('/')[1].toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">压缩质量</label>
                            <span className="text-xs text-primary-600 font-mono">{Math.round(compressQuality * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05"
                            value={compressQuality}
                            onChange={(e) => setCompressQuality(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                         <p className="text-xs text-gray-400 mt-1">值越低文件越小，但画质会有所损失 (PNG 格式下此选项影响较小)</p>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                             <label className="block text-sm font-medium text-gray-700">缩放比例 (尺寸)</label>
                             <span className="text-xs text-primary-600 font-mono">{Math.round(compressScale * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05"
                            value={compressScale}
                            onChange={(e) => setCompressScale(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <p className="text-xs text-gray-400 mt-1">降低分辨率是减小文件体积最有效的方法</p>
                    </div>

                    <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100 flex items-start gap-2">
                        <SparklesIcon className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>智能策略：如果压缩后文件依然比原图大（常见于 PNG 无损），系统将自动微调尺寸直到文件变小。</p>
                    </div>
                </div>
            )}

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

            {mode !== 'compress' && (
                <button
                    onClick={handleAiProcess}
                    disabled={!file || isProcessingAI || (mode === 'add' && !watermarkText.trim())}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-medium transition-all shadow-sm mt-4
                    ${!file || isProcessingAI || (mode === 'add' && !watermarkText.trim())
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'}`}
                >
                    {isProcessingAI ? (
                    <>
                        <RefreshIcon className="w-5 h-5 animate-spin" />
                        AI 处理中...
                    </>
                    ) : (
                    <>
                        <SparklesIcon className="w-5 h-5" />
                        {mode === 'remove' ? '一键去水印' : '生成并添加水印'}
                    </>
                    )}
                </button>
            )}
          
            {aiError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                错误: {aiError}
                </div>
            )}
        </div>
      </div>

      {/* Right Panel: Output Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {mode === 'compress' ? '效果对比' : '处理结果'}
          </h2>
          
          {mode === 'compress' && compressedImage && (
             <button 
                onClick={() => handleDownload(compressedImage.base64, 'compressed')}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-medium transition-colors"
             >
                <DownloadIcon className="w-4 h-4" />
                下载压缩图
             </button>
          )}

          {mode !== 'compress' && aiResultImage && (
            <button 
              onClick={() => handleDownload(aiResultImage, 'processed')}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-medium transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              下载图片
            </button>
          )}
        </div>

        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative flex items-center justify-center">
            {/* AI Mode Display */}
            {mode !== 'compress' && (
                <>
                    {isProcessingAI ? (
                        <div className="flex flex-col items-center justify-center text-primary-600 animate-pulse">
                            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                            <p className="font-medium text-lg">AI 正在魔法生成中...</p>
                            <p className="text-sm text-primary-400 mt-2">正在分析像素与重绘细节</p>
                        </div>
                    ) : aiResultImage ? (
                        <img 
                        src={`data:image/png;base64,${aiResultImage}`} 
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
                </>
            )}

            {/* Compression Mode Display */}
            {mode === 'compress' && (
                 <div className="w-full h-full p-4 flex flex-col">
                    {!file ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                             <p>请先上传图片以查看压缩对比</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full gap-4">
                             {/* Original Card */}
                             <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex flex-col relative">
                                <span className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-80 z-10">原图</span>
                                <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-100 rounded mb-2">
                                     <img src={`data:${file.type};base64,${file.base64}`} className="max-h-full max-w-full object-contain" />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 font-mono px-1">
                                    <span>{originalDims ? `${originalDims.width}x${originalDims.height}` : '...'}</span>
                                    <span>{formatFileSize(file.base64)}</span>
                                </div>
                             </div>

                             {/* Compressed Card */}
                             <div className="flex-1 bg-white rounded-lg shadow-sm border border-primary-200 p-2 flex flex-col relative">
                                <span className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded opacity-80 z-10">
                                    压缩后 {compressedImage ? `(-${Math.max(0, 100 - Math.round(compressedImage.base64.length / file.base64.length * 100))}%)` : ''}
                                </span>
                                <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-100 rounded mb-2 relative">
                                     {isCompressing ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                                            <RefreshIcon className="w-6 h-6 text-primary-600 animate-spin" />
                                        </div>
                                     ) : null}
                                     {compressedImage && (
                                         <img src={`data:${compressFormat};base64,${compressedImage.base64}`} className="max-h-full max-w-full object-contain" />
                                     )}
                                </div>
                                <div className="flex justify-between text-xs font-mono px-1">
                                    <span className="text-gray-500">
                                        {compressedImage ? `${compressedImage.width}x${compressedImage.height}` : '...'}
                                    </span>
                                    <span className="text-green-600 font-bold">
                                        {compressedImage ? formatFileSize(compressedImage.base64) : '...'}
                                    </span>
                                </div>
                             </div>
                        </div>
                    )}
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};