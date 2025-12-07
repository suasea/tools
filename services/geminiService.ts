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
    prompt = "Remove all watermarks, logos, text overlays, and timestamps from this image. Reconstruct the background behind them to look completely natural and seamless. The output should be a clean original version of the image. Return the processed image.";
  } else {
    // Add watermark/logo mode
    const text = watermarkText || 'AI Watermark';
    prompt = `Add a stylish, semi-transparent watermark to this image. The watermark content should be: "${text}". Place it in the bottom-right corner. Ensure it is visible but does not obscure the main subject. Maintain the original image resolution and quality. Return the processed image.`;
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
    let textResponse = "";

    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
    }
    
    // If we have text but no image, likely a refusal or error
    if (textResponse) {
      throw new Error(`AI 未生成图片，回应: ${textResponse}`);
    }

    throw new Error("模型未返回图像数据，也未提供文本解释。");

  } catch (error: any) {
    console.error("Image processing failed:", error);
    if (error.message && (error.message.includes("AI") || error.message.includes("模型"))) {
        throw error;
    }
    throw new Error("图片处理失败: " + error.message);
  }
};

export interface PortraitStyle {
  id: string;
  name: string;
  prompt: string;
}

export const PORTRAIT_STYLES: PortraitStyle[] = [
  { 
    id: 'professional', 
    name: '职业肖像照', 
    prompt: 'Generate a high-quality professional business headshot of this person. They should be wearing professional business attire (suit or blazer). Background should be a neutral, clean studio backdrop. Soft, professional lighting. Preserve the facial features and identity of the person in the input image.' 
  },
  { 
    id: 'fashion', 
    name: '时尚写真', 
    prompt: 'Generate a high-fashion editorial photo of this person. Trendy, stylish outfit. Dramatic lighting, confident pose. The background should be abstract or minimal but chic. Vogue magazine style. Preserve facial features.' 
  },
  { 
    id: 'gallery', 
    name: '美术馆迷失的她', 
    prompt: 'Generate an artistic photo of this person in a modern art gallery. They are looking at a large abstract painting or standing in a spacious gallery hall. Soft, ambient lighting. The mood is contemplative, dreamy, and atmospheric ("Lost in the gallery"). Preserve facial features.' 
  },
  { 
    id: 'bw_art', 
    name: '黑白艺术照', 
    prompt: 'Generate a stunning Black and White artistic portrait of this person. High contrast, dramatic shadows and highlights. Classic photography style, emotional and expressive. Focus on texture and form. Preserve facial features.' 
  },
  { 
    id: 'magazine', 
    name: '美式杂志封面', 
    prompt: 'Generate a vibrant American magazine cover style portrait of this person. Bold colors, sharp focus, celebrity interview style. The subject looks engaging and charismatic. High-end retouching feel. Preserve facial features.' 
  },
  { 
    id: 'cinematic', 
    name: '电影肖像', 
    prompt: 'Generate a cinematic close-up portrait of this person. Shallow depth of field (bokeh background). Teal and orange color grading or dramatic mood lighting. It should look like a still frame from a high-budget movie. Preserve facial features.' 
  }
];

export interface PortraitResult {
  styleId: string;
  image: string | null; // Base64
  error?: string;
}

/**
 * Generates a series of 6 portraits based on one input image.
 */
export const generatePortraitSeries = async (
  base64Data: string,
  mimeType: string,
): Promise<PortraitResult[]> => {
  const ai = getClient();
  const model = 'gemini-2.5-flash-image';

  // Create an array of promises to run in parallel
  const promises = PORTRAIT_STYLES.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            { text: style.prompt }
          ]
        }
      });

      // Extract image
      const parts = response.candidates?.[0]?.content?.parts;
      let imageBase64 = null;
      let textOutput = "";
      
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            imageBase64 = part.inlineData.data;
            break;
          }
          if (part.text) {
             textOutput += part.text;
          }
        }
      }

      if (!imageBase64) throw new Error(textOutput || "No image returned");

      return {
        styleId: style.id,
        image: imageBase64
      };

    } catch (err: any) {
      console.error(`Failed to generate ${style.name}:`, err);
      return {
        styleId: style.id,
        image: null,
        error: err.message || "生成失败"
      };
    }
  });

  return Promise.all(promises);
};