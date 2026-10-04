import React from 'react';
import Icon from './Icon';

export default function BottomNav({ activeTab, setActiveTab }) {
    const tabs = [
        {
        id: 'home',
        label: 'ホーム',
        activeIcon: 'home_white',     // ← 選択中（白）のファイル名
        inactiveIcon: 'home_gray',    // ← 未選択（グレー）のファイル名
        },
        {
        id: 'group',
        label: 'グループ',
        activeIcon: 'group_white',    // ← 選択中（白）のファイル名
        inactiveIcon: 'group_gray',   // ← 未選択（グレー）のファイル名
        },
        {
        id: 'saved',
        label: '保存',
        activeIcon: 'saved_white',    // ← 選択中（白）のファイル名
        inactiveIcon: 'saved_gray',   // ← 未選択（グレー）のファイル名
        },
        {
        id: 'settings',
        label: 'マイページ',
        activeIcon: 'setting_white',  // ← 選択中（白）のファイル名
        inactiveIcon: 'setting_gray', // ← 未選択（グレー）のファイル名
        },
    ];

    return (
        <nav className="safe-bottom h-24 bg-white flex items-center justify-around px-4 pb-3 border-t border-stone-100 select-none">
        {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center focus:outline-none"
            >
                {isActive ? (
                /* 選択中：ベージュの丸背景 ＋ 白アイコン ＋ 白文字 */
                <div className="w-16 h-16 rounded-full bg-[#F0EAE0] flex flex-col items-center justify-center shadow-sm transition-all duration-200">
                    <Icon
                    name={tab.activeIcon}
                    className="w-7 h-7"
                    alt={tab.label}
                    />
                    <span className="text-[10px] font-bold text-white mt-0.5">
                    {tab.label}
                    </span>
                </div>
                ) : (
                /* 未選択：背景なし ＋ グレーアイコン ＋ グレー文字 */
                <div className="w-16 h-16 flex flex-col items-center justify-center transition-all duration-200">
                    <Icon
                    name={tab.inactiveIcon}
                    className="w-7 h-7"
                    alt={tab.label}
                    />
                    <span className="text-[10px] font-bold text-stone-400 mt-1">
                    {tab.label}
                    </span>
                </div>
                )}
            </button>
            );
        })}
        </nav>
    );
}