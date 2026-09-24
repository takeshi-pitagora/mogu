import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import RestaurantDetailModal from '../components/RestaurantDetailModal';

const BUDGET_OPTIONS = [
    { value: '1', label: '〜￥1,000' },
    { value: '2', label: '￥1,000〜￥3,000' },
    { value: '3', label: '￥3,000〜￥5,000' },
    { value: '4', label: '￥5,000〜' },
];

export default function SavedScreen() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [savedShops, setSavedShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [areaFilter, setAreaFilter] = useState('');
    const [genreFilter, setGenreFilter] = useState('');
    const [budgetFilter, setBudgetFilter] = useState('');

    // モーダル管理: null | 'area' | 'genre' | 'budget'
    const [activeModal, setActiveModal] = useState(null);
    // 詳細モーダル用：選択中の店舗
    const [selectedShop, setSelectedShop] = useState(null);
    const closeModal = () => setActiveModal(null);

    // price_level (0〜4) を表示用の文字列に変換
    const formatPriceLevel = (level) => {
        const priceMap = {
            0: '無料',
            1: '〜￥1,000',
            2: '￥1,000〜￥3,000',
            3: '￥3,000〜￥5,000',
            4: '￥5,000〜',
        };
        return priceMap[level] || '価格情報なし';
    };

    useEffect(() => {
        async function fetchShops() {
            if (!user?.id) return;
            try {
                setLoading(true);

                // 自分が「like」した店舗（swipes経由）
                const { data: likedRows, error: likedError } = await supabase
                    .from('swipes')
                    .select('restaurant_id, restaurants(*)')
                    .eq('user_id', user.id)
                    .eq('action', 'like');
                if (likedError) throw likedError;

                // グループでマッチして保存された店舗（saved_restaurants経由）
                const { data: savedRows, error: savedError } = await supabase
                    .from('saved_restaurants')
                    .select('restaurant_id, restaurants(*)')
                    .eq('user_id', user.id);
                if (savedError) throw savedError;

                // 重複を除いて1つのリストにまとめる
                const merged = new Map();
                [...(likedRows || []), ...(savedRows || [])].forEach((row) => {
                    if (row.restaurants) merged.set(row.restaurant_id, row.restaurants);
                });

                setSavedShops(Array.from(merged.values()).filter((r) => !r.is_excluded));
            } catch (err) {
                console.error('データ取得エラー:', err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchShops();
    }, [user?.id]);

    // 実際に保存されているデータからフィルターの選択肢を動的に作成
    const areaOptions = useMemo(
        () => Array.from(new Set(savedShops.map((s) => s.area).filter(Boolean))),
        [savedShops]
    );
    const genreOptions = useMemo(
        () => Array.from(new Set(savedShops.map((s) => s.genre).filter(Boolean))),
        [savedShops]
    );

    const filteredShops = savedShops.filter((shop) => {
        const matchesQuery = searchQuery.trim()
            ? `${shop.name} ${shop.genre} ${shop.area}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
            : true;
        const matchesArea = areaFilter ? shop.area === areaFilter : true;
        const matchesGenre = genreFilter ? shop.genre === genreFilter : true;
        const matchesBudget = budgetFilter ? String(shop.price_level) === budgetFilter : true;
        return matchesQuery && matchesArea && matchesGenre && matchesBudget;
    });

    const selectArea = (area) => {
        setAreaFilter((prev) => (prev === area ? '' : area));
        setActiveModal(null);
    };
    const selectGenre = (genre) => {
        setGenreFilter((prev) => (prev === genre ? '' : genre));
        setActiveModal(null);
    };
    const selectBudget = (value) => {
        setBudgetFilter((prev) => (prev === value ? '' : value));
        setActiveModal(null);
    };

    const budgetLabel = (value) => BUDGET_OPTIONS.find((b) => b.value === value)?.label || '';

    // HomeScreenと同じ見た目：未選択時は「ラベル ▼」、選択時は「値 ✕」の1つのピルに切り替える
    const FilterChip = ({ label, value, displayValue, onOpen, onClear }) => {
        if (!value) {
            return (
                <button
                    onClick={onOpen}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-full border border-[#F0EAE0] bg-white text-stone-800 text-xs font-bold active:scale-95 transition flex-shrink-0"
                >
                    <span>{label}</span>
                    <span className="text-[10px] text-[#F0EAE0]">▼</span>
                </button>
            );
        }
        return (
            <span className="flex items-center gap-1.5 pl-4 pr-2 py-1.5 rounded-full bg-[#EFE9DF] text-stone-800 text-xs font-bold flex-shrink-0">
                <button onClick={onOpen} className="active:opacity-70">
                    {displayValue}
                </button>
                <button
                    onClick={onClear}
                    className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[10px] active:scale-90 transition"
                    aria-label={`${label}を解除`}
                >
                    ✕
                </button>
            </span>
        );
    };

    return (
        <div className="flex-1 flex flex-col px-5 py-4 bg-white select-none">
        {/* 検索バー ＋ 追加ボタン エリア */}
        <section className="flex items-center gap-3 mb-4">
            {/* プラスボタン */}
            <button className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center text-stone-700 text-2xl font-light active:scale-95 transition flex-shrink-0">
            ＋
            </button>

            {/* 検索インプット */}
            <div className="flex-1 relative flex items-center">
            <input
                type="text"
                placeholder="キーワードを検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-5 pr-12 rounded-full border border-[#F0EAE0] bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400"
            />
            <div className="absolute right-4 pointer-events-none text-stone-300">
                <Icon name="group_gray" className="w-6 h-6 opacity-40" alt="検索" />
            </div>
            </div>
        </section>

        {/* フィルターバー（HomeScreenと同じピル形式） */}
        <section className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button className="p-1 text-stone-300 flex-shrink-0 active:scale-95 transition">
                <Icon name="filter" className="w-5 h-5" alt="フィルター設定" />
            </button>

            <FilterChip
                label="エリア"
                value={areaFilter}
                displayValue={areaFilter}
                onOpen={() => setActiveModal('area')}
                onClear={() => setAreaFilter('')}
            />
            <FilterChip
                label="ジャンル"
                value={genreFilter}
                displayValue={genreFilter}
                onOpen={() => setActiveModal('genre')}
                onClear={() => setGenreFilter('')}
            />
            <FilterChip
                label="予算"
                value={budgetFilter}
                displayValue={budgetLabel(budgetFilter)}
                onOpen={() => setActiveModal('budget')}
                onClear={() => setBudgetFilter('')}
            />
        </section>

        {/* 保存したお店 見出し */}
        <h2 className="text-sm font-bold text-stone-900 mt-5 mb-3">
            保存したお店（{filteredShops.length}）
        </h2>

        {loading ? (
            <div className="py-12 text-center text-xs text-stone-400 font-bold">読み込み中...</div>
        ) : filteredShops.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400 font-bold">
                条件に一致するお店がありません。
            </div>
        ) : (
            <div className="space-y-3">
                {filteredShops.map((shop) => (
                <div
                    key={shop.id}
                    onClick={() => setSelectedShop(shop)}
                    className="flex items-center justify-between p-3.5 rounded-3xl border border-[#F0EAE0] bg-white active:scale-[0.99] transition cursor-pointer"
                >
                    {/* 左側：店舗画像 ＋ テキスト情報 */}
                    <div className="flex items-center gap-3.5 min-w-0">
                    <img
                        src={shop.photo_food || shop.photo_exterior || shop.photo_interior || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1'}
                        alt={shop.name}
                        className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 bg-stone-100"
                    />

                    <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-stone-900 truncate">
                            {shop.name}
                        </h3>
                        <span className="text-[9px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                            {shop.area}
                        </span>
                        </div>

                        <p className="text-[11px] text-stone-700 font-bold mt-0.5">
                        {shop.genre}
                        </p>
                        <p className="text-[10px] text-stone-400 font-medium">
                        {formatPriceLevel(shop.price_level)}
                        </p>
                    </div>
                    </div>

                    {/* 右側：矢印アイコン */}
                    <div className="text-stone-300 pl-2">
                    <span className="text-lg font-bold text-[#F0EAE0]">＞</span>
                    </div>
                </div>
                ))}
            </div>
        )}

        {/* エリア選択モーダル */}
        {activeModal === 'area' && (
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                onClick={closeModal}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                >
                    <h3 className="text-base font-black text-stone-900 mb-4">エリアを選択</h3>
                    {areaOptions.length === 0 ? (
                        <p className="text-xs text-stone-400 font-medium mb-2">保存したお店にエリア情報がありません。</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {areaOptions.map((area) => {
                                const selected = areaFilter === area;
                                return (
                                    <button
                                        key={area}
                                        onClick={() => selectArea(area)}
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
                    )}
                    <button
                        onClick={closeModal}
                        className="w-full mt-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        )}

        {/* ジャンル選択モーダル */}
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
                    {genreOptions.length === 0 ? (
                        <p className="text-xs text-stone-400 font-medium mb-2">保存したお店にジャンル情報がありません。</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {genreOptions.map((genre) => {
                                const selected = genreFilter === genre;
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
                    )}
                    <button
                        onClick={closeModal}
                        className="w-full mt-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        )}

        {/* 予算選択モーダル */}
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
                            const selected = budgetFilter === budget.value;
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

        {/* 店舗詳細モーダル */}
        <RestaurantDetailModal restaurant={selectedShop} onClose={() => setSelectedShop(null)} />
        </div>
    );
}