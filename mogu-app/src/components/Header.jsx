import React from 'react';
import { getAvatarSrc } from '../assets/avatars/avatars';

export default function Header({ user, onOpenProfile }) {
  const avatarSrc = getAvatarSrc(user?.avatar);

  return (
    <header
      className="flex-none flex items-center justify-between px-6 pb-2 bg-white"
      style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
    >
      <h1 className="font-logo text-3xl font-black tracking-tight text-stone-900">
        mogu
      </h1>
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
    </header>
  );
}