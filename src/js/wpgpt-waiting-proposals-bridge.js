/**
 * 翻訳ページの個別確認操作を、拡張機能の専用タブへ一度だけ渡す境界。
 * ページ側の通信権限を増やさず、翻訳サイト以外の要求を受け付けない。
 */
( () => {
	'use strict';
	if ( location.origin !== 'https://translate.wordpress.org' ) return;
	document.addEventListener( 'wpgpt-waiting-proposals-open', ( event ) => {
		if ( ! event.detail || event.detail.kind !== 'wpgpt-waiting-proposals-v1' ) return;
		chrome.runtime.sendMessage( {
			type: 'wpgpt-waiting-proposals-open',
			payload: event.detail.payload,
		}, ( response ) => {
			// 起動に失敗した場合は元画面に理由を通知し、成功を推測しない。
			const error = chrome.runtime.lastError?.message || response?.error;
			document.dispatchEvent( new CustomEvent( 'wpgpt-waiting-proposals-open-result', {
				detail: { error: error || '' },
			} ) );
		} );
	} );
} )();
