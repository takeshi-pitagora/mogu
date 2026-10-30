import React from 'react';
import { getAvatarSrc } from '../assets/avatars/avatars';

export default function Header({ user, activeTab, onOpenProfile, onOpenSettings }) {
  const avatarSrc = getAvatarSrc(user?.avatar);

  return (
    <header
      className="flex-none flex items-center justify-between px-6 pb-2 bg-white"
      style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
    >
      <h1 className="font-logo text-3xl font-black tracking-tight text-stone-900">
        mogu
      </h1>
      {activeTab === 'settings' ? (
        // マイページでは右上を設定の歯車にする（ログアウト・アカウント削除・規約などへ）
        <button
          onClick={onOpenSettings}
          aria-label="設定"
          className="w-11 h-11 rounded-full border-[1.5px] border-[#F0EAE0] bg-[#FBF7F0] flex items-center justify-center active:scale-95 transition"
        >
          <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      ) : (
      <button
        onClick={onOpenProfile}
        className="flex items-center gap-1.5 p-1 active:scale-95 transition"
      >
        <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-lg shadow-inner overflow-hidden">
          {avatarSrc ? (
            <img src={avatarSrc} alt="プロフィールアイコン" className="w-full h-full object-cover" />
          ) : (
            <span>{user?.avatar || '👤'}</span>
          )}
        </div>
      </button>
      )}
    </header>
  );
}