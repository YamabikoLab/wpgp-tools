/*
 * PO の原文・Context から GlotPress の原文 ID を一意に特定できるかを、
 * 選択した原文1件に限定して調べる読み取り専用の検証用スクリプト。
 */
( () => {
	'use strict';
	if ( location.origin !== 'https://translate.wordpress.org' ||
		! /^\/projects\/.+\/ja\/[^/]+\/?$/.test( location.pathname ) ) {
		console.error( '日本語翻訳セットの画面で実行してください。' );
		return;
	}
	if ( document.getElementById( 'wpgpt-original-id-poc' ) ) return;

	/** @param {string} tag 要素名。 @param {string} value 表示文字列。 @returns {HTMLElement} 安全な表示要素。 */
	const make = ( tag, value = '' ) => {
		const node = document.createElement( tag );
		node.textContent = value;
		return node;
	};

	const section = make( 'section' );
	section.id = 'wpgpt-original-id-poc';
	section.style.cssText = 'background:#fff;color:#222;border:2px solid #2271b1;padding:16px;margin:16px;position:relative;z-index:10000;max-width:900px';
	section.append( make( 'h2', '原文 ID 自動解決 PoC（読み取り専用）' ) );
	const form = make( 'form' );
	const originalLabel = make( 'label', '原文（完全一致）: ' );
	const original = make( 'textarea' );
	original.rows = 2;
	original.cols = 74;
	original.value = '%1$s trend of article views over the last %2$s';
	original.required = true;
	originalLabel.append( original );
	const contextLabel = make( 'label', 'Context（空欄は Context なし）: ' );
	const context = make( 'input' );
	context.type = 'text';
	contextLabel.append( context );
	const submit = make( 'button', '原文を1回だけ検索' );
	submit.type = 'submit';
	form.append( originalLabel, make( 'p' ), contextLabel, make( 'p' ), submit );
	const result = make( 'div' );
	result.setAttribute( 'aria-live', 'polite' );
	const close = make( 'button', '閉じる' );
	close.type = 'button';
	close.addEventListener( 'click', () => section.remove() );
	section.append( form, result, close );
	document.body.prepend( section );

	form.addEventListener( 'submit', async ( event ) => {
		event.preventDefault();
		if ( submit.disabled ) return;
		const source = original.value;
		const expectedContext = context.value || null;
		result.replaceChildren();
		if ( source.length > 2000 || expectedContext?.length > 500 ) {
			result.append( make( 'p', '長すぎる入力は取得対象外です。' ) );
			return;
		}
		const url = new URL( '/api' + location.pathname.replace( /\/$/, '' ) + '/', location.origin );
		url.searchParams.set( 'filters[status]', 'waiting' );
		url.searchParams.set( 'filters[term]', source );
		url.searchParams.set( 'filters[term_scope]', 'scope_originals' );
		submit.disabled = true;
		result.append( make( 'p', '候補を取得中…' ) );
		try {
			const response = await fetch( url.href, { credentials: 'same-origin', redirect: 'error' } );
			if ( ! response.ok ) throw new Error( 'HTTP ' + response.status );
			if ( ! ( response.headers.get( 'content-type' ) || '' ).includes( 'application/json' ) ) {
				throw new Error( 'JSON 以外の応答です。' );
			}
			const rows = await response.json();
			if ( ! Array.isArray( rows ) ) throw new Error( '翻訳配列以外の応答です。' );

			const ids = new Set();
			let missingContext = false;
			let exactCount = 0;
			// 原文の完全一致と Context を確認できる候補だけを同一原文として扱う。
			for ( const row of rows ) {
				if ( ! row || row.singular !== source ) continue;
				exactCount++;
				if ( ! Object.hasOwn( row, 'context' ) ) {
					missingContext = true;
					continue;
				}
				if ( ( row.context || null ) !== expectedContext ) continue;
				if ( /^[1-9][0-9]*$/.test( String( row.original_id ) ) ) {
					ids.add( String( row.original_id ) );
				}
			}
			result.replaceChildren();
			result.append( make( 'p', 'API 応答: ' + rows.length + '件 / 原文完全一致: ' + exactCount + '件' ) );
			if ( missingContext ) {
				result.append( make( 'p', '判定保留: Context が応答にありません。Context の異なる原文を区別できないため、安全に ID を確定できません。' ) );
			} else if ( ids.size === 1 ) {
				result.append( make( 'p', '候補の原文 ID: ' + [ ...ids ][ 0 ] + '（ただし API のページング・検索網羅性は未検証）' ) );
			} else {
				result.append( make( 'p', '一意に解決できません。候補原文 ID 数: ' + ids.size ) );
			}
			result.append( make( 'p', 'この検索は対象原文の全候補を保証しません。取得上限・ページングを別途確認してください。' ) );
		} catch ( error ) {
			result.replaceChildren( make( 'p', '取得失敗: ' + error.message ) );
		} finally {
			submit.disabled = false;
		}
	} );
} )();
