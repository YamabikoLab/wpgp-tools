/**
 * Issue #34 の読み取り専用 PoC。
 *
 * 実際の翻訳セット画面で、全翻訳者の Waiting API を最大2ページだけ調べる。
 * 利用者が開始ボタンを押すまで通信せず、ページを越える識別・応答形式・停止理由を観測する。
 * 取得結果は元タブのメモリに限り、保存・変更・自動再試行はしない。
 */
( () => {
	'use strict';

	const MAX_PAGES = 2;
	const SCRIPT_ID = 'wpgpt-multiple-waiting-poc';
	const oldPanel = document.getElementById( SCRIPT_ID );
	if ( oldPanel ) {
		oldPanel.scrollIntoView();
		console.info( 'PoC はすでに表示されています。既存の画面から操作してください。' );
		return;
	}

	const locationUrl = new URL( window.location.href );
	// 許可対象を WordPress.org の日本語翻訳セットに限定する。
	if ( locationUrl.origin !== 'https://translate.wordpress.org' ||
		! /^\/projects\/(?:[a-z0-9_.-]+\/)+ja\/default\/?$/iu.test( locationUrl.pathname ) ) {
		console.error( '日本語翻訳セットの GlotPress 画面で実行してください。' );
		return;
	}
	const root = document.createElement( 'section' );
	root.id = SCRIPT_ID;
	root.style.cssText = 'position:relative;z-index:20;margin:16px;padding:16px;border:2px solid #2563eb;background:#fff;color:#111;font:14px/1.6 sans-serif;max-width:960px';
	const title = document.createElement( 'h2' );
	title.textContent = 'Issue #34 Waiting API PoC（最大2ページ・読み取り専用）';
	const start = document.createElement( 'button' );
	start.textContent = '2ページ以内で取得開始';
	const stop = document.createElement( 'button' );
	stop.textContent = '中止';
	stop.disabled = true;
	stop.style.marginLeft = '8px';
	const output = document.createElement( 'pre' );
	output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:12px;max-height:460px;overflow:auto';
	output.textContent = '未開始。取得時には全翻訳者の Waiting を確認します。既存画面のフィルターは使用しません。';
	root.append( title, start, stop, output );
	document.body.prepend( root );

	let controller = null;
	let running = false;
	const lines = [];
	/** @param {string} message 利用者に表示する通信・検証記録。 */
	function log( message ) {
		lines.push( message );
		output.textContent = lines.join( '\n' );
	}

	/** @param {unknown} value 数値または文字列で返る原文・翻訳 ID。 */
	function numericId( value ) {
		return /^(?:[1-9][0-9]*)$/u.test( String( value ) ) ? String( value ) : null;
	}

	/**
	 * 応答の識別可能な翻訳のみを検査する。
	 * 原文と訳文は画面やコンソールへ転載せず、型と識別情報だけを記録する。
	 * @param {unknown} payload API 応答。
	 * @param {Map<string, Map<string, string>>} groups 全取得ページ共通の提案集合。
	 * @returns {{count:number, details:Object}} 応答件数と項目の型一覧。
	 */
	function inspect( payload, groups ) {
		if ( ! Array.isArray( payload ) ) throw new Error( 'JSON の最上位が配列ではありません。' );
		const details = { id: {}, original_id: {}, status: {}, singular: {}, context: {},
			user: {}, plural: {}, translations: {} };
		for ( const row of payload ) {
			if ( ! row || typeof row !== 'object' || Array.isArray( row ) ) {
				throw new Error( '翻訳レコードがオブジェクトではありません。' );
			}
			for ( const key of Object.keys( details ) ) {
				const value = key === 'status' ? ( row.translation_status ?? row.status ) : row[ key ];
				const type = value === undefined ? 'missing' : value === null ? 'null' :
					Array.isArray( value ) ? 'array' : typeof value;
				details[ key ][ type ] = ( details[ key ][ type ] || 0 ) + 1;
			}
			const originalId = numericId( row.original_id );
			const translationId = numericId( row.id );
			if ( ! originalId || ! translationId ) throw new Error( '原文 ID または翻訳 ID が不正です。' );
			if ( ( row.translation_status ?? row.status ) !== 'waiting' ) {
				throw new Error( 'Waiting 以外のレコードが混入しています。' );
			}
			if ( typeof row.singular !== 'string' ||
				! Array.isArray( row.translations ) ||
				! row.translations.every( ( value ) => typeof value === 'string' ) ) {
				throw new Error( '原文・訳文の形式が不正です。' );
			}
			// 同じ翻訳 ID が再登場した場合、内容が一致するときだけ重複排除する。
			const comparable = JSON.stringify( {
				original_id: originalId, singular: row.singular, context: row.context ?? null,
				plural: row.plural ?? null, translations: row.translations,
				status: row.translation_status ?? row.status, user: row.user ?? null,
			} );
			if ( ! groups.has( originalId ) ) groups.set( originalId, new Map() );
			const proposals = groups.get( originalId );
			if ( proposals.has( translationId ) && proposals.get( translationId ) !== comparable ) {
				throw new Error( '同一翻訳 ID の内容がページ間で異なります。' );
			}
			proposals.set( translationId, comparable );
		}
		return { count: payload.length, details };
	}

	/**
	 * 一度に1件だけ同一オリジンへ GET する。
	 * @param {URL} url 対象セットの API URL。
	 * @param {AbortSignal} signal 中止通知。
	 * @returns {Promise<{payload:unknown, duration:number, headers:Object}>} 観測対象。
	 */
	async function getPage( url, signal ) {
		const begin = performance.now();
		const response = await fetch( url.href, {
			method: 'GET', credentials: 'same-origin', redirect: 'error', signal,
		} );
		const duration = Math.round( performance.now() - begin );
		const headers = {
			'content-type': response.headers.get( 'content-type' ),
			'retry-after': response.headers.get( 'retry-after' ),
			link: response.headers.get( 'link' ),
			'x-wp-total': response.headers.get( 'x-wp-total' ),
			'x-wp-totalpages': response.headers.get( 'x-wp-totalpages' ),
		};
		log( 'HTTP ' + response.status + ' / ' + duration + 'ms / ヘッダー: ' + JSON.stringify( headers ) );
		if ( ! response.ok ) throw new Error( 'HTTP ' + response.status + ' で停止（自動再試行なし）' );
		if ( ! /application\/json/iu.test( headers[ 'content-type' ] || '' ) ) {
			throw new Error( 'JSON 以外の Content-Type で停止' );
		}
		return { payload: await response.json(), duration, headers };
	}

	/** 指定ページ数の範囲だけ取得し、終了理由を常に表示する。 */
	async function run() {
		if ( running ) return;
		running = true;
		controller = new AbortController();
		start.disabled = true;
		stop.disabled = false;
		lines.length = 0;
		const groups = new Map();
		let pages = 0;
		let rows = 0;
		let outcome = '最大2ページ到達（終端・全件網羅は未確認）';
		const apiUrl = new URL( locationUrl.href );
		apiUrl.pathname = '/api' + apiUrl.pathname.replace( /\/$/u, '' ) + '/';
		apiUrl.search = '';
		apiUrl.hash = '';
		apiUrl.searchParams.set( 'filters[status]', 'waiting' );
		try {
			// 本 PoC は2ページを上限とし、レート制限の閾値を探索しない。
			for ( let page = 1; page <= MAX_PAGES; page++ ) {
				if ( controller.signal.aborted ) {
					outcome = '利用者による中止';
					break;
				}
				apiUrl.searchParams.set( 'page', String( page ) );
				log( 'ページ ' + page + ': ' + apiUrl.pathname + apiUrl.search );
				const response = await getPage( apiUrl, controller.signal );
				if ( controller.signal.aborted ) {
					outcome = '利用者による中止';
					break;
				}
				const inspected = inspect( response.payload, groups );
				pages++;
				rows += inspected.count;
				log( '取得 ' + inspected.count + ' 件、項目の型: ' + JSON.stringify( inspected.details ) );
				log( 'ページ横断で複数提案が確認された原文: ' +
					Array.from( groups.values() ).filter( ( proposals ) => proposals.size >= 2 ).length + ' 件' );
				// 空配列でも終端契約は未確認。最大2ページまでは観測を継続する。
				if ( page < MAX_PAGES ) {
					log( '次のページまで1秒間隔を空けます。' );
					await new Promise( ( resolve ) => {
						const timeout = setTimeout( resolve, 1000 );
						controller.signal.addEventListener( 'abort', () => {
							clearTimeout( timeout );
							resolve();
						}, { once: true } );
					} );
				}
			}
			if ( controller.signal.aborted ) outcome = '利用者による中止';
		} catch ( error ) {
			outcome = controller.signal.aborted ? '利用者による中止' :
				'エラー停止: ' + ( error?.message || String( error ) );
		} finally {
			log( '終了: ' + outcome );
			log( '成功ページ数=' + pages + ' / 取得レコード数=' + rows +
				' / 複数 Waiting 原文数（取得範囲のみ）=' +
				Array.from( groups.values() ).filter( ( proposals ) => proposals.size >= 2 ).length );
			log( '注意: この PoC は全件完了・安定したページング・同時点の整合性を保証しません。' );
			stop.disabled = true;
			start.disabled = false;
			controller = null;
			running = false;
		}
	}

	start.addEventListener( 'click', run );
	stop.addEventListener( 'click', () => {
		if ( controller ) controller.abort();
	} );
} )();
