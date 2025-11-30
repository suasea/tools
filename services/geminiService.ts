import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { DocFormat } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("未在环境中找到 API Key");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Converts a document from one format to another using Gemini's multimodal capabilities.
 */
export const convertDocument = async (
  base64Data: string,
  mimeType: string,
  targetFormat: DocFormat,
  fileName: string
): Promise<string> => {
  const ai = getClient();
  
  let prompt = "";

  // The prompts are kept in English to ensure the model follows instructions precisely, 
  // but they are designed to preserve the original language of the content (e.g., Chinese).
  switch (targetFormat) {
    case DocFormat.MD:
      prompt = `Convert the following document content into clean, well-structured Markdown. Preserve headers, lists, and tables where possible. Maintain the original language of the document. If the document is an image or PDF, perform OCR and layout analysis to reconstruct the document structure.`;
      break;
    case DocFormat.TXT:
      prompt = `Extract all text from the following document. Return only the plain text content with basic line breaks. Do not include markdown syntax. Maintain the original language.`;
      break;
    case DocFormat.JSON:
      prompt = `Analyze the content of this document and restructure it into a valid JSON object. Use intuitive keys (in English if possible, otherwise consistent with content) based on the headers or sections found. Return ONLY valid JSON.`;
      break;
    case DocFormat.DOCX:
      // Since we can't generate binary DOCX directly easily, we generate HTML which Word can open perfectly.
      prompt = `Convert the document content into Semantic HTML. Use <h1>, <h2>, <p>, <ul>, <li>, <table> tags appropriate for the structure. Do not include CSS or <html>/<body> tags, just the body content. Maintain the original language.`;
      break;
    case DocFormat.PDF:
      // We will generate Markdown/Text, and the frontend will use browser print/save capabilities or just offer the text.
      prompt = `Convert the document content into a highly detailed, formatted text representation suitable for reading. Use spacing and layout to mimic a professional document. Maintain the original language.`;
      break;
    default:
      prompt = "Convert this document and maintain the original language.";
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });

    const text = response.text || "";
    
    // Cleanup for JSON requests if the model includes code blocks
    if (targetFormat === DocFormat.JSON) {
      return text.replace(/```json\n|\n```|```/g, '').trim();
    }

    return text;

  } catch (error) {
    console.error("Conversion failed:", error);
    throw new Error("文档转换失败，请重试。");
  }
};

/**
 * AI-powered JSON fixer/formatter.
 */
export const smartFormatJson = async (input: string): Promise<string> => {
  const ai = getClient();
  const prompt = `The following text is supposed to be JSON but might be invalid, minified, or malformed. Please fix syntax errors, validate it, and return the Result as a perfectly formatted, indented JSON string. Do not add any markdown formatting or explanations, just the raw JSON string.
  
  Input:
  ${input.slice(0, 30000)}... (truncated if too long)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let text = response.text || "{}";
    // cleanup code blocks if present
    text = text.replace(/```json\n|\n```|```/g, '').trim();
    return text;
  } catch (error) {
    throw new Error("AI 处理 JSON 失败。");
  }
};

/**
 * Processes an image to remove watermarks or add an AI logo/watermark.
 */
export const processImage = async (
  base64Data: string,
  mimeType: string,
  mode: 'remove' | 'add',
  watermarkText?: string
): Promise<string> => {
  const ai = getClient();
  let prompt = "";
  
  if (mode === 'remove') {
    prompt = "Remove all watermarks, logos, text overlays, and timestamps from this image. Reconstruct the background behind them to look completely natural and seamless. The output should be a clean original version of the image.";
  } else {
    // Add watermark/logo mode
    const text = watermarkText || 'AI Watermark';
    prompt = `Add a stylish, semi-transparent watermark to this image. The watermark content should be: "${text}". Place it in the bottom-right corner. Ensure it is visible but does not obscure the main subject. Maintain the original image resolution and quality.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Specialized model for image generation/editing
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });

    // Check for image in response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("模型未返回图像数据");

  } catch (error) {
    console.error("Image processing failed:", error);
    throw new Error("图片处理失败，请重试或检查图片格式。");
  }
};