import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, ItemCategory, OutfitRequest, OutfitSuggestion } from "../types";

// ⚠️ 修复：辅助函数，统一获取 AI 客户端并验证 Key
const getAIClient = () => {
  // 这里必须用 import.meta.env.VITE_... 才能在 Cloudflare + Vite 环境下稳定读取
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key 未配置，请检查 Cloudflare 环境变量 VITE_GEMINI_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to safely parse JSON from AI response
const safeJsonParse = (text: string) => {
  try {
    const cleanText = text.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw new Error("模型返回格式错误，请重试");
  }
};

/**
 * 1. Analyze an uploaded image
 * Uses: gemini-2.5-flash (保留原样)
 */
export const analyzeClothingImage = async (base64Data: string): Promise<Partial<ClothingItem>> => {
  const ai = getAIClient(); // 使用修复后的客户端获取方式
  
  const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  const prompt = `
    分析这张服装图片。
    识别其分类，请严格从以下选项中选择一个最准确的: 
    ["上衣", "裤子/下装", "外套", "鞋子", "包袋", "围巾", "帽子", "其他配饰"]
    
    提取主要颜色, 以及简短的视觉描述 (例如 "带银色扣子的蓝色牛仔夹克").
    并提供3-5个风格标签 (例如 "休闲", "夏季", "复古").
    请严格返回 JSON 格式。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // 遵从你的指示，保留此模型名
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: Object.values(ItemCategory) },
          color: { type: Type.STRING },
          description: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["category", "color", "description", "tags"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("无法分析图片");
  
  return safeJsonParse(text);
};

/**
 * 2. Suggest an outfit
 * Uses: gemini-3-pro-preview (保留原样)
 */
export const suggestOutfit = async (
  wardrobe: ClothingItem[], 
  request: OutfitRequest
): Promise<OutfitSuggestion> => {
  const ai = getAIClient(); // 使用修复后的客户端获取方式

  const wardrobeSummary = wardrobe.map(item => 
    `- ID: ${item.id}, 类型: ${item.category}, 颜色: ${item.color}, 描述: ${item.description}`
  ).join('\n');

  const prompt = `
    你是一位高端时尚造型师。
    
    我的衣橱:
    ${wardrobeSummary}
    
    场景要求:
    - 天气: ${request.weather}
    - 场合: ${request.occasion}
    - 心情: ${request.mood}
    - 风格目标: ${request.styleGoal}
    
    任务:
    从我的衣橱中选择最佳的搭配组合。
    返回 JSON，包含:
    1. 'selectedItemIds': 选中物品的ID数组。
    2. 'styleName': 为这套造型起一个有创意的中文名字。
    3. 'reasoning': 中文解释为什么这套搭配适合当下的天气和场合。
    4. 'generatedVisualPrompt': 一个高度详细的英文视觉提示词 (Visual Prompt)，用于生成模特穿着这套衣服的照片。必须基于衣物描述详细描写质感、剪裁和颜色。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // 遵从你的指示，保留此模型名
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          selectedItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          styleName: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          generatedVisualPrompt: { type: Type.STRING }
        },
        required: ["selectedItemIds", "styleName", "reasoning", "generatedVisualPrompt"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("生成建议失败");
  return safeJsonParse(text);
};

/**
 * 3. Generate the visual OOTD image.
 * Uses: gemini-3-pro-image-preview (保留原样)
 */
export const generateOOTDImage = async (visualPrompt: string, userImageBase64?: string): Promise<string> => {
  const ai = getAIClient(); // 使用修复后的客户端获取方式

  let contents: any;

  if (userImageBase64) {
    const cleanBase64 = userImageBase64.includes('base64,') ? userImageBase64.split('base64,')[1] : userImageBase64;
    contents = {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
        { text: `Generate a photorealistic fashion image of the person in this image wearing the following outfit. Maintain their facial features, hairstyle, and body type as much as possible.\n\nOutfit Description:\n${visualPrompt}` }
      ]
    };
  } else {
    const enhancedPrompt = `
      Fashion photography, full body shot. 
      A stylish model wearing the following outfit:
      ${visualPrompt}
      
      Lighting: Soft natural daylight or chic evening ambience depending on outfit.
      Background: Minimalist street or studio, neutral.
      Style: High fashion, realistic texture, 4k.
    `;
    contents = {
      parts: [{ text: enhancedPrompt }]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // 遵从你的指示，保留此模型名
    contents: contents,
    config: {
      imageConfig: {
        aspectRatio: "3:4", 
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("未生成图片");
};
