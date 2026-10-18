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
	 * @returns {{warnings: Object[], notices: HTMLElement[]}} 表示用の指摘。
	 */
	function checkForm( original, singularOriginal, translated, form ) {
		const checks = wpgpt_run_checks( original, translated, false, singularOriginal );
		const result = wpgpt_all_page_warnings_normalize_result( {
			warnings: checks.warning.map( ( warning ) => ( {
				text: warning.textContent,
				form,
				setting: null,
			} ) ),
			japaneseFindings: wpgpt_all_page_warnings_collect_japanese_findings(
				singularOriginal, translated, form
			),
		} );
		return { warnings: result.displayWarnings, notices: checks.notice };
	}

	/**
	 * 翻訳者と翻訳 ID を維持しながら、原文・訳文・指摘を横並びの結果カードで表示する。
	 *
	 * @param {Object} proposal 取得済みの個別 Waiting 提案。
	 * @param {Object} data 元ページの原文、Context、翻訳セット情報。
	 * @returns {HTMLElement} 1提案の読み取り専用結果。
	 */
	function proposalCard( proposal, data ) {
		const card = element( 'article' );
		card.className = 'wpgpt-all-page-warnings__card';
		const head = element( 'div' );
		head.className = 'wpgpt-all-page-warnings__card-head';
		head.append(
			element( 'strong', '提案者: ' + ( proposal.user?.user_login || '取得不可' ) ),
			element( 'span', '翻訳 ID: ' + proposal.id )
		);
		card.appendChild( head );

		const body = element( 'div' );
		body.className = 'wpgpt-all-page-warnings__card-body';
		const source = element( 'div' );
		source.className = 'wpgpt-all-page-warnings__field';
		source.append( element( 'strong', '原文' ), element( 'div', data.original ) );
		const translatedField = element( 'div' );
		translatedField.className = 'wpgpt-all-page-warnings__field';
		translatedField.appendChild( element( 'strong', '訳文' ) );
		const warnings = element( 'div' );
		warnings.className = 'wpgpt-all-page-warnings__warnings';
		warnings.appendChild( element( 'strong', 'Warnings / Notices' ) );

		const allWarnings = [];
		const allNotices = [];
		// 各訳文フォームは対応する原文と個別に判定し、別の提案・フォームの指摘を混在させない。
		( proposal.translations || [] ).forEach( ( translation, index ) => {
			const form = index + 1;
			const original = index === 0 ? data.original : ( proposal.plural || data.original );
			const checked = checkForm( original, data.original, translation, form );
			const translatedText = element( 'div' );
			translatedText.className = 'wpgpt-all-page-warnings__translation';
			const ranges = wpgpt_all_page_warnings_normalize_ranges(
				checked.warnings.flatMap( ( warning ) => warning.matches || [] ),
				translation.length
			);
			// 強調位置は日本語ルールから確定できた範囲だけを使用し、推測で着色しない。
			wpgpt_all_page_warnings_append_highlighted_text( translatedText, translation, ranges );
			if ( proposal.translations.length > 1 ) {
				translatedField.appendChild( element( 'small', '訳文 ' + form ) );
			}
			translatedField.appendChild( translatedText );
			allWarnings.push( ...checked.warnings );
			checked.notices.forEach( ( notice ) => allNotices.push( { form, text: notice.textContent } ) );
		} );
		if ( ! proposal.translations?.length ) {
			translatedField.appendChild( element( 'span', '訳文がありません。' ) );
		}
		body.append( source, translatedField );

		const count = element( 'p', 'Warning ' + allWarnings.length + '件 / Notice ' + allNotices.length + '件' );
		warnings.appendChild( count );
		const list = element( 'ul' );
		const reviewResult = {
			original: data.original,
			context: data.context,
			translations: proposal.translations,
			sourceUrl: data.setUrl,
		};
		// 元ページのルール番号、指摘位置、コピー操作を再利用し、同じ結果を同じ形で示す。
		allWarnings.forEach( ( warning ) => {
			list.appendChild(
				wpgpt_all_page_warnings_warning_item(
					warning, proposal.translations.length > 1, reviewResult
				)
			);
		} );
		allNotices.forEach( ( notice ) => {
			const label = proposal.translations.length > 1 ? 'Form #' + notice.form + ': ' : '';
			const item = element( 'li', label + notice.text );
			item.className = 'waiting-notice';
			list.appendChild( item );
		} );
		warnings.appendChild( list );
		body.appendChild( warnings );
		card.appendChild( body );
		return card;
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
