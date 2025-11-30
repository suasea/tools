import React, { useState } from 'react';
import { WandIcon, CopyIcon, CheckIcon } from './Icons';
import { smartFormatJson } from '../services/geminiService';

export const JsonTools: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleFormat = () => {
    if (!input.trim()) return;
    setStatus('idle');
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setStatus('success');
      setStatusMsg('有效的 JSON 已成功格式化。');
    } catch (e: any) {
      setStatus('error');
      setStatusMsg('无效的 JSON。请尝试使用“智能修复”。');
    }
  };

  const handleMinify = () => {
    if (!input.trim()) return;
    setStatus('idle');
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setStatus('success');
      setStatusMsg('JSON 已压缩。');
    } catch (e) {
      setStatus('error');
      setStatusMsg('无效的 JSON，无法压缩。');
    }
  };

  const handleSmartFix = async () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    setStatus('idle');
    try {
      const fixed = await smartFormatJson(input);
      setOutput(fixed);
      setStatus('success');
      setStatusMsg('JSON 已由 AI 修复并格式化。');
    } catch (e) {
      setStatus('error');
      setStatusMsg('AI 修复 JSON 失败。');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
           <button onClick={handleFormat} className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium shadow-sm">
             格式化
           </button>
           <button onClick={handleMinify} className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium shadow-sm">
             压缩
           </button>
           <button 
             onClick={handleSmartFix} 
             disabled={isProcessing}
             className="px-3 py-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 rounded-md text-sm font-medium shadow-sm flex items-center gap-1"
           >
             <WandIcon className="w-3 h-3" />
             {isProcessing ? '修复中...' : '智能修复'}
           </button>
        </div>
        <div className={`text-sm font-medium px-2 ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {statusMsg}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">输入 JSON</label>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="在此粘贴您的 JSON..."
                className="flex-1 w-full p-4 rounded-lg border border-gray-300 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none shadow-sm"
                spellCheck={false}
            />
        </div>
        <div className="flex flex-col relative">
            <div className="flex justify-between items-end mb-1">
                 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">结果</label>
                 <button 
                   onClick={copyToClipboard} 
                   className="text-gray-500 hover:text-primary-600 transition-colors"
                   title="复制到剪贴板"
                 >
                    {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                 </button>
            </div>
            <textarea
                readOnly
                value={output}
                placeholder="结果将显示在这里..."
                className={`flex-1 w-full p-4 rounded-lg border font-mono text-sm outline-none resize-none shadow-sm
                    ${status === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-300 bg-gray-50 text-gray-800'}
                `}
                spellCheck={false}
            />
        </div>
      </div>
    </div>
  );
};