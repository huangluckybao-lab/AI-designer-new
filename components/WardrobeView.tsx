import React, { useState, useRef } from 'react';
import { ClothingItem, ItemCategory } from '../types';
import { analyzeClothingImage } from '../services/geminiService';
import { IconCamera, IconPlus, IconTrash } from '../constants';
import { resizeImage } from '../utils';

interface WardrobeViewProps {
  items: ClothingItem[];
  onAddItem: (item: Omit<ClothingItem, 'userId'>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const WardrobeView: React.FC<WardrobeViewProps> = ({ items, onAddItem, onDeleteItem }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Resize and Compress Image
      const resizedBase64 = await resizeImage(file, 800, 0.7);

      // 2. Analyze with Gemini
      try {
        const analysis = await analyzeClothingImage(resizedBase64);
        
        // 3. Create Item
        const newItem: Omit<ClothingItem, 'userId'> = {
          id: crypto.randomUUID(),
          imageBase64: resizedBase64,
          category: analysis.category || ItemCategory.ACCESSORY,
          color: analysis.color || '未知',
          description: analysis.description || '无描述',
          tags: analysis.tags || [],
          addedAt: Date.now()
        };
        
        // 4. Persist via parent handler
        await onAddItem(newItem);

      } catch (error) {
        console.error("Gemini analysis failed", error);
        alert("无法分析图片，请检查网络或重试。");
      } finally {
        setIsUploading(false);
      }
    } catch (err) {
      console.error("Image processing error", err);
      setIsUploading(false);
      alert("图片处理失败");
    }
  };

  const handleDelete = (id: string) => {
    if(confirm("确定要删除这件单品吗？")) {
      onDeleteItem(id);
    }
  };

  // Group items by category for display
  const categoriesOrder = [
    ItemCategory.TOP, 
    ItemCategory.BOTTOM, 
    ItemCategory.OUTERWEAR, 
    ItemCategory.SHOES, 
    ItemCategory.BAG, 
    ItemCategory.SCARF, 
    ItemCategory.HAT, 
    ItemCategory.ACCESSORY
  ];

  const groupedItems = categoriesOrder.map(cat => ({
    title: cat,
    items: items.filter(i => i.category === cat)
  })).filter(group => group.items.length > 0);

  const hasItems = items.length > 0;

  return (
    <div className="p-4 pb-24 space-y-6">
      <header className="flex justify-between items-center sticky top-0 bg-gray-50 z-10 py-2">
        <div>
          <h2 className="text-2xl font-serif font-bold text-primary">我的衣橱</h2>
          <p className="text-sm text-gray-500">已收录 {items.length} 件单品</p>
        </div>
        <button 
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary text-white p-3 rounded-full shadow-lg hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
        >
          {isUploading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <IconPlus />}
        </button>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
      </header>

      {!hasItems && (
         <div className="py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="flex justify-center mb-4"><IconCamera /></div>
            <p className="text-lg font-medium text-gray-600">衣橱空空如也</p>
            <p className="text-sm mt-1">点击右上角 + 号上传你的第一件单品</p>
          </div>
      )}

      {/* Categorized Lists */}
      <div className="space-y-8">
        {groupedItems.map((group) => (
          <div key={group.title} className="space-y-3">
             <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-800">{group.title}</h3>
                <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-white rounded-full border border-gray-100">{group.items.length}</span>
             </div>
             <div className="grid grid-cols-3 gap-3">
                {group.items.map(item => (
                  <div key={item.id} className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 aspect-square">
                    <img 
                      src={item.imageBase64} 
                      alt={item.description} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="absolute top-1 right-1 p-1.5 bg-white/20 backdrop-blur-md rounded-full hover:bg-red-500 transition-colors"
                      >
                        <IconTrash />
                      </button>
                      <p className="text-[10px] line-clamp-2 leading-tight opacity-90">{item.description}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        ))}
      </div>
      
      {/* Items categorized as 'Other' or undefined that didn't fit in main groups */}
      {items.filter(i => !categoriesOrder.includes(i.category)).length > 0 && (
         <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800">未分类</h3>
            <div className="grid grid-cols-3 gap-3">
                {items.filter(i => !categoriesOrder.includes(i.category)).map(item => (
                    <div key={item.id} className="group relative bg-white rounded-lg overflow-hidden shadow-sm aspect-square">
                        <img src={item.imageBase64} className="w-full h-full object-cover" />
                         <button 
                        onClick={() => handleDelete(item.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"
                      >
                        <IconTrash />
                      </button>
                    </div>
                ))}
            </div>
         </div>
      )}
    </div>
  );
};

export default WardrobeView;