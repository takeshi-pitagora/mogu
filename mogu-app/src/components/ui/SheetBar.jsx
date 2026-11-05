import { color, font } from '../../theme/tokens';

// シートの上の段（確定版 Final-08・Final-09 の「並べ替え」「グループに送る」）
//   左に［キャンセル］（15・500）、まん中に見出し（Dela 18）、右に黒い［適用］［送る］（高さ44・角丸22・15・700）
//   シートの左右の余白20の内側で、左右に8はみ出す
export default function SheetBar({ title, onCancel, actionLabel, onAction, actionDisabled = false, cancelLabel = 'キャンセル' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px', flex: 'none' }}>
      <button type="button" className="ui-btn ui-btn--text" onClick={onCancel} style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
        {cancelLabel}
      </button>
      <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400, whiteSpace: 'nowrap' }}>{title}</h2>
      {actionLabel ? (
        <button
          type="button"
          className="ui-btn ui-btn--bar"
          onClick={onAction}
          disabled={actionDisabled}
          style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: actionDisabled ? color.surface : color.ink, color: actionDisabled ? color.sub : color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
        >
          {actionLabel}
        </button>
      ) : (
        <span style={{ width: 60 }} />
      )}
    </div>
  );
}
