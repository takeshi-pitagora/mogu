import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AVATARS, getAvatarSrc } from '../assets/avatars/avatars';
import { getType } from '../lib/mogutype';
import { fetchGroupPeers, rankPeers } from '../lib/peers';
import DiagnosisModal from '../components/DiagnosisModal';
import SettingsScreen from '../components/SettingsScreen';
import CompatModal, { CompatRow } from '../components/CompatModal';

// 診断日（food_axes.at に保存）を「2026.10.29」の形にする
const formatDate = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

// マイページ（デザイン決定案）
// 上：Mogu Type のチケット（タイプ・キャラ・タグ・ニックネーム）
// 中：「友達と相性診断する」ボタン
// 下：相性診断 Top3（同じグループの友達との相性）
// 設定（ログアウト・アカウント削除・規約など）は右上の歯車 → SettingsScreen
export default function ProfileScreen({ settingsOpen = false, onCloseSettings, onGoGroup }) {
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
    const [showDiagnosis, setShowDiagnosis] = useState(false);

    // 相性診断：同じグループの友達（null = 読み込み中）
    const [peersRaw, setPeersRaw] = useState(null);
    const [showCompat, setShowCompat] = useState(false);

    const userId = user?.id;
    const isGuest = !!user?.isGuest;
    useEffect(() => {
        if (!userId || isGuest) return undefined;
        let alive = true;
        fetchGroupPeers(userId)
            .then((rows) => { if (alive) setPeersRaw(rows); })
            .catch((e) => {
                console.error('友達の取得エラー:', e?.message || e);
                if (alive) setPeersRaw([]);
            });
        return () => { alive = false; };
    }, [userId, isGuest]);

    if (!user) return null;

    const myType = getType(user.foodStyle);
    const peers = rankPeers(user, isGuest ? [] : peersRaw || []);
    const peersLoading = !isGuest && peersRaw === null;
    const top3 = peers.filter((p) => p.percent != null).slice(0, 3);
    const diagnosedAt = formatDate(user.foodAxes?.at);

    const openEdit = () => {
        setDraft(user);
        setErrorMessage('');
        setIsEditing(true);
    };

    const openDelete = () => {
        setDeleteError('');
        setDeleteInput('');
        setShowDeleteConfirm(true);
    };

    // 「友達と相性診断する」を開くたびに、最新のメンバーを取り直す
    const openCompat = () => {
        setShowCompat(true);
        if (!userId || isGuest) return;
        fetchGroupPeers(userId).then(setPeersRaw).catch(() => {});
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
    const myCharSrc = myType ? getAvatarSrc(myType.avatarId) : null;

    return (
        <div className="flex-1 flex flex-col bg-[#FBF7F0] text-stone-900 px-5 pt-3.5 pb-4 font-rounded">

            {/* Mogu Type チケット */}
            <section className="flex-none bg-[#FFFBF2] border-[2.5px] border-stone-900 rounded-[20px] shadow-[0_5px_0_#1C1917] overflow-hidden">
                <div className="bg-[#3F7A61] text-[#FFFBF2] flex justify-between items-center px-4 py-[7px]">
                    <span className="text-[11px] font-black tracking-[0.14em]">MOGU TYPE</span>
                    <span className="text-[11px] font-extrabold">{diagnosedAt}</span>
                </div>
                {myType ? (
                    <div className="flex flex-col items-center px-4 pt-3 pb-2.5">
                        <p className="m-0 text-4xl font-black tracking-[0.06em] leading-none">{myType.code}</p>
                        <img src={myCharSrc} alt={myType.name} className="mt-1 object-contain" style={{ width: 'min(150px, 18vh)', height: 'min(150px, 18vh)' }} />
                        <h1 className="m-0 text-[22px] font-black">{myType.name}</h1>
                    </div>
                ) : (
                    <div className="flex flex-col items-center px-4 pt-5 pb-4 gap-3">
                        <p className="m-0 text-4xl font-black tracking-[0.06em] leading-none text-stone-300">????</p>
                        <p className="m-0 text-sm font-bold text-stone-500 text-center">20問の診断で、あなたの食スタイルとキャラが決まります。</p>
                        <button
                            onClick={() => setShowDiagnosis(true)}
                            className="px-6 py-2.5 rounded-full bg-[#3F7A61] text-white text-sm font-black active:scale-[0.98] transition"
                        >
                            食スタイル診断を受ける
                        </button>
                    </div>
                )}
                <div aria-hidden="true" className="border-t-[2.5px] border-dashed border-stone-900 mx-3" />
                <div className="px-4 pt-2.5 pb-3 flex flex-col items-center gap-2">
                    {myType && (
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {myType.tags.map((t) => (
                                <span key={t} className="text-[11px] font-black bg-[#EFE9DF] rounded-full px-2.5 py-0.5">#{t}</span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#6B6359]">ニックネーム</span>
                        <span className="text-[17px] font-black">{user.name}</span>
                        <button
                            onClick={openEdit}
                            aria-label="ニックネームを編集"
                            className="w-[30px] h-[30px] rounded-full border-[1.5px] border-[#D8CFC1] bg-white flex items-center justify-center"
                        >
                            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg>
                        </button>
                    </div>
                </div>
            </section>

            {/* 友達と相性診断する */}
            <button
                onClick={openCompat}
                className="flex-none mt-5 w-full py-4 rounded-full bg-[#B5603F] text-white text-[17px] font-black border-2 border-stone-900 shadow-[0_5px_0_#1C1917] active:translate-y-[3px] active:shadow-[0_2px_0_#1C1917] transition"
            >
                友達と相性診断する
            </button>

            {/* 相性診断 Top3 */}
            <section className="flex-none pt-[22px]">
                <h2 className="mb-2.5 text-[15px] font-black">相性診断 Top3</h2>
                {!myType ? (
                    <p className="text-xs font-bold text-stone-400">診断を受けると、友達との相性がここに表示されます。</p>
                ) : peersLoading ? (
                    <p className="text-xs font-bold text-stone-400">読み込み中...</p>
                ) : top3.length === 0 ? (
                    <p className="text-xs font-bold text-stone-400">
                        グループの友達が診断すると、相性の高い3人がここに表示されます。
                    </p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {top3.map((p, i) => <CompatRow key={p.id} peer={p} highlight={i === 0} />)}
                    </div>
                )}
            </section>

            {/* 設定（右上の歯車から） */}
            {settingsOpen && (
                <SettingsScreen
                    onClose={onCloseSettings}
                    onEditProfile={openEdit}
                    onRetakeDiagnosis={() => setShowDiagnosis(true)}
                    onLogout={logout}
                    onDeleteAccount={openDelete}
                />
            )}

            {/* 友達との相性一覧 */}
            {showCompat && (
                <CompatModal
                    peers={peers}
                    loading={peersLoading}
                    myTypeReady={!!myType}
                    onClose={() => setShowCompat(false)}
                    onDiagnose={() => { setShowCompat(false); setShowDiagnosis(true); }}
                    onGoGroup={() => { setShowCompat(false); onGoGroup?.(); }}
                />
            )}

            {/* プロフィール編集モーダル（既存ロジックを維持） */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center">
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
                                    {(() => {
                                        const type = getType(draft.foodStyle);
                                        return (
                                            <div className="flex items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl">
                                                {type ? (
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <img src={getAvatarSrc(type.avatarId)} alt={type.name} className="w-10 h-10 rounded-full object-cover border border-stone-200 flex-shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-stone-800 truncate">{type.name}</p>
                                                            <p className="text-[10px] font-bold text-stone-400 tracking-wider">{type.code}・{type.tags.slice(0, 2).join('・')}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-bold text-stone-700">未診断</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDiagnosis(true)}
                                                    className="text-xs font-bold text-amber-800 underline flex-shrink-0"
                                                >
                                                    {type ? 'もう一度診断' : '診断を受ける'}
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
            {/* アカウント削除の確認モーダル */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center">
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

            {/* 食スタイル診断（Mogu Type） */}
            {showDiagnosis && (
                <DiagnosisModal
                    onClose={() => setShowDiagnosis(false)}
                    // 結果が出たら、編集中の下書き（大きい丸アイコン・食スタイル欄）にも反映する
                    onResult={({ code, avatarId }) => setDraft((d) => (d ? { ...d, avatar: avatarId, foodStyle: code } : d))}
                />
            )}
        </div>
    );
}
