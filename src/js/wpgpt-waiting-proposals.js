/**
 * Waiting の各翻訳提案を、既存の全件 Warning 結果と同じ判定・表示規則で比較する。
 * 原文と提案者の区別を保ち、翻訳の変更や承認を行わない読み取り専用画面を提供する。
 */
( () => {
	'use strict';
	const status = document.getElementById( 'waiting-status' );
	const results = document.getElementById( 'waiting-results' );

	/** @param {string} tag 要素名。 @param {string} value 文字列として表示する内容。 @returns {HTMLElement} 表示要素。 */
	const element = ( tag, value = '' ) => {
		const node = document.createElement( tag );
		node.textContent = String( value );
		return node;
	};

	/**
	 * 元画面と同じ判定規則を利用するため、既存の検査処理を順番に読み込む。
	 *
	 * @param {string} src 拡張機能内の JavaScript ファイル。
	 * @returns {Promise<void>} 読み込みの成否。
	 */
	const loadChecks = ( src ) => new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = src;
		script.onload = resolve;
		script.onerror = () => reject( new Error( '既存の判定機能を読み込めませんでした。' ) );
		document.head.append( script );
	} );

	/**
	 * 翻訳フォームの Warning と日本語ルールの位置情報を、元画面と同じ形式で結び付ける。
	 * 件数は既存の判定を基準とし、日本語の位置情報を新たな Warning 件数として加算しない。
	 *
	 * @param {string} original 判定対象フォームの原文。
	 * @param {string} singularOriginal 日本語ルール判定の基準となる単数形原文。
	 * @param {string} translated 対象の訳文。
	 * @param {number} form 訳文フォーム番号（1始まり）。
	 * @returns {{warnings: Object[], findings: Object[], notices: HTMLElement[]}} 元の判定と位置情報。
	 */
	function checkForm( original, singularOriginal, translated, form ) {
		const checks = wpgpt_run_checks( original, translated, false, singularOriginal );
		return {
			warnings: checks.warning.map( ( warning ) => ( {
				text: warning.textContent,
				form,
				setting: null,
			} ) ),
			findings: wpgpt_all_page_warnings_collect_japanese_findings(
				singularOriginal, translated, form
			),
			notices: checks.notice,
		};
	}

	/**
	 * 各提案を既存の Warning 結果カードとして描画し、画面の操作と見た目を統一する。
	 * 異なる提案を区別する情報はカード見出しで保持し、比較画面内からの再取得操作は設けない。
	 *
	 * @param {Object} proposal 取得済みの Waiting 提案。
	 * @param {Object} data 元ページの原文、文脈、翻訳セット情報。
	 * @returns {HTMLElement} 1提案の読み取り専用結果カード。
	 */
	function proposalCard( proposal, data ) {
		const warnings = [];
		const japaneseFindings = [];
		const notices = [];
		// 翻訳フォームごとに原文との対応を保ち、既存チェックの件数と日本語指摘位置を収集する。
		( proposal.translations || [] ).forEach( ( translation, index ) => {
			const form = index + 1;
			const original = index === 0 ? data.original : ( proposal.plural || data.original );
			const checked = checkForm( original, data.original, translation, form );
			warnings.push( ...checked.warnings );
			japaneseFindings.push( ...checked.findings );
			checked.notices.forEach( ( notice ) => notices.push( { form, text: notice.textContent } ) );
		} );
		// 翻訳 ID まで絞り込むことで、比較した提案を GlotPress 側で見失わないようにする。
		const sourceUrl = new URL( data.setUrl );
		sourceUrl.searchParams.set( 'filters[status]', 'waiting' );
		sourceUrl.searchParams.set( 'filters[translation_id]', proposal.id );
		const result = wpgpt_all_page_warnings_normalize_result( {
			original: data.original,
			context: data.context,
			translations: proposal.translations,
			sourceUrl: sourceUrl.href,
			warnings,
			japaneseFindings,
		} );
		// 同じ原文の複数提案も、提案者と翻訳 ID を失わない見出しで区別する。
		return wpgpt_all_page_warnings_result_card( result, {
			sourceLabel: '提案者: ' + ( proposal.user?.user_login || '取得不可' ),
			detailLabel: '翻訳 ID: ' + proposal.id,
			hideCompare: true,
			notices,
		} );
	}

	/**
	 * 元の翻訳画面の設定とロケールを復元して、取得済みの Waiting 提案だけを表示する。
	 *
	 * @param {Object} data 元画面から一度限りで受領したデータ。
	 * @returns {Promise<void>} 比較表示の完了。
	 */
	async function render( data ) {
		if ( ! data || ! Array.isArray( data.proposals ) || ! Array.isArray( data.settings ) ) {
			throw new Error( '受け取ったデータが不正です。' );
		}
		// 判定を開始する前に、元の翻訳画面と同じルール設定を適用する。
		for ( const [ key, value ] of data.settings ) {
			if ( ! Object.hasOwn( wpgpt_settings, key ) || typeof value !== 'string' ) {
				throw new Error( '設定情報が不正です。' );
			}
			wpgpt_settings[ key ].state = value;
		}
		await loadChecks( 'js/wpgpt-checks.js' );
		// 拡張機能の URL では言語が判別できないため、元の翻訳セットの言語を使用する。
		wpgpt_is_japanese_locale = () => data.locale === 'ja';
		// 比較タブには翻訳一覧が存在しないため、全件確認機能は自動起動しない。
		await loadChecks( 'js/wpgpt-all-page-warnings.js' );

		results.append( element( 'p', '翻訳者条件: ' + ( data.login || 'すべての翻訳者' ) ) );
		results.append( element( 'p', 'Context: ' + ( data.context || 'なし' ) ) );
		const note = element( 'p', '取得結果: ' + data.proposals.length + '件。API のページングにより全提案が含まれない可能性があります。' );
		note.className = 'waiting-note';
		results.appendChild( note );
		// 各 Waiting の翻訳 ID を残し、正誤にかかわらず独立したレビュー候補として表示する。
		data.proposals.forEach( ( proposal ) => results.appendChild( proposalCard( proposal, data ) ) );
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
