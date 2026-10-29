import React from 'react';

function openExternalLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function LinkButton({ href, label }) {
    return (
        <button
            type="button"
            onClick={() => openExternalLink(href)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-[#E9E2D6] bg-white active:scale-[0.98] active:bg-stone-50 transition"
        >
            <span className="text-sm font-bold text-stone-800">{label}</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.5 4.5 13 10l-5.5 5.5" />
            </svg>
        </button>
    );
}

// お店の詳細（保存一覧からタップで開く）
// 上: 写真いっぱいに、ジャンル・エリア・店名・評価を重ねる / 下: 外部サービスへのリンク
export default function RestaurantDetailModal({ restaurant, onClose }) {
    if (!restaurant) return null;

    const {
        name,
        area,
        genre,
        address,
        rating,
        user_ratings_total: userRatingsTotal,
        photo_food: photoFood,
        photo_interior: photoInterior,
        photo_exterior: photoExterior,
    } = restaurant;

    const mainPhoto =
        photoFood || photoInterior || photoExterior ||
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1';

    const googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + (address || ''));
    const tabelogUrl = 'https://tabelog.com/rst/rstlst/?vs=1&sa=&sk=' + encodeURIComponent(name);
    const hotpepperUrl = 'https://www.hotpepper.jp/gstr00000/?keyword=' + encodeURIComponent(name);

    const ratingValue = Number(rating);
    const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={onClose}
            style={{ paddingTop: 'calc(var(--safe-top) + 2.5rem)' }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm h-full sm:h-auto sm:max-h-[90vh] bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
                {/* 写真＋店名（写真の上に重ねる） */}
                <div className="relative flex-none h-[58%] min-h-[300px] max-h-[460px] bg-stone-200">
                    <img src={mainPhoto} alt={name} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/95 flex items-center justify-center text-stone-800 shadow-md active:scale-95 transition"
                        aria-label="閉じる"
                    >
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                            <path d="M5 5l10 10M15 5 5 15" />
                        </svg>
                    </button>

                    <div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white">
                        {(genre || area) && (
                            <div className="flex flex-wrap gap-2 mb-2.5">
                                {[genre, area].filter(Boolean).map((t) => (
                                    <span key={t} className="text-[11px] font-bold bg-white/25 backdrop-blur-md px-3 py-1 rounded-full">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}
                        <h2 className="text-2xl font-black leading-tight mb-1.5 drop-shadow-sm">{name}</h2>
                        {hasRating && (
                            <p className="flex items-center gap-1.5">
                                <span className="text-amber-400 text-lg leading-none" aria-hidden="true">★</span>
                                <span className="text-xl font-black">{ratingValue.toFixed(1)}</span>
                                {userRatingsTotal ? (
                                    <span className="text-xs font-medium opacity-85">({Number(userRatingsTotal).toLocaleString()})</span>
                                ) : null}
                            </p>
                        )}
                    </div>
                </div>

                {/* リンク */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 flex flex-col">
                    <p className="text-xs font-bold text-stone-500 mb-2.5">予約・詳細はこちら</p>
                    <div className="space-y-2.5">
                        <LinkButton href={googleMapsUrl} label="Googleマップで経路を確認" />
                        <LinkButton href={tabelogUrl} label="食べログでメニューを見る" />
                        <LinkButton href={hotpepperUrl} label="ホットペッパーで予約する" />
                    </div>
                    <p
                        className="mt-auto pt-6 text-[11px] text-stone-400 font-medium text-center"
                        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
                    >
                        店舗情報・写真提供: Google
                    </p>
                </div>
            </div>
        </div>
    );
}
