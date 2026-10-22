/**
 * Speech Recognition Subtitles 用の翻訳ウェブアプリ（Google Apps Script）
 *
 * GET ?text=翻訳する文&source=元の言語&target=翻訳先の言語
 * → 翻訳結果をプレーンテキストで返す（失敗時は空文字）
 *
 * 公開方法は README の「自分の GAS を用意する」を参照。
 */

const MAX_TEXT_LENGTH = 2000;

function doGet(e) {
  const params = (e && e.parameter) || {};
  const text = String(params.text || '').slice(0, MAX_TEXT_LENGTH);
  const source = String(params.source || ''); // 空なら自動判定
  const target = String(params.target || '');

  let result = '';
  if (text && target) {
    try {
      result = LanguageApp.translate(text, source, target);
    } catch (err) {
      console.error(err);
    }
  }
  return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
}
