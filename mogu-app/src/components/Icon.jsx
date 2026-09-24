import React from 'react';

/**
 * 共通アイコンコンポーネント
 * @param {string} name - public/icons/ 配下のファイル名（拡張子なし）
 * @param {string} ext - 拡張子（省略時は 'svg'。pngやwebpの場合は 'png' を指定）
 * @param {string} className - Tailwind CSS などのクラス名（サイズや余白など）
 * @param {string} alt - 代替テキスト（省略時はアイコン名）
 */
export default function Icon({
  name,
  ext = 'png',
  className = 'w-6 h-6',
  alt,
  ...props
}) {
  return (
    <img
      src={`/icons/${name}.${ext}`}
      alt={alt || `${name} icon`}
      className={`inline-block object-contain select-none ${className}`}
      {...props}
    />
  );
}