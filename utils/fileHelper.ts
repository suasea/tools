import { DocFormat } from "../types";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const downloadFile = (content: string, filename: string, format: DocFormat) => {
  let mimeType = 'text/plain';
  let extension = format as string;

  switch (format) {
    case DocFormat.JSON:
      mimeType = 'application/json';
      break;
    case DocFormat.MD:
      mimeType = 'text/markdown';
      break;
    case DocFormat.DOCX:
      mimeType = 'application/msword'; 
      extension = 'doc'; // Simple HTML-as-Doc trick works well for browser generation
      break;
    case DocFormat.PDF:
      // For PDF, we can't easily generate binary in pure JS without massive libs.
      // We'll save as a text file but user knows the limitation, or use print trigger.
      // Here we just save as text for the MVP.
      mimeType = 'text/plain';
      extension = 'txt'; 
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.split('.')[0]}_converted.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getFormatFromMime = (mime: string, name: string): DocFormat => {
  if (mime.includes('pdf')) return DocFormat.PDF;
  if (mime.includes('word') || mime.includes('officedocument')) return DocFormat.DOCX;
  if (mime.includes('json')) return DocFormat.JSON;
  if (name.endsWith('.md')) return DocFormat.MD;
  return DocFormat.TXT;
};
