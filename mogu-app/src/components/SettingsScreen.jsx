import React from 'react';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from '../lib/links';

// 設定画面（デザイン案3：シンプルリスト＋危険操作を下に分離）
// マイページ右上の歯車から開く。画面全体を覆い、左上の「戻る」で閉じる。
export default function SettingsScreen({ onClose, onEditProfile, onRetakeDiagnosis, onLogout, onDeleteAccount }) {
    const openUrl = (url) => window.open(url, '_blank', 'noopener,noreferrer');

    const items = [
        { label: 'プロフィール編集', onClick: onEditProfile },
        { label: '食スタイル診断をやり直す', onClick: onRetakeDiagnosis },
        { label: 'プライバシーポリシー', onClick: () => openUrl(PRIVACY_POLICY_URL) },
        { label: '利用規約', onClick: () => openUrl(TERMS_URL) },
        { label: 'ヘルプ・お問い合わせ', onClick: () => window.open(`mailto:${SUPPORT_EMAIL}`, '_self') },
    ];

    return (
        <div
            role="dialog"
            aria-label="設定"
            className="fixed inset-0 z-50 flex justify-center bg-stone-100"
        >
            <div
                className="w-full sm:max-w-sm h-full flex flex-col bg-white text-stone-900 font-rounded"
                style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
            >
                <div className="flex-none px-4 pt-3">
                    <button
                        onClick={onClose}
                        aria-label="マイページに戻る"
                        className="w-11 h-11 flex items-center justify-center rounded-full active:bg-stone-100"
                    >
                        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                    </button>
                </div>
                <h1 className="flex-none px-6 pt-1 pb-4 text-[30px] font-black">設定</h1>

                <nav aria-label="設定項目" className="flex-1 min-h-0 overflow-y-auto px-6">
                    {items.map((item) => (
                        <button
                            key={item.label}
                            onClick={item.onClick}
                            className="w-full flex items-center justify-between py-[18px] border-b border-[#F0EAE0] text-left text-base font-extrabold active:opacity-60"
                        >
                            {item.label}
                            <span aria-hidden="true" className="text-lg text-[#A39A8C]">›</span>
                        </button>
                    ))}
                </nav>

                <div className="flex-none px-6 pb-6 pt-4 flex flex-col gap-2.5">
                    <button
                        onClick={onLogout}
                        className="w-full py-3.5 rounded-full border-2 border-stone-900 bg-white text-[15px] font-black active:scale-[0.99] transition"
                    >
                        ログアウト
                    </button>
                    <button
                        onClick={onDeleteAccount}
                        className="w-full py-2.5 text-[13px] font-extrabold text-[#B42318] underline"
                    >
                        アカウントを削除する
                    </button>
                    <p className="mt-1 text-center text-[11px] font-bold text-[#8C8478]">mogu バージョン 1.1</p>
                </div>
            </div>
        </div>
    );
}
