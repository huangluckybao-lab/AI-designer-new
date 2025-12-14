import React, { useState, useEffect } from 'react';
import { ClothingItem, SavedOutfit, Tab, User } from './types';
import WardrobeView from './components/WardrobeView';
import StylistView from './components/StylistView';
import AuthView from './components/AuthView';
import { StorageService } from './services/storage';
import { IconHanger, IconSparkles, IconHistory, IconTrash, IconLogOut } from './constants';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>('wardrobe');
  const [loadingData, setLoadingData] = useState(false);
  
  // State is now just a mirror of DB data for rendering
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [history, setHistory] = useState<SavedOutfit[]>([]);

  // Load data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const w = await StorageService.getAllWardrobe(currentUser.id);
        setWardrobe(w.sort((a, b) => b.addedAt - a.addedAt));
        
        const h = await StorageService.getAllHistory(currentUser.id);
        setHistory(h.sort((a, b) => b.createdAt - a.createdAt));
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [currentUser]);

  // --- Auth Actions ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setWardrobe([]);
    setHistory([]);
    setActiveTab('wardrobe');
  };

  // --- Wardrobe Actions ---
  const handleAddItem = async (item: Omit<ClothingItem, 'userId'>) => {
    if (!currentUser) return;
    try {
      // Ensure item has userId
      const itemWithUser: ClothingItem = { ...item, userId: currentUser.id };
      await StorageService.addWardrobeItem(itemWithUser);
      setWardrobe(prev => [itemWithUser, ...prev]);
    } catch (e) {
      console.error(e);
      alert("保存失败，请重试");
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await StorageService.deleteWardrobeItem(id);
      setWardrobe(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error(e);
      alert("删除失败");
    }
  };

  // --- History Actions ---
  const handleSaveOutfit = async (outfit: Omit<SavedOutfit, 'userId'>) => {
    if (!currentUser) return;
    try {
      const outfitWithUser: SavedOutfit = { ...outfit, userId: currentUser.id };
      await StorageService.addHistoryItem(outfitWithUser);
      setHistory(prev => [outfitWithUser, ...prev]);
    } catch (e) {
      console.error(e);
      alert("保存穿搭失败");
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await StorageService.deleteHistoryItem(id);
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error(e);
      alert("删除失败");
    }
  };

  // 1. Not Logged In
  if (!currentUser) {
    return <AuthView onLogin={handleLogin} />;
  }

  // 2. Logged In but Loading Data
  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // 3. Main App UI
  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 shadow-2xl relative overflow-hidden flex flex-col">
      
      {/* Top Bar for Logout (Optional placement, or put in settings) */}
      <div className="absolute top-4 right-4 z-50">
        <button onClick={handleLogout} className="p-2 bg-white/80 backdrop-blur rounded-full shadow-sm hover:bg-red-50 text-gray-600 hover:text-red-500 transition-colors">
          <IconLogOut />
        </button>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'wardrobe' && (
          <WardrobeView 
            items={wardrobe} 
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
          />
        )}
        {activeTab === 'stylist' && (
          <StylistView 
            wardrobe={wardrobe} 
            onSaveOutfit={handleSaveOutfit} 
          />
        )}
        {activeTab === 'history' && (
          <div className="p-4 pb-24 space-y-6 pt-12"> {/* Added top padding for logout button space */}
             <header>
                <h2 className="text-2xl font-serif font-bold text-primary">灵感库</h2>
                <p className="text-sm text-gray-500">您的历史穿搭记录</p>
             </header>
             <div className="grid gap-6">
                {history.length === 0 && <p className="text-gray-400 text-center py-10">暂无保存的穿搭。</p>}
                {history.map(look => (
                  <div key={look.id} className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                    {look.generatedImageBase64 && (
                      <div className="relative">
                          {/* UPDATED: Changed from fixed h-64 to aspect-[3/4] to show full body */}
                          <img src={look.generatedImageBase64} alt={look.suggestion.styleName} className="w-full aspect-[3/4] object-cover object-top" />
                          <button onClick={() => handleDeleteHistoryItem(look.id)} className="absolute top-2 right-2 bg-white/80 p-2 rounded-full hover:bg-red-50 text-red-500"><IconTrash /></button>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-serif font-bold text-lg">{look.suggestion.styleName}</h3>
                      <p className="text-xs text-gray-500 mt-1">{new Date(look.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600 mt-2">{look.suggestion.reasoning}</p>
                      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                         {look.items.map(item => (
                           <img key={item.id} src={item.imageBase64} className="w-10 h-10 rounded-md object-cover border" />
                         ))}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center p-3">
          <button 
            onClick={() => setActiveTab('wardrobe')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'wardrobe' ? 'text-primary' : 'text-gray-400'}`}
          >
            <IconHanger />
            <span className="text-[10px] font-medium tracking-wide">衣橱</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('stylist')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'stylist' ? 'text-primary' : 'text-gray-400'}`}
          >
            <div className={`p-3 rounded-full -mt-8 shadow-lg border-4 border-gray-50 transition-all ${activeTab === 'stylist' ? 'bg-primary text-white' : 'bg-white text-gray-400'}`}>
               <IconSparkles />
            </div>
            <span className="text-[10px] font-medium tracking-wide">搭配师</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-primary' : 'text-gray-400'}`}
          >
            <IconHistory />
            <span className="text-[10px] font-medium tracking-wide">灵感</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;