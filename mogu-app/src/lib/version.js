// アプリのバージョン（ビルドのときに iOS の MARKETING_VERSION から入る。vite.config.js）
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
