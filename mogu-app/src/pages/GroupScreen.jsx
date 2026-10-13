import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { buildInviteLink, extractInviteToken, SUPPORT_EMAIL } from '../lib/links';

const REPORT_REASONS = [
    '不適切・攻撃的なグループ名',
    '迷惑行為・嫌がらせ',
    'スパム・宣伝目的',
    'その他',
];

// 表示ラベルと、DB上のpurpose値の対応
const TAGS = [
    { label: '恋人', value: 'date' },
    { label: '友人', value: 'friend' },
    { label: '家族', value: 'family' },
    { label: '仕事', value: 'business' },
];

export default function GroupScreen({ selectedGroup, onSelectGroup }) {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupPurpose, setNewGroupPurpose] = useState('friend');

    const [inviteGroup, setInviteGroup] = useState(null);
    const [inviteLink, setInviteLink] = useState('');
    const [inviteCopied, setInviteCopied] = useState(false);

    const [joinToken, setJoinToken] = useState('');
    const [joinError, setJoinError] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);

    // 報告・退出メニュー
    const [menuGroup, setMenuGroup] = useState(null);
    const [menuMode, setMenuMode] = useState('menu'); // 'menu' | 'report' | 'reported' | 'leave'
    const [menuBusy, setMenuBusy] = useState(false);
    const [menuError, setMenuError] = useState('');

    // 選択中のタグ（purpose値）。null は「絞り込みなし」を意味する
    const [activePurposeFilter, setActivePurposeFilter] = useState(null);

    // 自分が参加しているグループ一覧を取得（group_members経由）
    const fetchGroups = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('group_members')
                .select('groups(*)')
                .eq('user_id', user.id);

            if (error) throw error;
            const myGroups = (data || [])
                .map((row) => row.groups)
                .filter(Boolean)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setGroups(myGroups);
        } catch (err) {
            console.error('グループ取得エラー:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, [user?.id]);

    // 新規グループ作成（作成者を自動でgroup_membersに追加）
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim() || !user?.id) return;

        try {
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: newGroupName,
                    purpose: newGroupPurpose,
                    created_by: user.id,
                })
                .select()
                .single();

            if (groupError) throw groupError;

            const { error: memberError } = await supabase.from('group_members').insert({
                group_id: group.id,
                user_id: user.id,
            });
            if (memberError) throw memberError;

            setIsModalOpen(false);
            setNewGroupName('');
            setNewGroupPurpose('friend');
            fetchGroups();
        } catch (err) {
            console.error('作成失敗:', err.message);
        }
    };

    // 招待トークンを発行してリンクを生成（有効期限7日）
    const handleGenerateInvite = async (group) => {
        setInviteGroup(group);
        setInviteLink('');
        setInviteCopied(false);
        try {
            const token = crypto.randomUUID().replace(/-/g, '');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            const { error } = await supabase.from('invites').insert({
                group_id: group.id,
                token,
                expires_at: expiresAt,
            });
            if (error) throw error;

            setInviteLink(buildInviteLink(token));
        } catch (err) {
            console.error('招待作成エラー:', err.message);
        }
    };

    // ---- 報告・退出（ブロック）メニュー ----
    const openGroupMenu = (group) => {
        setMenuGroup(group);
        setMenuMode('menu');
        setMenuError('');
    };
    const closeGroupMenu = () => {
        setMenuGroup(null);
        setMenuError('');
    };

    // 報告は運営の問い合わせ先へメールで届ける（グループIDを本文に入れて特定できるようにする）
    const handleReportGroup = (reason) => {
        if (!menuGroup) return;
        const subject = `【MogU 通報】グループ「${menuGroup.name}」`;
        const body = [
            '以下のグループを報告します。',
            '',
            `理由: ${reason}`,
            `グループ名: ${menuGroup.name}`,
            `グループID: ${menuGroup.id}`,
            `報告者ID: ${user?.id ?? '-'}`,
            '',
            '詳しい内容（任意）:',
            '',
        ].join('\n');
        window.open(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
            '_self'
        );
        setMenuMode('reported');
    };

    // 退出＝自分の group_members 行を削除。以後このグループのメンバーとはマッチせず、一覧にも出ない
    const handleLeaveGroup = async () => {
        if (!menuGroup || !user?.id) return;
        setMenuBusy(true);
        setMenuError('');
        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', menuGroup.id)
                .eq('user_id', user.id);
            if (error) throw error;
            if (selectedGroup?.id === menuGroup.id && onSelectGroup) onSelectGroup(null);
            setGroups((prev) => prev.filter((g) => g.id !== menuGroup.id));
            closeGroupMenu();
        } catch (err) {
            console.error('退出エラー:', err.message);
            setMenuError('退出に失敗しました。時間をおいて再度お試しください。');
        } finally {
            setMenuBusy(false);
        }
    };

    const handleCopyInvite = async () => {
        if (!inviteLink) return;
        try {
            await navigator.clipboard.writeText(inviteLink);
            setInviteCopied(true);
        } catch (err) {
            console.error('コピー失敗:', err.message);
        }
    };

    // 招待トークン（またはリンク全体）を入力してグループに参加
    const handleJoinByToken = async (e) => {
        e.preventDefault();
        setJoinError('');
        const rawToken = joinToken.trim();
        if (!rawToken || !user?.id) return;

        const token = extractInviteToken(rawToken);

        setJoinLoading(true);
        try {
            const { data: invite, error: inviteError } = await supabase
                .from('invites')
                .select('*')
                .eq('token', token)
                .maybeSingle();
            if (inviteError) throw inviteError;

            if (!invite) {
                setJoinError('招待リンクが見つかりません。');
                return;
            }
            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                setJoinError('この招待リンクは有効期限が切れています。');
                return;
            }

            const { error: joinErr } = await supabase
                .from('group_members')
                .upsert({ group_id: invite.group_id, user_id: user.id });
            if (joinErr) throw joinErr;

            setJoinToken('');
            fetchGroups();
        } catch (err) {
            console.error('参加エラー:', err.message);
            setJoinError('参加に失敗しました。もう一度お試しください。');
        } finally {
            setJoinLoading(false);
        }
    };

    const getPurposeBadge = (purpose) => {
        const map = { date: '恋人', friend: '友人', family: '家族', business: '仕事' };
        return map[purpose] || '友人';
    };

    // タグタップ時：同じものをもう一度押したら解除、違うものなら切り替え
    const toggleTagFilter = (value) => {
        setActivePurposeFilter((prev) => (prev === value ? null : value));
    };

    const filteredGroups = groups.filter((g) => {
        const matchesQuery = g.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
        const matchesTag = activePurposeFilter ? g.purpose === activePurposeFilter : true;
        return matchesQuery && matchesTag;
    });

    return (
        <div className="flex-1 flex flex-col px-5 py-4 bg-white select-none relative">
        {/* 検索バー ＋ 追加ボタン */}
        <section className="flex items-center gap-3 mb-4">
            <button
            onClick={() => setIsModalOpen(true)}
            className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center text-stone-700 text-2xl font-light active:scale-95 transition flex-shrink-0"
            >
            ＋
            </button>

            <div className="flex-1 relative flex items-center">
            <input
                type="text"
                placeholder="グループを検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-5 pr-12 rounded-full border border-[#F0EAE0] bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400"
            />
            <div className="absolute right-4 pointer-events-none text-stone-300">
                <Icon name="group_gray" className="w-5 h-5 opacity-40" alt="検索" />
            </div>
            </div>
        </section>

        {/* タグフィルターバー */}
        <section className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {TAGS.map((tag) => {
                const isActive = activePurposeFilter === tag.value;
                return (
                    <button
                        key={tag.value}
                        onClick={() => toggleTagFilter(tag.value)}
                        className={`flex items-center gap-1 px-4 py-1.5 rounded-full border text-xs font-bold active:scale-95 transition flex-shrink-0 ${
                            isActive
                                ? 'bg-stone-900 border-stone-900 text-white'
                                : 'bg-white border-[#F0EAE0] text-stone-800'
                        }`}
                    >
                        <span>{tag.label}</span>
                        {isActive && <span className="text-[10px]">✕</span>}
                    </button>
                );
            })}
        </section>

        {/* 招待コードで参加 */}
        <form onSubmit={handleJoinByToken} className="flex items-center gap-2 mt-4">
            <input
            type="text"
            placeholder="招待リンク／コードを入力して参加"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            className="flex-1 h-10 px-4 rounded-full border border-[#F0EAE0] bg-white text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400"
            />
            <button
            type="submit"
            disabled={joinLoading}
            className="h-10 px-4 rounded-full bg-stone-900 text-white text-xs font-bold active:scale-95 transition disabled:opacity-50 flex-shrink-0"
            >
            {joinLoading ? '参加中...' : '参加'}
            </button>
        </form>
        {joinError && <p className="text-[11px] text-red-500 font-bold mt-1">{joinError}</p>}

        {/* 参加中グループ一覧 */}
        <h2 className="text-sm font-bold text-stone-900 mt-5 mb-3">参加中のグループ</h2>

        {loading ? (
            <div className="py-12 text-center text-xs text-stone-400 font-bold">読み込み中...</div>
        ) : filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400 font-bold">
            {activePurposeFilter
                ? `「${getPurposeBadge(activePurposeFilter)}」に一致するグループがありません。`
                : '参加中のグループがありません。＋ ボタンから作成してみましょう。'}
            </div>
        ) : (
            <div className="space-y-3">
            {filteredGroups.map((group) => (
                <div
                key={group.id}
                onClick={() => onSelectGroup && onSelectGroup(group)}
                className={`flex items-center justify-between p-4 rounded-3xl border bg-white active:scale-[0.99] transition cursor-pointer ${
                    selectedGroup?.id === group.id ? 'border-stone-800' : 'border-[#F0EAE0]'
                }`}
                >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#F4EFE6] flex items-center justify-center text-xl flex-shrink-0">
                    {group.purpose === 'date' ? '👩‍❤️‍👨' : '👥'}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-stone-900 truncate">{group.name}</h3>
                        <span className="text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        {getPurposeBadge(group.purpose)}
                        </span>
                    </div>
                    <p className="text-[11px] text-stone-400 font-medium">
                        {selectedGroup?.id === group.id ? 'マッチング対象に選択中' : 'タップして選択'}
                    </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateInvite(group);
                        }}
                        className="text-[10px] font-bold text-stone-500 border border-stone-200 rounded-full px-3 py-1.5"
                    >
                        招待する
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openGroupMenu(group);
                        }}
                        aria-label="グループのメニュー（報告・退出）"
                        className="w-8 h-8 rounded-full text-stone-400 text-lg font-black leading-none active:bg-stone-100"
                    >
                        ⋯
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}

        {/* 新規グループ作成モーダル */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl">
                <h3 className="text-base font-black text-stone-900 mb-4">新しいグループを作成</h3>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block">グループ名</label>
                    <input
                    type="text"
                    required
                    placeholder="例: 代官山ランチ部"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block">目的</label>
                    <select
                    value={newGroupPurpose}
                    onChange={(e) => setNewGroupPurpose(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400 bg-white"
                    >
                    <option value="friend">友人</option>
                    <option value="date">恋人</option>
                    <option value="family">家族</option>
                    <option value="business">仕事</option>
                    </select>
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                    >
                    キャンセル
                    </button>
                    <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#EFE9DF] text-xs font-bold text-stone-900"
                    >
                    作成する
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}

        {/* グループのメニュー：報告／退出（App Store 1.2 ユーザー生成コンテンツ対策） */}
        {menuGroup && (
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                onClick={closeGroupMenu}
            >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}
            >
                <h3 className="text-base font-black text-stone-900 mb-1 truncate">「{menuGroup.name}」</h3>

                {menuMode === 'menu' && (
                <>
                    <p className="text-[11px] text-stone-400 font-medium mb-4">
                        不適切なグループ名や、迷惑なメンバーがいる場合は報告してください。
                    </p>
                    <div className="space-y-2">
                        <button
                            onClick={() => setMenuMode('report')}
                            className="w-full py-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-800"
                        >
                            このグループを報告する
                        </button>
                        <button
                            onClick={() => setMenuMode('leave')}
                            className="w-full py-3 rounded-xl bg-red-50 text-xs font-bold text-red-600"
                        >
                            グループから退出する（ブロック）
                        </button>
                        <button
                            onClick={closeGroupMenu}
                            className="w-full py-3 rounded-xl text-xs font-bold text-stone-500"
                        >
                            キャンセル
                        </button>
                    </div>
                </>
                )}

                {menuMode === 'report' && (
                <>
                    <p className="text-[11px] text-stone-400 font-medium mb-3">報告の理由を選んでください。</p>
                    <div className="space-y-2 mb-3">
                        {REPORT_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => handleReportGroup(reason)}
                                className="w-full py-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-800"
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-stone-400 font-medium mb-3">
                        報告は運営チームに送信され、24時間以内に内容を確認します。不適切と判断した場合は、グループの削除やユーザーの利用停止を行います。
                    </p>
                    <button
                        onClick={() => setMenuMode('menu')}
                        className="w-full py-3 rounded-xl text-xs font-bold text-stone-500"
                    >
                        戻る
                    </button>
                </>
                )}

                {menuMode === 'reported' && (
                <>
                    <p className="text-xs text-stone-600 font-medium leading-relaxed mb-4">
                        報告用のメールを作成しました。送信していただくと、運営チームが24時間以内に確認します。
                        <br />
                        このグループの表示をやめたい場合は、続けて「退出する」を選んでください。
                    </p>
                    <button
                        onClick={() => setMenuMode('leave')}
                        className="w-full py-3 rounded-xl bg-red-50 text-xs font-bold text-red-600 mb-2"
                    >
                        グループから退出する
                    </button>
                    <button
                        onClick={closeGroupMenu}
                        className="w-full py-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                    >
                        閉じる
                    </button>
                </>
                )}

                {menuMode === 'leave' && (
                <>
                    <p className="text-xs text-stone-600 font-medium leading-relaxed mb-4">
                        退出すると、このグループとメンバーとのマッチングは行われなくなり、一覧にも表示されません。再参加するには新しい招待コードが必要です。
                    </p>
                    {menuError && <p className="text-[11px] text-red-500 font-bold mb-3">{menuError}</p>}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMenuMode('menu')}
                            className="flex-1 py-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                        >
                            戻る
                        </button>
                        <button
                            onClick={handleLeaveGroup}
                            disabled={menuBusy}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40"
                        >
                            {menuBusy ? '退出中…' : '退出する'}
                        </button>
                    </div>
                </>
                )}
            </div>
            </div>
        )}

        {/* 招待リンクモーダル */}
        {inviteGroup && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl">
                <h3 className="text-base font-black text-stone-900 mb-1">「{inviteGroup.name}」に招待</h3>
                <p className="text-[11px] text-stone-400 font-medium mb-4">
                    このリンクを知っている人だけがグループに参加できます（7日間有効）。
                </p>
                {inviteLink ? (
                <>
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 break-all mb-3">
                        {inviteLink}
                    </div>
                    <button
                        onClick={handleCopyInvite}
                        className="w-full py-2.5 rounded-xl bg-[#EFE9DF] text-xs font-bold text-stone-900 mb-2"
                    >
                        {inviteCopied ? 'コピーしました ✓' : 'リンクをコピー'}
                    </button>
                </>
                ) : (
                <div className="py-6 text-center text-xs text-stone-400 font-bold">発行中...</div>
                )}
                <button
                    onClick={() => setInviteGroup(null)}
                    className="w-full py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                >
                    閉じる
                </button>
            </div>
            </div>
        )}
        </div>
    );
}