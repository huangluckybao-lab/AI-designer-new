import React, { useState, useRef } from 'react';
import { ClothingItem, OutfitRequest, OutfitSuggestion, SavedOutfit } from '../types';
// ⚠️ 修复：去掉了 ensureApiKey
import { suggestOutfit, generateOOTDImage } from '../services/geminiService';
import { resizeImage } from '../utils';
import { WEATHER_OPTIONS, OCCASION_OPTIONS, MOOD_OPTIONS, STYLE_OPTIONS, IconSparkles, IconUser, IconCamera, IconRefresh, IconClose, IconHanger } from '../constants';

interface StylistViewProps {
  wardrobe: ClothingItem[];
  onSaveOutfit: (outfit: Omit<SavedOutfit, 'userId'>) => void;
}

type StylistStep = 'input' | 'processing' | 'result';

const StylistView: React.FC<StylistViewProps> = ({ wardrobe, onSaveOutfit }) => {
  const [step, setStep] = useState<StylistStep>('input');
  const [request, setRequest] = useState<OutfitRequest>({
    weather: WEATHER_OPTIONS[0],
    occasion: OCCASION_OPTIONS[0],
    mood: MOOD_OPTIONS[0],
    styleGoal: STYLE_OPTIONS[0]
  });
  
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Result State
  const [currentOutfitId, setCurrentOutfitId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Swap State
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [swapCandidates, setSwapCandidates] = useState<ClothingItem[]>([]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 1024, 0.8);
      setUserPhoto(resized);
    } catch (err) {
      console.error(err);
      alert("照片处理失败");
    }
  };

  // 1. Initial Full Generation (Analysis + Image)
  const handleGenerate = async () => {
    if (wardrobe.length < 2) {
      alert("请至少在衣橱中添加两件单品。");
      return;
    }

    setStep('processing');
    setProcessingStatus("AI 搭配师正在构思...");

    try {
      // ⚠️ 修复：删除了 await ensureApiKey();
      
      // Step A: Reasoning
      const result = await suggestOutfit(wardrobe, request);
      setSuggestion(result);
      setSelectedItemIds(result.selectedItemIds);

      // Step B: Visualization
      setProcessingStatus(userPhoto ? "正在为您试穿..." : "正在生成效果图...");
      const image = await generateOOTDImage(result.generatedVisualPrompt, userPhoto || undefined);
      setGeneratedImage(image);

      // Save Initial Result
      const newId = crypto.randomUUID();
      setCurrentOutfitId(newId);
      
      const selectedItems = wardrobe.filter(item => result.selectedItemIds.includes(item.id));
      onSaveOutfit({
        id: newId,
        items: selectedItems,
        suggestion: result,
        generatedImageBase64: image,
        createdAt: Date.now()
      });

      setStep('result');
    } catch (error) {
      console.error(error);
      alert("生成失败，请检查网络连接或稍后重试。");
      setStep('input');
    }
  };

  // 2. Regeneration (Image Only based on new items)
  const handleRegenerateImage = async () => {
    if (!suggestion || !currentOutfitId) return;

    setIsRegenerating(true);
    // Don't change step, just show loading state in button or overlay
    
    try {
      // ⚠️ 修复：删除了 await ensureApiKey();

      // Construct dynamic prompt based on current items
      const selectedItems = wardrobe.filter(item => selectedItemIds.includes(item.id));
      const itemDescriptions = selectedItems.map(i => `${i.color} ${i.description} (${i.category})`).join(", ");
      const finalPrompt = `A full body fashion shot. Model wearing: ${itemDescriptions}. Style: ${request.styleGoal}. Occasion: ${request.occasion}. High quality, photorealistic, 4k.`;

      const image = await generateOOTDImage(finalPrompt, userPhoto || undefined);
      setGeneratedImage(image);

      // Update existing record
      onSaveOutfit({
        id: currentOutfitId, // Reuse ID to overwrite
        items: selectedItems,
        suggestion: {
            ...suggestion,
            selectedItemIds: selectedItemIds
        },
        generatedImageBase64: image,
        createdAt: Date.now()
      });

    } catch (error) {
      console.error(error);
      alert("更新图片失败");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Swap Logic
  const openSwapModal = (itemId: string) => {
    const itemToSwap = wardrobe.find(i => i.id === itemId);
    if (!itemToSwap) return;

    const candidates = wardrobe.filter(i => 
      i.category === itemToSwap.category && i.id !== itemId
    );

    if (candidates.length === 0) {
      alert(`没有其他${itemToSwap.category}可选`);
      return;
    }

    setSwapTargetId(itemId);
    setSwapCandidates(candidates);
    setIsSwapModalOpen(true);
  };

  const handleSwapConfirm = (newItemId: string) => {
    if (!swapTargetId) return;
    setSelectedItemIds(prev => prev.map(id => id === swapTargetId ? newItemId : id));
    setIsSwapModalOpen(false);
    setSwapTargetId(null);
  };

  // --- RENDER ---

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 space-y-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <IconSparkles />
          </div>
        </div>
        <div>
            <h3 className="text-xl font-serif font-bold text-primary">正在打造您的造型</h3>
            <p className="text-gray-500 mt-2 animate-pulse">{processingStatus}</p>
        </div>
      </div>
    );
  }

  if (step === 'result' && suggestion && generatedImage) {
    const selectedItems = wardrobe.filter(item => selectedItemIds.includes(item.id));
    const isDirty = JSON.stringify(selectedItemIds.sort()) !== JSON.stringify(suggestion.selectedItemIds.sort());

    return (
      <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
         {/* Main Image Area */}
         <div className="relative bg-gray-100">
            <img src={generatedImage} alt="AI Generated OOTD" className={`w-full aspect-[3/4] object-cover transition-opacity duration-300 ${isRegenerating ? 'opacity-50' : 'opacity-100'}`} />
            
            {/* Overlay for Regeneration */}
            {isRegenerating && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-black/70 text-white px-4 py-2 rounded-full flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>更新效果图中...</span>
                    </div>
                </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                <h2 className="text-3xl font-serif font-bold leading-tight">{suggestion.styleName}</h2>
                <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-md rounded-md text-xs">{request.occasion}</span>
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-md rounded-md text-xs">{request.mood}</span>
                </div>
            </div>
         </div>

         <div className="p-4 space-y-6"> {/* Reduced padding from p-6 to p-4 for better mobile fit */}
            {/* Reasoning */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">搭配灵感</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{suggestion.reasoning}</p>
            </div>

            {/* Editable Item List */}
            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <h3 className="font-bold text-gray-900">当前搭配单品</h3>
                    {isDirty && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium">
                            请更新效果图
                        </span>
                    )}
                </div>
                
                <div className="grid gap-3">
                    {selectedItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                <img src={item.imageBase64} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100 bg-gray-50" />
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 text-sm truncate">{item.category}</p>
                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => openSwapModal(item.id)}
                                className="ml-3 flex-shrink-0 p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-200 hover:text-primary transition-colors border border-gray-100"
                                aria-label="更换"
                            >
                                <IconRefresh />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Regenerate Button - Shows when dirty or user just wants to retry */}
                <div className="pt-2">
                  <button 
                      onClick={handleRegenerateImage}
                      disabled={isRegenerating}
                      className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                          isDirty 
                          ? 'bg-primary hover:bg-black transform scale-[1.02]' 
                          : 'bg-gray-800 hover:bg-gray-900'
                      }`}
                  >
                      <IconSparkles />
                      {isDirty ? "确认更换并更新效果图" : "重新生成效果图"}
                  </button>
                </div>
            </div>

            <button 
                onClick={() => {
                    setStep('input');
                    setGeneratedImage(null);
                    setSuggestion(null);
                    setSelectedItemIds([]);
                    setCurrentOutfitId(null);
                }}
                className="w-full py-3 text-gray-500 text-sm hover:text-primary transition-colors border border-dashed border-gray-300 rounded-xl"
            >
                开始新的搭配
            </button>
         </div>

         {/* Swap Modal */}
         {isSwapModalOpen && (
             <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                 <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-lg flex items-center gap-2">
                            <IconHanger /> 选择替换单品
                         </h3>
                         <button onClick={() => setIsSwapModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><IconClose /></button>
                     </div>
                     <div className="overflow-y-auto grid grid-cols-2 gap-3 p-1">
                         {swapCandidates.map(cand => (
                             <button 
                                key={cand.id} 
                                onClick={() => handleSwapConfirm(cand.id)}
                                className="text-left group relative rounded-lg overflow-hidden border border-gray-200 hover:border-primary transition-all active:scale-95"
                             >
                                 <img src={cand.imageBase64} className="w-full aspect-square object-cover" />
                                 <div className="p-2 text-xs bg-white">
                                     <p className="font-medium truncate">{cand.color}</p>
                                     <p className="text-gray-500 truncate">{cand.description}</p>
                                 </div>
                             </button>
                         ))}
                     </div>
                 </div>
             </div>
         )}
      </div>
    );
  }

  // Input Phase
  return (
    <div className="p-4 space-y-8 pb-24">
      <header>
        <h2 className="text-3xl font-serif font-bold text-primary">开始搭配</h2>
        <p className="text-gray-500 mt-1">基于您真实衣橱的 AI 智能穿搭建议。</p>
      </header>

      <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        
        {/* User Photo Section */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-3">
             <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
               <IconUser />
               谁来试穿？
             </label>
             {userPhoto && (
               <button onClick={() => setUserPhoto(null)} className="text-xs text-red-500 hover:underline">
                 清除照片
               </button>
             )}
          </div>
          
          {!userPhoto ? (
            <button 
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 hover:border-gray-400 transition-colors"
            >
              <IconCamera />
              <span className="text-xs mt-2">上传您的全身照 (可选)</span>
              <span className="text-[10px] text-gray-400">生成效果更逼真</span>
            </button>
          ) : (
            <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-200">
              <img src={userPhoto} alt="Me" className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-medium">
                已上传照片
              </div>
            </div>
          )}
          <input 
            type="file" 
            ref={photoInputRef}
            onChange={handlePhotoUpload}
            className="hidden" 
            accept="image/*"
          />
        </div>

        {/* Input Groups */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">天气</label>
          <div className="grid grid-cols-2 gap-2">
            {WEATHER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setRequest(r => ({ ...r, weather: opt }))}
                className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                  request.weather === opt 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-white text-gray-900 border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">场合</label>
          <select 
            value={request.occasion}
            onChange={(e) => setRequest(r => ({ ...r, occasion: e.target.value }))}
            className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {OCCASION_OPTIONS.map(o => <option key={o} value={o} className="text-gray-900">{o}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">心情</label>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map(m => (
               <button
               key={m}
               onClick={() => setRequest(r => ({ ...r, mood: m }))}
               className={`text-xs py-2 px-4 rounded-full border transition-all ${
                 request.mood === m
                   ? 'bg-accent text-white border-accent' 
                   : 'bg-white text-gray-900 border-gray-200 hover:border-accent'
               }`}
             >
               {m}
             </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
           <label className="text-sm font-semibold text-gray-700">风格目标</label>
           <select 
            value={request.styleGoal}
            onChange={(e) => setRequest(r => ({ ...r, styleGoal: e.target.value }))}
            className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {STYLE_OPTIONS.map(o => <option key={o} value={o} className="text-gray-900">{o}</option>)}
          </select>
        </div>

        <button 
          onClick={handleGenerate}
          className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:bg-black transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
        >
          <IconSparkles />
          {userPhoto ? "分析并试穿" : "智能搭配"}
        </button>
      </div>
    </div>
  );
};

export default StylistView;
