import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import LoginScreen from './pages/LoginScreen';
import HomeScreen from './pages/HomeScreen';
import GroupScreen from './pages/GroupScreen';
import SavedScreen from './pages/SavedScreen';
import ProfileScreen from './pages/ProfileScreen';

function MainApp() {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('home');
    const [selectedGroup, setSelectedGroup] = useState(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-xs text-stone-400 font-bold">
                読み込み中...
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return (
        <div className="flex justify-center bg-stone-100 min-h-screen">
            <div className="relative w-full max-w-sm flex flex-col min-h-screen bg-white shadow-2xl">

                {/* 共通ヘッダー（スクロール領域の外に固定配置） */}
                <Header
                    user={user}
                    onOpenProfile={() => setActiveTab('settings')}
                />

                <div className="flex-1 flex flex-col overflow-y-auto pb-24">
                    {activeTab === 'home' && <HomeScreen selectedGroup={selectedGroup} />}
                    {activeTab === 'group' && (
                        <GroupScreen selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
                    )}
                    {activeTab === 'saved' && <SavedScreen />}
                    {activeTab === 'settings' && <ProfileScreen />}
                </div>

                {/* 共通フッターナビ（画面全体を基準に固定配置） */}
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40">
                    <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <MainApp />
        </AuthProvider>
    );
}