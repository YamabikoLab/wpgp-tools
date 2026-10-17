/*
 * Chrome 拡張機能の内部タブで、既存 Warning 判定と日本語ルールを
 * 同じ設定で実行できるかを手動確認する。設定・翻訳文は保存しない。
 */
( () => {
	'use strict';
	const form = document.getElementById( 'poc-form' );
	const output = document.getElementById( 'poc-output' );
	form.addEventListener( 'submit', ( event ) => {
		event.preventDefault();
		try {
			const raw = document.getElementById( 'poc-settings' ).value.trim();
			if ( raw ) {
				const settings = JSON.parse( raw );
				if ( ! settings || Array.isArray( settings ) || typeof settings !== 'object' ) {
					throw new Error( '設定はオブジェクト形式の JSON にしてください。' );
				}
				// 翻訳ページから渡された既知の設定値だけを今回の判定へ反映する。
				for ( const [ key, value ] of Object.entries( settings ) ) {
					if ( ! Object.hasOwn( wpgpt_settings, key ) ||
						! Object.hasOwn( wpgpt_settings[ key ], 'state' ) ||
						typeof value !== 'string' ) {
						throw new Error( '設定形式が一致しません: ' + key );
					}
					wpgpt_settings[ key ].state = value;
				}
			}
			// 原文側の /ja/ と異なる拡張機能 URL では日本語ルールが無効になる。
			// 今回は日本語セットの結果比較だけに用途を限定し、ロケールを明示する。
			wpgpt_is_japanese_locale = () => true;
			const original = document.getElementById( 'poc-original' ).value;
			const translated = document.getElementById( 'poc-translation' ).value;
			const checks = wpgpt_run_checks( original, translated, false, original );
			output.textContent = [
				'既存判定: Warning ' + checks.warning.length + '件 / Notice ' + checks.notice.length + '件',
				...checks.warning.map( ( node ) => 'Warning: ' + node.textContent ),
				...checks.notice.map( ( node ) => 'Notice: ' + node.textContent ),
				'判定は拡張機能の専用タブ内で実行されました。'
			].join( '\n' );
		} catch ( error ) {
			output.textContent = '判定失敗: ' + error.message;
		}
	} );
} )();
