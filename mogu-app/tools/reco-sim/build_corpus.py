"""シミュレーション用の店舗データを作る。
- 実在: 渋谷の100件（import_part*.json）を、アプリの restaurants テーブルと同じ形に変換
- 架空: 実在データに無いジャンル・価格帯（カフェ、ラーメン、定食、焼肉、立ち飲み等）を補うテスト用店舗
"""
import json, glob, random

PRICE_MAP = {'〜¥4,000': 3, '〜¥8,000': 4, '¥8,000〜': 4}

real = []
for f in sorted(glob.glob('import_part*.json')):  # 渋谷の実店舗100件の取り込みデータ
    for i, r in enumerate(json.load(open(f))):
        real.append({
            'id': f"real-{len(real)+1:03d}",
            'name': r['name'],
            'genre': r['genre'],
            'area': r['area'],
            'price_level': PRICE_MAP.get(r['price']),  # 不明は None
            'rating': r['rating'],
            'user_ratings_total': r['review_count'],
            'synthetic': False,
        })

# 架空店舗: (ジャンル, 店名の雰囲気, 価格帯, 評価, 口コミ数) の組み合わせ
rng = random.Random(42)
ARCHETYPES = [
    ('カフェ', ['おしゃれカフェ', 'テラスカフェ', 'ルーフトップカフェ', '純喫茶', 'ブックカフェ', 'ベーカリーカフェ'], 2, (3.6, 4.3), (40, 900)),
    ('スイーツ', ['パフェ専門店', 'フルーツサンド', 'パンケーキ'], 2, (3.7, 4.4), (80, 1500)),
    ('ラーメン', ['ラーメン', 'つけ麺', '家系ラーメン', '鶏白湯ラーメン'], 1, (3.5, 4.4), (150, 2500)),
    ('定食', ['定食屋', '食堂', '牛丼チェーン'], 1, (3.3, 4.0), (100, 1200)),
    ('焼肉', ['焼肉', '和牛焼肉', 'ホルモン'], 3, (3.6, 4.5), (60, 1100)),
    ('エスニック', ['タイ料理', 'スパイスカレー', 'ベトナム料理', 'ネパール料理'], 2, (3.6, 4.4), (15, 400)),
    ('居酒屋', ['大衆居酒屋', '立ち飲み', '海鮮居酒屋'], 2, (3.3, 4.1), (50, 900)),
    ('寿司', ['回転寿司', '立ち食い寿司'], 2, (3.5, 4.2), (200, 2000)),
    ('バー', ['ルーフトップバー', '夜景ラウンジ'], 4, (3.8, 4.5), (30, 500)),
    ('フレンチ', ['夜景フレンチ', 'ガストロノミー'], 4, (4.2, 4.8), (20, 300)),
    ('中華', ['町中華', '小籠包'], 2, (3.5, 4.3), (60, 900)),
    ('ハンバーガー', ['グルメバーガー'], 2, (3.7, 4.3), (80, 800)),
]
synthetic = []
for genre, names, level, (rlo, rhi), (vlo, vhi) in ARCHETYPES:
    for n in names:
        lv = max(1, min(4, level + rng.choice([-1, 0, 0, 0, 1])))
        synthetic.append({
            'id': f"syn-{len(synthetic)+1:03d}",
            'name': f"［テスト］渋谷 {n}",
            'genre': genre,
            'area': '渋谷駅周辺',
            'price_level': lv,
            'rating': round(rng.uniform(rlo, rhi), 1),
            'user_ratings_total': int(rng.uniform(vlo, vhi)),
            'synthetic': True,
        })

corpus = real + synthetic
json.dump(corpus, open('corpus.json', 'w'), ensure_ascii=False, indent=1)
print(len(real), 'real +', len(synthetic), 'synthetic =', len(corpus))
