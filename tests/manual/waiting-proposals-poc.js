/*
 * 特定原文の Waiting 提案取得と既存 Warning 判定の再利用可能性を、
 * WordPress.org の翻訳画面上で読み取り専用で確認する検証用スクリプト。
 * 製品の自動処理や全件スキャンには組み込まず、実ブラウザーで実行結果を確認する。
 */
( () => {
	'use strict';

	// 意図しないサイトや別ロケールで認証付き通信を行わない。
	if ( 'https://translate.wordpress.org' !== location.origin ||
		! /^\/projects\/.+\/ja\/[^/]+\/?$/.test( location.pathname ) ) {
		console.error( 'PoC は translate.wordpress.org の日本語翻訳セット画面でのみ実行できます。' );
		return;
	}
	if ( document.getElementById( 'wpgpt-waiting-poc' ) ) return;

	/**
	 * 結果と診断のための要素を安全に作成する。
	 *
	 * @param {string} tag 表示要素の種類。
	 * @param {string} value 利用者に表示する文字列。
	 * @returns {HTMLElement} HTML を解釈しない表示要素。
	 */
	function element( tag, value = '' ) {
		const node = document.createElement( tag );
		node.textContent = value;
		return node;
	}

	const panel = element( 'section' );
	panel.id = 'wpgpt-waiting-poc';
	panel.style.cssText = 'position:relative;z-index:10000;margin:16px;padding:16px;border:2px solid #2271b1;background:#fff;color:#222;max-width:860px;';
	panel.append( element( 'h2', 'Waiting 提案取得 PoC（読み取り専用）' ) );
	panel.append( element( 'p', '原文 ID で限定し、ボタンを押したときだけ1回 GET します。ページングの網羅性は保証しません。' ) );

	const form = element( 'form' );
	const idLabel = element( 'label', '原文 ID: ' );
	const originalId = element( 'input' );
	originalId.type = 'text';
	originalId.required = true;
	originalId.pattern = '[1-9][0-9]*';
	originalId.value = '22606895';
	idLabel.append( originalId );
	const loginLabel = element( 'label', ' 翻訳者（任意）: ' );
	const login = element( 'input' );
	login.type = 'text';
	login.autocomplete = 'off';
	loginLabel.append( login );
	const button = element( 'button', '1回だけ取得・検証する' );
	button.type = 'submit';
	form.append( idLabel, loginLabel, button );
	panel.append( form );
	const output = element( 'div' );
	output.setAttribute( 'aria-live', 'polite' );
	panel.append( output );
	const close = element( 'button', '検証画面を閉じる' );
	close.type = 'button';
	close.addEventListener( 'click', () => panel.remove() );
	panel.append( close );
	document.body.prepend( panel );

	/**
	 * 1つの提案を、翻訳 ID を維持したまま表示する。
	 * 既存の判定設定・DOM 実行環境を使い、本実装で再利用できるかを確認する。
	 *
	 * @param {Object} translation GlotPress API が返した翻訳提案。
	 * @param {HTMLElement} root 検証結果の表示先。
	 * @returns {void}
	 */
	function showProposal( translation, root ) {
		const title = element( 'h3', '翻訳 ID: ' + translation.id );
		root.append( title, element( 'p', '原文: ' + ( translation.singular ?? '（取得不可）' ) ) );
		root.append( element( 'p', 'Context: ' + ( translation.context ?? '（取得不可）' ) ) );
		root.append( element( 'p', '提案者: ' + ( translation.user?.user_login ?? '（取得不可）' ) ) );
		const forms = translation.translations;
		if ( ! Array.isArray( forms ) || ! forms.length ) {
			root.append( element( 'p', '訳文フォームがありません。API の形式を確認してください。' ) );
			return;
		}
		// 複数形を含むすべての訳文を、それぞれの原文と照合する。
		forms.forEach( ( translated, index ) => {
			if ( typeof translated !== 'string' ) return;
			root.append( element( 'p', '訳文 ' + ( index + 1 ) + ': ' + translated ) );
			if ( typeof wpgpt_run_checks !== 'function' || typeof wpgpt_settings === 'undefined' ||
				typeof wpgpt_is_japanese_locale !== 'function' ) {
				root.append( element( 'p', '既存チェックの初期化が確認できません。拡張機能が有効か確認してください。' ) );
				return;
			}
			try {
				const original = index === 0 ? translation.singular : ( translation.plural || translation.singular );
				if ( typeof original !== 'string' ) throw new Error( '原文の文字列が取得できません。' );
				const checks = wpgpt_run_checks( original, translated, false, translation.singular );
				root.append( element( 'p', '既存判定: Warning ' + checks.warning.length + '件 / Notice ' + checks.notice.length + '件' ) );
				// DOM ノードを再利用せず内容だけを複写し、外部データを HTML として挿入しない。
				for ( const warning of checks.warning ) root.append( element( 'p', 'Warning: ' + warning.textContent ) );
				for ( const notice of checks.notice ) root.append( element( 'p', 'Notice: ' + notice.textContent ) );
			} catch ( error ) {
				root.append( element( 'p', '既存判定が実行できません: ' + error.message ) );
			}
		} );
	}

	form.addEventListener( 'submit', async ( event ) => {
		event.preventDefault();
		if ( button.disabled ) return;
		output.replaceChildren();
		const id = originalId.value.trim();
		const user = login.value.trim();
		// 未検証の値を通信条件に含めず、対象を確実に限定する。
		if ( ! /^[1-9][0-9]*$/.test( id ) || ( user && ! /^[A-Za-z0-9_.-]+$/.test( user ) ) ) {
			output.append( element( 'p', '原文 ID またはログイン名の形式が不正です。' ) );
			return;
		}
		const url = new URL( '/api' + location.pathname.replace( /\/$/, '' ) + '/', location.origin );
		url.searchParams.set( 'filters[original_id]', id );
		url.searchParams.set( 'filters[status]', 'waiting' );
		if ( user ) url.searchParams.set( 'filters[user_login]', user );
		button.disabled = true;
		output.append( element( 'p', '取得中（この操作でのみ GET を1回実行）' ) );
		try {
			const response = await fetch( url.href, { method: 'GET', credentials: 'same-origin', redirect: 'error' } );
			if ( ! response.ok ) throw new Error( 'HTTP ' + response.status );
			if ( ! ( response.headers.get( 'content-type' ) || '' ).includes( 'application/json' ) ) {
				throw new Error( 'JSON 応答ではありません。API 経路・認証・リダイレクトを確認してください。' );
			}
			const data = await response.json();
			// GlotPress 標準 API テンプレートでは翻訳の配列が返る想定。異なる形式は推測せず記録する。
			if ( ! Array.isArray( data ) ) throw new Error( '想定外の JSON 形式（配列ではありません）。' );
			const proposals = [];
			const ids = new Set();
			for ( const item of data ) {
				if ( ! item || String( item.original_id ) !== id ||
					( item.translation_status ?? item.status ) !== 'waiting' ||
					! /^[1-9][0-9]*$/.test( String( item.id ) ) ) {
					throw new Error( '別原文・別ステータスまたは無効な翻訳 ID が含まれています。' );
				}
				if ( ids.has( String( item.id ) ) ) throw new Error( '同じ翻訳 ID が重複しています。' );
				ids.add( String( item.id ) );
				proposals.push( item );
			}
			output.replaceChildren();
			output.append( element( 'p', '取得件数: ' + proposals.length + '件（翻訳 ID は統合しません）' ) );
			output.append( element( 'p', '取得結果が全件かどうかは、ページング条件・実画面との照合が必要です。' ) );
			output.append( element( 'p', '期待 ID（参考）: 137070872 / 141335806。実データの変動に注意してください。' ) );
			for ( const proposal of proposals ) showProposal( proposal, output );
		} catch ( error ) {
			output.replaceChildren( element( 'p', '取得・検証失敗: ' + error.message ) );
		} finally {
			button.disabled = false;
		}
	} );
} )();
