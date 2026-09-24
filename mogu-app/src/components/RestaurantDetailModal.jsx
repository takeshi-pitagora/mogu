import React from 'react';

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

    function openExternalLink(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function LinkButton(props) {
        return (
            <button
                type="button"
                onClick={function () { openExternalLink(props.href); }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-[#F0EAE0] bg-white active:scale-[0.98] transition"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-stone-800">
                    <span className="text-lg">{props.emoji}</span>
                    <span>{props.label}</span>
                </span>
                <span className="text-stone-300 text-lg font-bold">＞</span>
            </button>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            <div
                onClick={function (e) { e.stopPropagation(); }}
                className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="relative">
                    <img
                        src={mainPhoto}
                        alt={name}
                        className="w-full h-56 object-cover rounded-t-3xl sm:rounded-t-3xl"
                    />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-stone-700 font-bold shadow-md active:scale-95 transition"
                        aria-label="閉じる"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    <h2 className="text-xl font-black text-stone-900 mb-1">{name}</h2>
                    <p className="text-xs text-stone-400 font-bold mb-4">
                        {[genre, area].filter(Boolean).join('・')}
                    </p>

                    <div className="bg-[#F0EAE0] rounded-2xl p-4 mb-6 space-y-3">
                        <div className="flex items-start gap-2">
                            <span className="text-sm">📍</span>
                            <div>
                                <p className="text-[10px] text-stone-400 font-bold mb-0.5">アクセス</p>
                                <p className="text-xs text-black font-medium">
                                    {address || '住所情報がありません'}
                                </p>
                            </div>
                        </div>
                        <div className="h-px bg-stone-700" />
                        <div className="flex items-start gap-2">
                            <span className="text-sm">⭐</span>
                            <div>
                                <p className="text-[10px] text-stone-400 font-bold mb-0.5">評価</p>
                                <p className="text-xs text-black font-medium">
                                    {rating ? rating.toFixed(1) : '---'}
                                    {userRatingsTotal ? '（' + userRatingsTotal + '件）' : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs font-bold text-stone-500 mb-2">予約・詳細はこちら</p>
                    <div className="space-y-2">
                        <LinkButton href={googleMapsUrl} emoji="🗺️" label="Googleマップで経路を確認" />
                        <LinkButton href={tabelogUrl} emoji="🍜" label="食べログでメニューを見る" />
                        <LinkButton href={hotpepperUrl} emoji="📅" label="ホットペッパーで予約する" />
                    </div>
                </div>
            </div>
        </div>
    );
}