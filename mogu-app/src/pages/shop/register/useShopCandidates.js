import { useEffect, useRef, useState } from 'react';
import { canSearch, searchShopsByName, shopNameError } from '../../../lib/shops';

// ⑰-2「このお店ですか？」の候補を読む
//   ・2文字から。名前の近い順に最大3件（東京全体）
//   ・「どれでもない」を押したあとは聞かない
//   ・名前を変えたら、もう一度聞く（checked は親が「確かめた名前」と today の名前を
//     くらべて決めるので、ここでは何も消さない）
export default function useShopCandidates(name, checked) {
  // 読んだ結果は、どの名前のものかを一緒に持つ（古い結果を見せないため）
  const [result, setResult] = useState({ q: null, rows: [], failed: false });
  const timer = useRef(null);
  const seq = useRef(0);

  const trimmed = String(name ?? '').trim();
  const error = shopNameError(name);
  const shouldSearch = !checked && canSearch(trimmed) && !error;

  useEffect(() => {
    clearTimeout(timer.current);
    if (!shouldSearch) return undefined;
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const rows = await searchShopsByName(trimmed, 3);
        if (seq.current === mine) setResult({ q: trimmed, rows, failed: false });
      } catch {
        if (seq.current === mine) setResult({ q: trimmed, rows: [], failed: true });
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [trimmed, shouldSearch]);

  const fresh = shouldSearch && result.q === trimmed;
  const candidates = fresh ? result.rows : [];
  const failed = fresh && result.failed;
  const searching = shouldSearch && !fresh;

  // 候補を見せているあいだは［次へ］を押せない
  const asking = shouldSearch && (searching || candidates.length > 0);

  return {
    candidates,
    searching,
    failed,
    asking,
    error,
    canGoNext: trimmed.length > 0 && !error && !asking && !failed,
  };
}
