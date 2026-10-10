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
            <div className="fixed inset-0 flex items-center justify-center bg-white text-xs text-stone-400 font-bold">
                読み込み中...
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return (
        // 画面全体を固定。スクロールするのは中央のコンテンツ欄だけ（ヘッダーとナビは動かない）
        <div className="fixed inset-0 flex justify-center bg-stone-100">
            <div className="relative w-full sm:max-w-sm h-full flex flex-col bg-white sm:shadow-2xl">

                {/* 共通ヘッダー（スクロール領域の外に固定配置） */}
                <Header
                    user={user}
                    onOpenProfile={() => setActiveTab('settings')}
                />

                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain">
                    {activeTab === 'home' && <HomeScreen selectedGroup={selectedGroup} />}
                    {activeTab === 'group' && (
                        <GroupScreen selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
                    )}
                    {activeTab === 'saved' && <SavedScreen />}
                    {activeTab === 'settings' && <ProfileScreen />}
                </div>

                {/* 共通フッターナビ（画面下に固定） */}
                <div className="flex-none z-40">
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