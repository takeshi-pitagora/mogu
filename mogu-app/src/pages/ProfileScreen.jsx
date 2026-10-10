import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { AVATARS, getAvatarSrc } from '../assets/avatars/avatars';

import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../lib/links';

// public/icons/ にあるファイルを、他の画面と同じ Icon コンポーネント経由で参照する。
// name には拡張子・パスを含めず、ファイル名の本体だけを指定する（他画面の書き方に合わせている）。
const MENU_ITEMS = [
    { key: 'account', label: 'アカウント', icon: 'account' },
    { key: 'privacy', label: 'プライバシー', icon: 'privacy' },
    { key: 'diagnosis', label: '診断', icon: 'diagnosis', url: 'https://mogu-mogu-match.pages.dev/' },
    { key: 'help', label: 'ヘルプ', icon: 'help' },
    { key: 'delete', label: 'アカウント削除', icon: 'delete' },
];

export default function ProfileScreen() {
    const { user, logout, updateProfile, deleteAccount } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(user);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // アカウント削除の確認モーダル
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    if (!user) return null;

    const openEdit = () => {
        setDraft(user);
        setErrorMessage('');
        setIsEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setErrorMessage('');
        const { error } = await updateProfile({
            name: draft.name,
            avatar: draft.avatar,
            foodStyle: draft.foodStyle,
        });
        setSaving(false);
        if (error) {
            setErrorMessage(error);
            return;
        }
        setIsEditing(false);
    };

    // 「アカウント」カードは既存の編集モーダルを開く。
    // url を持つ項目（診断）は、そのユーザーのidをパラメータに付けて外部サイトへ遷移させる。
    // それ以外は未実装のプレースホルダー。
    const handleMenuClick = (item) => {
        if (item.key === 'account') {
            openEdit();
            return;
        }
        if (item.url) {
            const urlWithUser = `${item.url}?user_id=${encodeURIComponent(user.id)}`;
            window.open(urlWithUser, '_blank', 'noopener,noreferrer');
            return;
        }
        if (item.key === 'privacy') {
            window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer');
            return;
        }
        if (item.key === 'help') {
            window.open(`mailto:${SUPPORT_EMAIL}`, '_self');
            return;
        }
        if (item.key === 'delete') {
            setDeleteError('');
            setDeleteInput('');
            setShowDeleteConfirm(true);
            return;
        }
        console.log(`「${item.key}」は未実装です。`);
    };

    // アカウント削除（App Store 5.1.1(v)）。実処理は Edge Function 側で行う。
    const handleConfirmDelete = async () => {
        if (deleteInput !== '削除') {
            setDeleteError('「削除」と入力してください。');
            return;
        }
        setDeleting(true);
        setDeleteError('');
        const { error } = await deleteAccount();
        setDeleting(false);
        if (error) {
            setDeleteError(error);
            return;
        }
        setShowDeleteConfirm(false); // 成功時は logout 相当で user が null になり、ログイン画面へ戻る
    };

    // draft.avatar が新しい画像アバターのidなら画像、
    // それ以外（過去の絵文字データなど）ならそのまま文字として表示する
    const draftAvatarSrc = getAvatarSrc(draft?.avatar);

    return (
        <div className="flex-1 flex flex-col px-5 py-8">

            {/* メニューカードグリッド */}
            <div className="grid grid-cols-2 gap-4">
                {MENU_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        onClick={() => handleMenuClick(item)}
                        className="flex flex-col items-center justify-center gap-5 py-8 rounded-[28px] border border-[#F0EAE0] bg-[#FBF7F0] active:scale-[0.98] transition"
                    >
                        <span className="text-sm font-bold text-stone-700">{item.label}</span>
                        <Icon name={item.icon} className="w-10 h-10" alt={item.label} />
                    </button>
                ))}
            </div>

            {/* プロフィール編集モーダル（既存ロジックを維持） */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center">
                    <div className="w-full max-w-sm flex flex-col justify-between bg-white text-stone-800 p-6 shadow-2xl overflow-y-auto max-h-[90vh] rounded-t-3xl sm:rounded-3xl">
                        <div>
                            {/* ヘッダー */}
                            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                                <button onClick={() => setIsEditing(false)} className="text-stone-500 font-bold text-sm hover:text-stone-900">
                                    キャンセル
                                </button>
                                <h2 className="font-black text-base text-stone-900">プロフィール編集</h2>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || user.isGuest}
                                    className="text-amber-800 font-bold text-sm hover:opacity-80 disabled:opacity-40"
                                >
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>

                            {user.isGuest && (
                                <p className="text-[11px] text-stone-400 font-medium mt-3">
                                    ゲストアカウントはプロフィールを保存できません。
                                </p>
                            )}
                            {errorMessage && (
                                <p className="text-[11px] text-red-500 font-bold mt-3">{errorMessage}</p>
                            )}

                            {/* アイコン選択（画像16種） */}
                            <div className="flex flex-col items-center py-6">
                                <div className="w-20 h-20 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-4xl shadow-inner mb-4 overflow-hidden">
                                    {draftAvatarSrc ? (
                                        <img src={draftAvatarSrc} alt="選択中のアイコン" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{draft.avatar || '👤'}</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 gap-2.5">
                                    {AVATARS.map((av) => {
                                        const selected = draft.avatar === av.id;
                                        return (
                                            <button
                                                key={av.id}
                                                type="button"
                                                onClick={() => setDraft({ ...draft, avatar: av.id })}
                                                className={`w-12 h-12 rounded-full overflow-hidden border-2 active:scale-95 transition ${
                                                    selected ? 'border-stone-900' : 'border-stone-200'
                                                }`}
                                            >
                                                <img src={av.src} alt={av.id} className="w-full h-full object-cover" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 入力フィールド */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">ニックネーム</label>
                                    <input
                                        type="text"
                                        value={draft.name}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:border-stone-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">メールアドレス</label>
                                    <input
                                        type="email"
                                        value={draft.email || ''}
                                        disabled
                                        title="メールアドレスの変更は現在対応していません"
                                        className="w-full px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-sm font-medium text-stone-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">食スタイル診断</label>
                                    <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                                        <span className="text-sm font-bold text-stone-700">{draft.foodStyle}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const urlWithUser = `https://mogu-mogu-match.pages.dev/?user_id=${encodeURIComponent(user.id)}`;
                                                window.open(urlWithUser, '_blank', 'noopener,noreferrer');
                                            }}
                                            className="text-xs font-bold text-amber-800 underline"
                                        >
                                            診断を受ける
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ログアウト */}
                        <button
                            onClick={logout}
                            className="w-full py-3 mt-6 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition"
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            )}
                    {/* アカウント削除の確認モーダル */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center">
                    <div className="w-full max-w-sm bg-white text-stone-800 p-6 shadow-2xl rounded-t-3xl sm:rounded-3xl">
                        <h2 className="font-black text-base text-stone-900 mb-2">アカウントを削除しますか？</h2>
                        <p className="text-xs text-stone-500 leading-relaxed mb-4">
                            この操作は取り消せません。プロフィール・スワイプ履歴・保存したお店・
                            作成したグループなど、このアカウントに紐づくデータがすべて削除されます。
                        </p>
                        <p className="text-xs font-bold text-stone-700 mb-2">
                            よろしければ「削除」と入力してください。
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder="削除"
                            className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium mb-3 focus:outline-none focus:border-red-400"
                        />
                        {deleteError && (
                            <p className="text-[11px] text-red-500 font-bold mb-3">{deleteError}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40"
                            >
                                {deleting ? '削除中…' : 'アカウントを削除する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}