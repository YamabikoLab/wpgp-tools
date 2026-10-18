/**
 * Waiting 提案を翻訳 ID ごとに表示し、既存の Warning 判定を適用する。
 * 画面は元の翻訳データを変更せず、タブ単位で受け取った一時データだけを扱う。
 */
( () => {
	'use strict';
	const status = document.getElementById( 'waiting-status' );
	const results = document.getElementById( 'waiting-results' );
	/** @param {string} tag 要素名。 @param {string} value 表示内容。 @returns {HTMLElement} 文字列として扱う要素。 */
	const element = ( tag, value = '' ) => {
		const node = document.createElement( tag );
		node.textContent = String( value );
		return node;
	};
	/** @param {string} src 読み込む既存スクリプト。 @returns {Promise<void>} 読み込み完了。 */
	const loadChecks = ( src ) => new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = src;
		script.onload = resolve;
		script.onerror = () => reject( new Error( '既存の判定機能を読み込めませんでした。' ) );
		document.head.append( script );
	} );
	/** @param {Object} data 元画面から渡された比較対象。 @returns {Promise<void>} 判定結果の描画完了。 */
	async function render( data ) {
		if ( ! data || ! Array.isArray( data.proposals ) || ! Array.isArray( data.settings ) ) {
			throw new Error( '受け取ったデータが不正です。' );
		}
		// 判定の開始前に元の翻訳ページと同じ設定を確定する。
		for ( const [ key, value ] of data.settings ) {
			if ( ! Object.hasOwn( wpgpt_settings, key ) || typeof value !== 'string' ) {
				throw new Error( '設定情報が不正です。' );
			}
			wpgpt_settings[ key ].state = value;
		}
		await loadChecks( 'js/wpgpt-checks.js' );
		// 拡張機能内ページの URL からはロケールを判断できないため、元画面の言語を用いる。
		wpgpt_is_japanese_locale = () => data.locale === 'ja';
		results.append( element( 'p', '翻訳者条件: ' + ( data.login || 'すべての翻訳者' ) ) );
		const source = element( 'section' );
		source.className = 'waiting-source';
		source.append( element( 'h2', '原文' ), element( 'pre', data.original ) );
		source.append( element( 'p', 'Context: ' + ( data.context || 'なし' ) ) );
		results.append( source );
		// 取得対象が少ない場合でも、API のページングによって全件と保証できないことを明示する。
		const note = element( 'p', '取得結果: ' + data.proposals.length + '件。API のページングにより全提案が含まれない可能性があります。' );
		note.className = 'waiting-note';
		results.append( note );
		// 取得順と翻訳 ID を維持し、別々の Waiting 提案をまとめない。
		data.proposals.forEach( ( proposal ) => {
			const card = element( 'article' );
			card.className = 'waiting-card';
			card.append( element( 'h2', '翻訳 ID: ' + proposal.id ) );
			card.append( element( 'p', '提案者: ' + ( proposal.user?.user_login || '取得不可' ) ) );
			if ( ! Array.isArray( proposal.translations ) || ! proposal.translations.length ) {
				card.append( element( 'p', '訳文がありません。' ) );
			} else {
				// 複数形の訳文フォームも、それぞれ対応する原文との判定結果を個別表示する。
				proposal.translations.forEach( ( translation, index ) => {
					if ( typeof translation !== 'string' ) return;
					const original = index === 0 ? data.original : ( proposal.plural || data.original );
					const checks = wpgpt_run_checks( original, translation, false, data.original );
					card.append( element( 'h3', '訳文 ' + ( index + 1 ) ), element( 'pre', translation ) );
					card.append( element( 'p', 'Warning ' + checks.warning.length + '件 / Notice ' + checks.notice.length + '件' ) );
					const list = element( 'ul' );
					checks.warning.forEach( ( warning ) => list.append( element( 'li', 'Warning: ' + warning.textContent ) ) );
					checks.notice.forEach( ( notice ) => list.append( element( 'li', 'Notice: ' + notice.textContent ) ) );
					card.append( list );
				} );
			}
			results.append( card );
		} );
		status.textContent = '読み取り専用の比較結果を表示しています。';
	}
	chrome.runtime.sendMessage( { type: 'wpgpt-waiting-proposals-ready' }, async ( response ) => {
		try {
			const error = chrome.runtime.lastError?.message || response?.error;
			if ( error ) throw new Error( error );
			await render( response?.payload );
		} catch ( error ) {
			results.replaceChildren();
			status.textContent = '個別確認を表示できません: ' + error.message + ' 元の翻訳ページから開き直してください。';
		}
	} );
} )();
