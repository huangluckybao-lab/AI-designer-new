export enum ItemCategory {
  TOP = '上衣',
  BOTTOM = '裤子/下装',
  OUTERWEAR = '外套',
  SHOES = '鞋子',
  BAG = '包袋',
  SCARF = '围巾',
  HAT = '帽子',
  ACCESSORY = '其他配饰'
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be hashed!
  createdAt: number;
}

export interface ClothingItem {
  id: string;
  userId: string; // Owner
  imageBase64: string;
  category: ItemCategory;
  color: string;
  description: string; // AI generated description
  tags: string[];
  addedAt: number;
}

export interface OutfitRequest {
  weather: string;
  occasion: string;
  mood: string;
  styleGoal: string;
}

export interface OutfitSuggestion {
  selectedItemIds: string[];
  reasoning: string;
  styleName: string;
  generatedVisualPrompt: string;
}

export interface SavedOutfit {
  id: string;
  userId: string; // Owner
  items: ClothingItem[];
  suggestion: OutfitSuggestion;
  generatedImageBase64?: string; // The AI generated OOTD image
  createdAt: number;
}

export type Tab = 'wardrobe' | 'stylist' | 'history';