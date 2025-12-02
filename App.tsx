import React, { useState } from 'react';
import { AppView } from './types';
import { ConverterView } from './components/ConverterView';
import { JsonTools } from './components/JsonTools';
import { ImageToolsView } from './components/ImageToolsView';
import { PhotoStudioView } from './components/PhotoStudioView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CONVERTER);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg">D</span>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                  工具大全
                </span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentView(AppView.CONVERTER)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors
                    ${currentView === AppView.CONVERTER 
                      ? 'border-primary-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  文档转换
                </button>
                <button
                  onClick={() => setCurrentView(AppView.IMAGE_TOOLS)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors
                    ${currentView === AppView.IMAGE_TOOLS 
                      ? 'border-primary-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  图片工具
                </button>
                <button
                  onClick={() => setCurrentView(AppView.PHOTO_STUDIO)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors
                    ${currentView === AppView.PHOTO_STUDIO 
                      ? 'border-primary-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  AI 写真馆
                </button>
                <button
                  onClick={() => setCurrentView(AppView.JSON_TOOLS)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors
                    ${currentView === AppView.JSON_TOOLS 
                      ? 'border-primary-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  JSON 工具
                </button>
              </div>
            </div>
            <div className="flex items-center">
               <span className="text-xs text-gray-400 hidden md:block">由 Gemini 2.5 驱动</span>
            </div>
          </div>
        </div>
        
        {/* Mobile menu (simple implementation) */}
        <div className="sm:hidden flex border-t border-gray-100 overflow-x-auto">
            <button
              onClick={() => setCurrentView(AppView.CONVERTER)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium whitespace-nowrap
                ${currentView === AppView.CONVERTER ? 'text-primary-600 bg-primary-50' : 'text-gray-500'}`}
            >
              文档
            </button>
            <button
              onClick={() => setCurrentView(AppView.IMAGE_TOOLS)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium whitespace-nowrap
                ${currentView === AppView.IMAGE_TOOLS ? 'text-primary-600 bg-primary-50' : 'text-gray-500'}`}
            >
              图片
            </button>
            <button
              onClick={() => setCurrentView(AppView.PHOTO_STUDIO)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium whitespace-nowrap
                ${currentView === AppView.PHOTO_STUDIO ? 'text-primary-600 bg-primary-50' : 'text-gray-500'}`}
            >
              写真馆
            </button>
            <button
              onClick={() => setCurrentView(AppView.JSON_TOOLS)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium whitespace-nowrap
                ${currentView === AppView.JSON_TOOLS ? 'text-primary-600 bg-primary-50' : 'text-gray-500'}`}
            >
              JSON
            </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-[calc(100vh-9rem)] min-h-[500px]">
          {currentView === AppView.CONVERTER && (
            <div className="h-full animate-fade-in-up">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">文档转换器</h1>
                    <p className="text-gray-500">快速转换文本、Markdown、PDF 和 Word 文档。</p>
                </div>
                <div className="h-[calc(100%-5rem)]">
                    <ConverterView />
                </div>
            </div>
          )}
          
          {currentView === AppView.IMAGE_TOOLS && (
            <div className="h-full animate-fade-in-up">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">智能图片工具</h1>
                    <p className="text-gray-500">使用 AI 快速去除图片水印或添加自定义标识。</p>
                </div>
                <div className="h-[calc(100%-5rem)]">
                    <ImageToolsView />
                </div>
            </div>
          )}

          {currentView === AppView.PHOTO_STUDIO && (
            <div className="h-full animate-fade-in-up">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">AI 写真馆</h1>
                    <p className="text-gray-500">上传一张照片，AI 为您生成 6 组不同风格的专业级写真。</p>
                </div>
                <div className="h-[calc(100%-5rem)]">
                    <PhotoStudioView />
                </div>
            </div>
          )}

          {currentView === AppView.JSON_TOOLS && (
            <div className="h-full animate-fade-in-up">
                 <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">JSON 工作台</h1>
                    <p className="text-gray-500">利用 AI 校验、格式化、压缩和修复 JSON 数据。</p>
                </div>
                <div className="h-[calc(100%-5rem)]">
                    <JsonTools />
                </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
       <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">
            &copy; 2025 工具大全. 文件不会上传至服务器保存，所有处理均通过 Google Gemini API 进行。
          </p>
        </div>
      </footer>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
           animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;