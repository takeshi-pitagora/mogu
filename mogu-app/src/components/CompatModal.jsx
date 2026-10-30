import React from 'react';
import { getAvatarSrc } from '../assets/avatars/avatars';

// 友達のアイコン：診断済みならタイプのキャラ、未診断なら本人が選んだアイコン
export function PeerAvatar({ peer, size = 40 }) {
    const src = getAvatarSrc(peer.type?.avatarId) || getAvatarSrc(peer.avatar);
    return (
        <div
            className="flex-none rounded-full overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {src ? (
                <img src={src} alt={peer.type?.name || peer.name} className="w-full h-full object-cover" />
            ) : (
                <span style={{ fontSize: size * 0.5 }}>{peer.avatar || '👤'}</span>
            )}
        </div>
    );
}

// 相性バー1行（マイページの Top3 と、全員の一覧で共通）
export function CompatRow({ peer, highlight = false }) {
    const label = peer.type ? `${peer.name}・${peer.type.name}` : peer.name;
    return (
        <div className="flex items-center gap-3">
            <PeerAvatar peer={peer} />
            <div className="flex-1 min-w-0">
                <p className="mb-1 text-[13px] font-black truncate">{label}</p>
                <div className="h-2 rounded bg-[#EFE9DF]">
                    {peer.percent != null && (
                        <div
                            className="h-full rounded"
                            style={{ width: `${peer.percent}%`, background: highlight ? '#B5603F' : '#1C1917' }}
                        />
                    )}
                </div>
            </div>
            <span className="w-11 text-right text-base font-black">
                {peer.percent != null ? `${peer.percent}%` : <span className="text-[11px] text-stone-400">未診断</span>}
            </span>
        </div>
    );
}

// 「友達と相性診断する」：同じグループの友達全員との相性を、高い順に表示する
export default function CompatModal({ peers, loading, myTypeReady, onClose, onDiagnose, onGoGroup }) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center">
            <div className="w-full max-w-sm bg-white text-stone-900 font-rounded p-6 shadow-2xl rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col"
                style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black">友達との相性</h2>
                    <button onClick={onClose} aria-label="閉じる" className="w-9 h-9 rounded-full bg-[#F4EFE6] flex items-center justify-center">
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                {!myTypeReady ? (
                    <div className="py-6 text-center">
                        <p className="text-sm font-bold text-stone-600 mb-4">相性を出すには、先に食スタイル診断を受けてください。</p>
                        <button onClick={onDiagnose} className="px-6 py-3 rounded-full bg-[#B5603F] text-white text-sm font-black border-2 border-stone-900">
                            食スタイル診断を受ける
                        </button>
                    </div>
                ) : loading ? (
                    <p className="py-8 text-center text-xs font-bold text-stone-400">読み込み中...</p>
                ) : peers.length === 0 ? (
                    <div className="py-6 text-center">
                        <p className="text-sm font-bold text-stone-600 mb-4">
                            グループに友達を招待すると、ここに相性が表示されます。
                        </p>
                        <button onClick={onGoGroup} className="px-6 py-3 rounded-full bg-[#B5603F] text-white text-sm font-black border-2 border-stone-900">
                            グループに友達を招待する
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-1">
                        {peers.map((p, i) => (
                            <CompatRow key={p.id} peer={p} highlight={i === 0 && p.percent != null} />
                        ))}
                        <p className="mt-2 text-[11px] font-bold text-stone-400">
                            同じグループのメンバーとの相性です。まだ診断していない友達は「未診断」と表示されます。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
