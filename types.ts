export enum DocFormat {
  TXT = 'txt',
  MD = 'md',
  JSON = 'json',
  PDF = 'pdf',
  DOCX = 'docx'
}

export enum AppView {
  CONVERTER = 'converter',
  JSON_TOOLS = 'json_tools',
  IMAGE_TOOLS = 'image_tools'
}

export interface FileData {
  name: string;
  type: string; // MIME type
  content: string | ArrayBuffer | null; // For text preview or Base64 for AI
  base64?: string;
  size: number;
  format: DocFormat;
}

export interface ConversionResult {
  text: string;
  format: DocFormat;
}