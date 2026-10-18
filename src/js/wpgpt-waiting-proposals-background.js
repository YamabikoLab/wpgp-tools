/**
 * Waiting の個別確認結果を、一度だけ新しい専用タブへ中継する。
 * 結果はメモリ内にのみ保持し、専用タブが受領した時点で破棄する。
 */
const wpgptWaitingPending = new Map();

chrome.runtime.onMessage.addListener( ( message, sender, sendResponse ) => {
	if ( ! message || typeof message.type !== 'string' ) return false;
	if ( message.type === 'wpgpt-waiting-proposals-open' ) {
		// 翻訳サイトの content script 以外から起動要求を受け取らない。
		if ( ! sender.tab?.id || ! /^https:\/\/translate\.wordpress\.org\/projects\//u.test( sender.url || '' ) ) {
			sendResponse( { error: '翻訳ページ以外からの要求は受け付けません。' } );
			return false;
		}
		const data = message.payload;
		if ( ! data || typeof data.original !== 'string' || ! Array.isArray( data.proposals ) ||
			data.proposals.length > 200 || data.original.length > 20000 ||
			typeof data.setUrl !== 'string' || ! /^https:\/\/translate\.wordpress\.org\/projects\//u.test( data.setUrl ) ) {
			sendResponse( { error: '個別確認データが不正です。' } );
			return false;
		}
		chrome.tabs.create( { url: chrome.runtime.getURL( 'wpgpt-waiting-proposals.html' ) }, ( tab ) => {
			const error = chrome.runtime.lastError?.message;
			if ( error || ! tab?.id ) {
				sendResponse( { error: error || '専用タブを開けませんでした。' } );
				return;
			}
			wpgptWaitingPending.set( tab.id, data );
			sendResponse( { success: true } );
		} );
		return true;
	}
	if ( message.type === 'wpgpt-waiting-proposals-ready' ) {
		// 起動対象の拡張機能ページからの一度限りの要求だけを許可する。
		if ( sender.id !== chrome.runtime.id || ! sender.tab?.id ||
			sender.url !== chrome.runtime.getURL( 'wpgpt-waiting-proposals.html' ) ) {
			sendResponse( { error: '受信元が不正です。' } );
			return false;
		}
		const data = wpgptWaitingPending.get( sender.tab.id );
		wpgptWaitingPending.delete( sender.tab.id );
		sendResponse( data ? { payload: data } : { error: '一時データがありません。元の翻訳ページから再度開いてください。' } );
		return false;
	}
	return false;
} );
chrome.tabs.onRemoved.addListener( ( tabId ) => wpgptWaitingPending.delete( tabId ) );
