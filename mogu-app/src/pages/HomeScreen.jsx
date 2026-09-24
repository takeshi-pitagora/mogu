import React, { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const AREA_OPTIONS = ['新宿', '渋谷', '恵比寿', '代官山', '中目黒', '池袋'];
const GENRE_OPTIONS = ['イタリアン', '和食', '焼肉', 'カフェ', '中華', 'フレンチ', 'ラーメン'];
const BUDGET_OPTIONS = [
    { value: 1, label: '〜￥1,000' },
    { value: 2, label: '￥1,000〜￥3,000' },
    { value: 3, label: '￥3,000〜￥5,000' },
    { value: 4, label: '￥5,000〜' },
];

const EMPTY_FILTERS = { areas: [], genre: '', priceLevel: null };
const SWIPE_THRESHOLD = 100; // これ以上ドラッグしたら確定スワイプとみなす距離(px)
const EXIT_DURATION = 250; // スワイプアウトのアニメーション時間(ms)

export default function HomeScreen({ selectedGroup }) {
    const { user } = useAuth();
    const [restaurants, setRestaurants] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [matchedShop, setMatchedShop] = useState(null);
    const [searchError, setSearchError] = useState('');

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [activeModal, setActiveModal] = useState(null);
    const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [exitDirection, setExitDirection] = useState(null); // null | 'like' | 'nope'
    const dragStartXRef = useRef(0);

    const hasActiveFilters =
        filters.areas.length > 0 || !!filters.genre || filters.priceLevel !== null;

    useEffect(() => {
        async function fetchRestaurants() {
            try {
                setLoading(true);
                setSearchError('');

                let swipedIds = [];
                if (user?.id) {
                    const { data: swiped, error: swipedError } = await supabase
                        .from('swipes')
                        .select('restaurant_id')
                        .eq('user_id', user.id);
                    if (swipedError) throw swipedError;
                    swipedIds = (swiped || []).map((s) => s.restaurant_id);
                }

                let data = [];

                if (filters.areas.length > 0) {
                    const results = await Promise.all(
                        filters.areas.map((area) =>
                            supabase.functions.invoke('places-search', { body: { area } })
                        )
                    );

                    const merged = new Map();
                    results.forEach(({ data: fnData, error: fnError }) => {
                        if (fnError) throw fnError;
                        (fnData?.restaurants || []).forEach((r) => merged.set(r.id, r));
                    });
                    data = Array.from(merged.values());
                } else {
                    const { data: qData, error: qError } = await supabase
                        .from('restaurants')
                        .select('*')
                        .eq('is_excluded', false);
                    if (qError) throw qError;
                    data = qData || [];
                }

                let filtered = data.filter((r) => !swipedIds.includes(r.id));

                if (filters.genre) {
                    filtered = filtered.filter((r) => r.genre === filters.genre);
                }
                if (filters.priceLevel !== null) {
                    filtered = filtered.filter(
                        (r) => String(r.price_level) === String(filters.priceLevel)
                    );
                }

                setRestaurants(filtered);
                setCurrentIndex(0);
            } catch (err) {
                console.error('店舗取得エラー:', err.message);
                setSearchError('お店の取得に失敗しました。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        }
        fetchRestaurants();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, filters.areas.join(','), filters.genre, filters.priceLevel]);

        // 次に表示される予定の店舗の画像を先読みしておく（表示ラグ対策）
    useEffect(() => {
        const PRELOAD_COUNT = 3; // 現在の1件先から、何件分を先読みするか
        for (let i = 1; i <= PRELOAD_COUNT; i++) {
            const upcoming = restaurants[currentIndex + i];
            if (!upcoming) continue;

            const url =
                upcoming.photo_food ||
                upcoming.photo_interior ||
                'https://images.unsplash.com/photo-1555939594-58d7cb561ad1';

            const img = new Image();
            img.src = url;
        }
    }, [restaurants, currentIndex]);

    const formatPriceLevel = (level) => {
        const map = { 0: '無料', 1: '〜￥1,000', 2: '￥1,000〜￥3,000', 3: '￥3,000〜￥5,000', 4: '￥5,000〜' };
        return map[level] ?? '価格情報なし';
    };

    const checkForMatch = async (restaurant) => {
        if (!selectedGroup?.id || !user?.id) return;
        try {
            const { data: members, error: memberError } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', selectedGroup.id)
                .neq('user_id', user.id);
            if (memberError) throw memberError;

            const memberIds = (members || []).map((m) => m.user_id);
            if (memberIds.length === 0) return;

            const { data: matches, error: matchError } = await supabase
                .from('swipes')
                .select('user_id')
                .eq('restaurant_id', restaurant.id)
                .eq('action', 'like')
                .in('user_id', memberIds);
            if (matchError) throw matchError;

            if (matches && matches.length > 0) {
                await supabase.from('saved_restaurants').upsert(
                    {
                        user_id: user.id,
                        restaurant_id: restaurant.id,
                        group_id: selectedGroup.id,
                    },
                    { onConflict: 'user_id,restaurant_id,group_id' }
                );
                setMatchedShop(restaurant);
            }
        } catch (err) {
            console.error('マッチング確認エラー:', err.message);
        }
    };

    // like時、選択中グループがある場合のみ saved_restaurants にも記録する
    // （group_id が NOT NULL 制約のため、グループ未選択時は書き込めない）
    const saveAsPersonalLike = async (restaurant) => {
        if (!user?.id || !selectedGroup?.id) return;
        try {
            const { error } = await supabase.from('saved_restaurants').upsert(
                {
                    user_id: user.id,
                    restaurant_id: restaurant.id,
                    group_id: selectedGroup.id,
                },
                { onConflict: 'user_id,restaurant_id,group_id' }
            );
            if (error) throw error;
        } catch (err) {
            console.error('個人保存エラー:', err.message);
        }
    };

        // 実際のDB書き込み（バックグラウンドで実行、UIの表示速度には影響させない）
    const persistSwipeInBackground = async (action, restaurant) => {
        if (!user?.id) return;
        try {
            await supabase.from('swipes').insert({
                user_id: user.id,
                restaurant_id: restaurant.id,
                action,
            });

            if (action === 'like') {
                await saveAsPersonalLike(restaurant);
                await checkForMatch(restaurant);
            }
        } catch (err) {
            console.error('スワイプ保存エラー:', err.message);
        }
    };

    // ユーザー操作への応答（同期処理）：即座に次のカードへ進める
    const handleSwipe = (action) => {
        if (currentIndex >= restaurants.length) return;
        const currentRestaurant = restaurants[currentIndex];

        // 画面の更新を最優先で先に行う（ここがラグの原因だった箇所）
        setCurrentIndex((prev) => prev + 1);

        // DB保存は裏側で並行して実行し、結果を待たない
        persistSwipeInBackground(action, currentRestaurant);
    };

    const currentShop = restaurants[currentIndex];

    const handlePointerDown = (e) => {
        if (exitDirection) return;
        setIsDragging(true);
        dragStartXRef.current = e.clientX;
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        setDragX(e.clientX - dragStartXRef.current);
    };

    const triggerSwipeOut = (direction) => {
        setExitDirection(direction);
        setTimeout(() => {
            handleSwipe(direction === 'like' ? 'like' : 'nope');
            setDragX(0);
            setExitDirection(null);
        }, EXIT_DURATION);
    };

    const handlePointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);

        if (dragX > SWIPE_THRESHOLD) {
            triggerSwipeOut('like');
        } else if (dragX < -SWIPE_THRESHOLD) {
            triggerSwipeOut('nope');
        } else {
            setDragX(0);
        }
    };

    let translateX = dragX;
    let rotateDeg = dragX / 20;
    if (exitDirection === 'like') {
        translateX = 600;
        rotateDeg = 20;
    } else if (exitDirection === 'nope') {
        translateX = -600;
        rotateDeg = -20;
    }

    // 左にドラッグ（nope）するほど右側の余白にアイコンが露出、右にドラッグ（like）するほど左側の余白に露出
    const nopeOpacity = exitDirection === 'nope'
        ? 1
        : Math.min(Math.max(-dragX, 0) / SWIPE_THRESHOLD, 1);
    const likeOpacity = exitDirection === 'like'
        ? 1
        : Math.min(Math.max(dragX, 0) / SWIPE_THRESHOLD, 1);

    const openAreaModal = () => {
        setDraftFilters(filters);
        setActiveModal('area');
    };

    const openAllModal = () => {
        setDraftFilters(filters);
        setActiveModal('all');
    };

    const closeModal = () => setActiveModal(null);

    const toggleDraftArea = (area) => {
        setDraftFilters((f) => ({
            ...f,
            areas: f.areas.includes(area) ? f.areas.filter((a) => a !== area) : [...f.areas, area],
        }));
    };

    const selectDraftGenre = (genre) => {
        setDraftFilters((f) => ({ ...f, genre: f.genre === genre ? '' : genre }));
    };

    const selectDraftBudget = (value) => {
        setDraftFilters((f) => ({ ...f, priceLevel: f.priceLevel === value ? null : value }));
    };

    const applyAreaModal = () => {
        setFilters((f) => ({ ...f, areas: draftFilters.areas }));
        setActiveModal(null);
    };

    const applyAllModal = () => {
        setFilters(draftFilters);
        setActiveModal(null);
    };

    const clearDraftAreas = () => setDraftFilters((f) => ({ ...f, areas: [] }));
    const clearAllDraft = () => setDraftFilters(EMPTY_FILTERS);

    const selectGenre = (genre) => {
        setFilters((f) => ({ ...f, genre: f.genre === genre ? '' : genre }));
        setActiveModal(null);
    };

    const selectBudget = (value) => {
        setFilters((f) => ({ ...f, priceLevel: f.priceLevel === value ? null : value }));
        setActiveModal(null);
    };

    const removeArea = (area) => setFilters((f) => ({ ...f, areas: f.areas.filter((a) => a !== area) }));
    const removeGenre = () => setFilters((f) => ({ ...f, genre: '' }));
    const removeBudget = () => setFilters((f) => ({ ...f, priceLevel: null }));

    const budgetLabel = (value) => BUDGET_OPTIONS.find((b) => b.value === value)?.label || '';

    return (
        <div className="flex-1 flex flex-col">
            {selectedGroup && (
                <div className="px-4 pt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-600 bg-[#F4EFE6] px-3 py-1 rounded-full">
                        👥「{selectedGroup.name}」でマッチング中
                    </span>
                </div>
            )}

            <section className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-none">
                <button
                    onClick={openAllModal}
                    className="p-2 text-stone-400 hover:text-stone-700 flex-shrink-0 flex items-center justify-center"
                >
                    <Icon name="filter" className="w-6 h-6" alt="フィルター設定" />
                </button>

                {!hasActiveFilters && (
                    <>
                        <button
                            onClick={openAreaModal}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-[#F0EAE0] bg-white text-stone-700 text-xs font-bold active:scale-95 transition flex-shrink-0"
                        >
                            <span>エリア</span>
                            <span className="text-[10px] text-[#F0EAE0]">▼</span>
                        </button>
                        <button
                            onClick={() => setActiveModal('genre')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-[#F0EAE0] bg-white text-stone-700 text-xs font-bold active:scale-95 transition flex-shrink-0"
                        >
                            <span>ジャンル</span>
                            <span className="text-[10px] text-[#F0EAE0]">▼</span>
                        </button>
                        <button
                            onClick={() => setActiveModal('budget')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-[#F0EAE0] bg-white text-stone-700 text-xs font-bold active:scale-95 transition flex-shrink-0"
                        >
                            <span>予算</span>
                            <span className="text-[10px] text-[#F0EAE0]">▼</span>
                        </button>
                    </>
                )}

                {hasActiveFilters && (
                    <>
                        {filters.areas.map((area) => (
                            <span
                                key={area}
                                className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-[#EFE9DF] text-stone-800 text-xs font-bold flex-shrink-0"
                            >
                                <button onClick={openAreaModal} className="active:opacity-70">
                                    {area}
                                </button>
                                <button
                                    onClick={() => removeArea(area)}
                                    className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[10px] active:scale-90 transition"
                                    aria-label={`${area}を解除`}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}

                        {filters.genre && (
                            <span className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-[#EFE9DF] text-stone-800 text-xs font-bold flex-shrink-0">
                                <button onClick={() => setActiveModal('genre')} className="active:opacity-70">
                                    {filters.genre}
                                </button>
                                <button
                                    onClick={removeGenre}
                                    className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[10px] active:scale-90 transition"
                                    aria-label="ジャンルを解除"
                                >
                                    ✕
                                </button>
                            </span>
                        )}

                        {filters.priceLevel !== null && (
                            <span className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-[#EFE9DF] text-stone-800 text-xs font-bold flex-shrink-0">
                                <button onClick={() => setActiveModal('budget')} className="active:opacity-70">
                                    {budgetLabel(filters.priceLevel)}
                                </button>
                                <button
                                    onClick={removeBudget}
                                    className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[10px] active:scale-90 transition"
                                    aria-label="予算を解除"
                                >
                                    ✕
                                </button>
                            </span>
                        )}
                    </>
                )}
            </section>

            {searchError && (
                <p className="text-[11px] text-red-500 font-bold px-4 -mt-1 mb-1">{searchError}</p>
            )}

            {/* メインカードエリア：画面いっぱいに拡大、左右10pxの余白のみ */}
            <div className="flex-1 flex flex-col relative px-[10px] pt-1 pb-2 min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-stone-400 font-bold">
                        読み込み中...
                    </div>
                ) : !currentShop ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center p-8 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                            <p className="text-sm font-bold text-stone-600">
                                {hasActiveFilters
                                    ? '条件に一致するお店を見終わりました！'
                                    : 'すべてのお店を見終わりました！'}
                            </p>
                            <button
                                onClick={() => setCurrentIndex(0)}
                                className="mt-4 px-5 py-2 bg-[#EFE9DF] text-stone-800 text-xs font-bold rounded-full"
                            >
                                最初から見直す
                            </button>
                        </div>
                    </div>
                ) : (
                    // 「ステージ」：動かない土台。ここに背景アイコンとカードを重ねて配置する
                    <div className="flex-1 relative">
                        {/* 背景レイヤー：左右の余白に固定されたアイコン置き場（カードが動くと露出する） */}
                        <div className="absolute inset-0 flex items-center justify-between px-4 z-0 pointer-events-none">
                            <div style={{ opacity: likeOpacity, transform: `scale(${0.8 + likeOpacity * 0.4})` }}>
                                <div className="w-16 h-16 rounded-full bg-white/90 border-4 border-rose-500 flex items-center justify-center text-3xl text-rose-500 font-black shadow-lg">
                                    ♥
                                </div>
                            </div>
                            <div style={{ opacity: nopeOpacity, transform: `scale(${0.8 + nopeOpacity * 0.4})` }}>
                                <div className="w-16 h-16 rounded-full bg-white/90 border-4 border-stone-400 flex items-center justify-center text-3xl text-stone-400 font-black shadow-lg">
                                    ✕
                                </div>
                            </div>
                        </div>

                        {/* カード本体：ドラッグ量に応じてこれだけがスライドする */}
                        <div
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            style={{
                                transform: `translateX(${translateX}px) rotate(${rotateDeg}deg)`,
                                transition: isDragging ? 'none' : `transform ${EXIT_DURATION}ms ease`,
                                cursor: isDragging ? 'grabbing' : 'grab',
                                touchAction: 'pan-y',
                            }}
                            className="absolute inset-0 rounded-3xl overflow-hidden shadow-md flex flex-col justify-end bg-stone-200 select-none z-10"
                        >
                            <img
                                src={currentShop.photo_food || currentShop.photo_interior || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1'}
                                alt={currentShop.name}
                                draggable={false}
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                            <div className="relative z-10 p-5 text-white pointer-events-none">
                                <span className="text-[10px] bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full font-bold inline-block mb-1.5">
                                    {currentShop.area} · {currentShop.genre}
                                </span>
                                <h2 className="text-xl font-black mb-1">{currentShop.name}</h2>
                                <div className="text-xs space-y-0.5 opacity-90 font-medium">
                                    <p>💰 予算: {formatPriceLevel(currentShop.price_level)}</p>
                                    <p>⭐ 評価: {currentShop.rating || '---'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {matchedShop && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center">
                        <div className="text-4xl mb-2">🎉</div>
                        <h3 className="text-base font-black text-stone-900 mb-1">マッチしました！</h3>
                        <p className="text-xs text-stone-500 font-medium mb-4">
                            「{selectedGroup?.name}」の他のメンバーも
                            <br />
                            <span className="font-bold text-stone-800">{matchedShop.name}</span> が気になっているようです。
                        </p>
                        <button
                            onClick={() => setMatchedShop(null)}
                            className="w-full py-2.5 rounded-xl bg-[#EFE9DF] text-xs font-bold text-stone-900"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}

            {activeModal === 'area' && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                    >
                        <h3 className="text-base font-black text-stone-900 mb-1">エリアを選択</h3>
                        <p className="text-[11px] text-stone-400 font-medium mb-4">複数選択できます</p>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {AREA_OPTIONS.map((area) => {
                                const selected = draftFilters.areas.includes(area);
                                return (
                                    <button
                                        key={area}
                                        onClick={() => toggleDraftArea(area)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                                            selected
                                                ? 'bg-stone-900 border-stone-900 text-white'
                                                : 'bg-white border-[#F0EAE0] text-stone-700'
                                        }`}
                                    >
                                        {area}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={clearDraftAreas}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                            >
                                クリア
                            </button>
                            <button
                                onClick={applyAreaModal}
                                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-xs font-bold text-white"
                            >
                                適用する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'genre' && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                    >
                        <h3 className="text-base font-black text-stone-900 mb-4">ジャンルを選択</h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {GENRE_OPTIONS.map((genre) => {
                                const selected = filters.genre === genre;
                                return (
                                    <button
                                        key={genre}
                                        onClick={() => selectGenre(genre)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                                            selected
                                                ? 'bg-stone-900 border-stone-900 text-white'
                                                : 'bg-white border-[#F0EAE0] text-stone-700'
                                        }`}
                                    >
                                        {genre}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={closeModal}
                            className="w-full mt-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}

            {activeModal === 'budget' && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                    >
                        <h3 className="text-base font-black text-stone-900 mb-4">予算を選択</h3>
                        <div className="flex flex-col gap-2 mb-2">
                            {BUDGET_OPTIONS.map((budget) => {
                                const selected = filters.priceLevel === budget.value;
                                return (
                                    <button
                                        key={budget.value}
                                        onClick={() => selectBudget(budget.value)}
                                        className={`w-full py-3 rounded-xl text-xs font-bold border-2 transition active:scale-95 ${
                                            selected
                                                ? 'bg-stone-900 border-stone-900 text-white'
                                                : 'bg-white border-[#F0EAE0] text-stone-700'
                                        }`}
                                    >
                                        {budget.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={closeModal}
                            className="w-full mt-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}

            {activeModal === 'all' && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
                    >
                        <h3 className="text-base font-black text-stone-900 mb-5">絞り込み条件</h3>

                        <div className="mb-6">
                            <p className="text-xs font-bold text-stone-500 mb-2">エリア（複数選択可）</p>
                            <div className="flex flex-wrap gap-2">
                                {AREA_OPTIONS.map((area) => {
                                    const selected = draftFilters.areas.includes(area);
                                    return (
                                        <button
                                            key={area}
                                            onClick={() => toggleDraftArea(area)}
                                            className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                                                selected
                                                    ? 'bg-stone-900 border-stone-900 text-white'
                                                    : 'bg-white border-[#F0EAE0] text-stone-700'
                                            }`}
                                        >
                                            {area}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-xs font-bold text-stone-500 mb-2">ジャンル</p>
                            <div className="flex flex-wrap gap-2">
                                {GENRE_OPTIONS.map((genre) => {
                                    const selected = draftFilters.genre === genre;
                                    return (
                                        <button
                                            key={genre}
                                            onClick={() => selectDraftGenre(genre)}
                                            className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                                                selected
                                                    ? 'bg-stone-900 border-stone-900 text-white'
                                                    : 'bg-white border-[#F0EAE0] text-stone-700'
                                            }`}
                                        >
                                            {genre}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-xs font-bold text-stone-500 mb-2">予算</p>
                            <div className="flex flex-col gap-2">
                                {BUDGET_OPTIONS.map((budget) => {
                                    const selected = draftFilters.priceLevel === budget.value;
                                    return (
                                        <button
                                            key={budget.value}
                                            onClick={() => selectDraftBudget(budget.value)}
                                            className={`w-full py-3 rounded-xl text-xs font-bold border-2 transition active:scale-95 ${
                                                selected
                                                    ? 'bg-stone-900 border-stone-900 text-white'
                                                    : 'bg-white border-[#F0EAE0] text-stone-700'
                                            }`}
                                        >
                                            {budget.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={clearAllDraft}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                            >
                                すべてクリア
                            </button>
                            <button
                                onClick={applyAllModal}
                                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-xs font-bold text-white"
                            >
                                適用する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}