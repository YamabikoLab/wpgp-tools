/* global wpgpt_settings, wpgpt_is_japanese_locale, wpgpt_run_checks, wpgpt_ja_check_punctuation, wpgpt_ja_check_half_width, wpgpt_ja_check_half_full_spacing, wpgpt_ja_check_parentheses, wpgpt_ja_check_inner_parentheses_spacing, wpgpt_ja_check_period_inside_parentheses, wpgpt_ja_check_sentence_ending_parentheses, wpgpt_ja_check_number_spacing, wpgpt_ja_check_recommended_expressions, wpgpt_ja_check_view_expression, wpgpt_ja_check_not_allowed_expression, wpgpt_ja_check_sorry_prefix, wpgpt_ja_check_middle_dot */

/**
 * GlotPress の現在の検索条件・ステータスに対応する翻訳集合を PO 形式で取得し、
 * ブラウザー内で既存の Warning 判定と日本語翻訳ルール判定を一括実行する機能を提供する。
 *
 * このファイルは、全件確認の開始条件、走査結果の保持、ルール別絞り込み、ページ分割、
 * 問題箇所の強調表示、および結果一覧の画面表示を所有する。
 * 翻訳の保存処理そのものは所有せず、未保存判定は走査開始時点の GlotPress の textarea を
 * 保存済み初期値と比較して行う。
 */

/**
 * 全件確認結果で絞り込み対象として扱う日本語翻訳ルール。
 *
 * ここに含まれるルールだけを利用者向けの絞り込み候補として表示し、
 * 実際に Warning が存在しないルールは候補から除外する。
 */
const WPGPT_ALL_PAGE_WARNING_RULES = [
	{ setting: 'ja_punctuation', label: '1-1 日本語の句読点' },
	{ setting: 'ja_half_width', label: '1-2 英数字・記号の半角表記' },
	{ setting: 'ja_half_full_spacing', label: '1-4 半角文字と全角文字の間のスペース' },
	{ setting: 'ja_parentheses', label: '1-5 半角丸括弧と前後スペース' },
	{ setting: 'ja_inner_parentheses_spacing', label: '1-6 丸括弧内側の不要スペース' },
	{ setting: 'ja_period_inside_parentheses', label: '1-7 括弧内末尾の句点' },
	{ setting: 'ja_sentence_ending_parentheses', label: '1-8 文末括弧と句点の位置' },
	{ setting: 'ja_number_spacing', label: '1-9 半角数字前後の不要スペース' },
	{ setting: 'ja_view_expression', label: '3-2 「View XX」の訳し方' },
	{ setting: 'ja_not_allowed_expression', label: '3-3 「not allowed to」の権限表現' },
	{ setting: 'ja_sorry_prefix', label: '3-4 「Sorry, ...」の Sorry を訳さない' },
	{ setting: 'ja_recommended_expressions', label: '3-6 推奨表記' },
	{ setting: 'ja_middle_dot', label: '5 中点「・」' },
];

/**
 * 走査結果の Warning 件数を変えずに、日本語指摘のルール識別子と問題位置を表示用 Warning へ補完する。
 *
 * @param {Object} result 全件確認で Warning が見つかった1つの翻訳文字列。
 * @returns {Object} displayWarnings を持つ正規化済み結果。
 */
function wpgpt_all_page_warnings_normalize_result( result ) {
	const unusedFindings = ( result.japaneseFindings || [] ).map( ( finding ) => ( {
		...finding,
		used: false,
	} ) );

	const displayWarnings = result.warnings.map( ( warning ) => {
		const finding = unusedFindings.find( ( candidate ) =>
			! candidate.used &&
			candidate.form === warning.form &&
			candidate.style_guide_item + ': ' + candidate.message === warning.text
		);
		if ( ! finding ) {
			return {
				...warning,
				matches: Array.isArray( warning.matches ) ? warning.matches : [],
			};
		}

		finding.used = true;
		return {
			...warning,
			setting: finding.setting,
			styleGuideItem: finding.style_guide_item,
			matches: Array.isArray( finding.matches ) ? finding.matches : [],
		};
	} );

	return {
		...result,
		displayWarnings,
	};
}

/**
 * 全件確認結果を、利用者が選択した日本語翻訳ルールに従って表示用結果へ絞り込む。
 *
 * ルール未選択時は正規化済み Warning をすべて保持し、ルール選択時は選択ルールに
 * 対応する Warning だけを残す。複数ルール選択時は OR 条件として扱う。
 *
 * @param {Object[]} results 全件確認で Warning が見つかった翻訳文字列。
 * @param {Set<string>} selectedRules 利用者が絞り込み対象として選択したルール識別子。
 * @returns {Object[]} 一覧表示に使用する Warning を付与した翻訳文字列。
 */
function wpgpt_all_page_warnings_filter_results( results, selectedRules ) {
	const normalized = results.map( wpgpt_all_page_warnings_normalize_result );

	if ( ! selectedRules || 0 === selectedRules.size ) {
		return normalized;
	}

	return normalized.reduce( ( filtered, result ) => {
		const matching = result.displayWarnings.filter(
			( warning ) => warning.setting && selectedRules.has( warning.setting )
		);
		if ( matching.length ) {
			filtered.push( {
				...result,
				displayWarnings: matching,
			} );
		}
		return filtered;
	}, [] );
}

/**
 * ルール絞り込み後の結果から、原文・訳文・Context に検索文字列を含む項目だけを残す。
 *
 * @param {Object[]} results ルール絞り込み済みの表示対象結果。
 * @param {string} searchQuery 利用者が入力した検索文字列。
 * @returns {Object[]} 文字列検索を反映した表示対象結果。
 */
function wpgpt_all_page_warnings_search_results( results, searchQuery ) {
	const query = String( searchQuery || '' ).trim().toLocaleLowerCase();
	if ( ! query ) {
		return results;
	}

	return results.filter( ( result ) => {
		const searchable = [
			result.original,
			result.context || '',
			...( result.translations || [] ),
		];
		return searchable.some( ( value ) => String( value || '' ).toLocaleLowerCase().includes( query ) );
	} );
}

/**
 * 現在の全絞り込み条件を同じ結果集合へ順番に適用する。
 *
 * @param {Object[]} results 全件確認で Warning が見つかった翻訳文字列。
 * @param {Set<string>} selectedRules 選択中の日本語翻訳ルール。
 * @param {string} searchQuery 文字列検索条件。
 * @returns {Object[]} 画面表示・集計・Slack コピー出力で共有する結果。
 */
function wpgpt_all_page_warnings_apply_filters( results, selectedRules, searchQuery ) {
	return wpgpt_all_page_warnings_search_results(
		wpgpt_all_page_warnings_filter_results( results, selectedRules ),
		searchQuery
	);
}

/**
 * 現在の表示対象結果から、画面上部に表示する集計値を作成する。
 *
 * @param {Object[]} results 絞り込み後の表示対象結果。
 * @returns {{warnings: number, strings: number}} Warning 件数と影響する翻訳文字列数。
 */
function wpgpt_all_page_warnings_summarize( results ) {
	return {
		// 表示対象の各翻訳文字列が持つ Warning 数を合計し、絞り込み後の件数を示す。
		warnings: results.reduce( ( total, result ) => total + result.displayWarnings.length, 0 ),
		strings: results.length,
	};
}

/**
 * 表示対象結果を指定ページ分だけ取り出す。
 *
 * 要求ページが範囲外の場合も、常に存在する範囲内のページへ補正して表示を継続できるようにする。
 *
 * @param {Object[]} results 絞り込み後の表示対象結果。
 * @param {number} page 利用者が表示しようとしているページ番号。
 * @param {number} pageSize 1ページに表示する翻訳文字列数。
 * @returns {{page: number, totalPages: number, start: number, items: Object[]}} 表示ページ情報。
 */
function wpgpt_all_page_warnings_paginate( results, page, pageSize ) {
	const totalPages = Math.max( 1, Math.ceil( results.length / pageSize ) );
	const safePage = Math.min( Math.max( 1, page ), totalPages );
	const start = ( safePage - 1 ) * pageSize;

	return {
		page: safePage,
		totalPages,
		start,
		items: results.slice( start, start + pageSize ),
	};
}

/**
 * 1つの訳文に対して、日本語翻訳ルールのうち Warning 設定になっている指摘を収集する。
 *
 * 日本語チェックが無効、または日本語ロケール以外では日本語固有の指摘を生成しない。
 *
 * @param {string} singularOriginal 単数形の原文。原文と訳文の関係を確認するルールで使用する。
 * @param {string} translated 判定対象の訳文。
 * @param {number} form 複数形を含む訳文フォーム番号。表示上は1始まりで扱う。
 * @returns {Object[]} 絞り込みと強調表示に利用する日本語ルールの指摘。
 */
function wpgpt_all_page_warnings_collect_japanese_findings( singularOriginal, translated, form = 1 ) {
	// 日本語固有の判定は、日本語チェックが有効な日本語ロケールでのみ実行する。
	if (
		'enabled' !== wpgpt_settings.ja_checks.state ||
		! wpgpt_is_japanese_locale()
	) {
		return [];
	}

	const findings = [
		...wpgpt_ja_check_punctuation( translated ),
		...wpgpt_ja_check_half_width( translated ),
		...wpgpt_ja_check_half_full_spacing( translated ),
		...wpgpt_ja_check_parentheses( translated ),
		...wpgpt_ja_check_inner_parentheses_spacing( translated ),
		...wpgpt_ja_check_period_inside_parentheses( translated ),
		...wpgpt_ja_check_sentence_ending_parentheses( translated ),
		...wpgpt_ja_check_number_spacing( translated ),
		...wpgpt_ja_check_recommended_expressions( translated ),
		...wpgpt_ja_check_view_expression( singularOriginal, translated ),
		...wpgpt_ja_check_not_allowed_expression( singularOriginal, translated ),
		...wpgpt_ja_check_sorry_prefix( singularOriginal, translated ),
		...wpgpt_ja_check_middle_dot( translated ),
	];

	return findings
		// 利用者設定で Warning 扱いになっているルールだけを全件確認結果へ含める。
		.filter( ( finding ) => 'warning' === wpgpt_settings[ finding.setting ]?.state )
		// 各指摘にフォーム番号を付与し、絞り込みと強調表示で一意に扱える形式へ揃える。
		.map( ( finding ) => ( {
			setting: finding.setting,
			style_guide_item: finding.style_guide_item,
			message: finding.message,
			// 強調範囲を持たないルールも一覧表示できるよう、範囲情報は常に配列として扱う。
			matches: Array.isArray( finding.matches ) ? finding.matches : [],
			form,
		} ) );
}

/**
 * 現在の GlotPress 画面の検索条件・ステータスを保持した PO 出力 URL を作成する。
 *
 * @param {Document|Object} pageDocument 現在の GlotPress 画面を表す文書。
 * @param {string} baseUrl 相対 URL を解決する基準 URL。
 * @returns {string} 現在の絞り込み条件を反映した PO 出力 URL。
 * @throws {Error} GlotPress の出力リンクまたは URL を取得できない場合。
 */
function wpgpt_all_page_warnings_build_export_url( pageDocument = document, baseUrl = window.location.href ) {
	const exportLink = pageDocument.querySelector( 'a#export' );
	// GlotPress の出力導線がない画面では、現在条件を保持した全件確認を開始できない。
	if ( ! exportLink ) {
		throw new Error( 'GlotPress の Export リンクを取得できませんでした。' );
	}

	// 現在の検索条件を保持する属性を優先し、利用できない場合だけ通常のリンク先を使用する。
	const href = exportLink.getAttribute( 'filters' ) || exportLink.getAttribute( 'href' );
	// 出力先を特定できない場合は、誤った対象を走査せず明示的に中止する。
	if ( ! href ) {
		throw new Error( 'GlotPress の Export URL を取得できませんでした。' );
	}

	const url = new URL( href, baseUrl );
	url.hash = '';
	url.searchParams.set( 'format', 'po' );
	return url.href;
}

/**
 * 結果一覧から対象原文を GlotPress で確認するための検索 URL を作成する。
 *
 * @param {string} exportUrl 全件確認に使用した PO 出力 URL。
 * @param {string} original 確認対象の原文。
 * @returns {string} 原文検索条件を設定した GlotPress の翻訳一覧 URL。
 */
function wpgpt_all_page_warnings_build_source_url( exportUrl, original ) {
	const url = new URL( exportUrl );
	url.pathname = url.pathname.replace( /\/export-translations\/?$/u, '/' );
	url.hash = '';
	url.searchParams.delete( 'format' );
	url.searchParams.set( 'filters[term]', original );
	url.searchParams.set( 'filters[term_scope]', 'scope_originals' );
	return url.href;
}

/**
 * 取得した本文が全件確認に利用できる PO 内容かを最低限判定する。
 *
 * @param {string} text 取得した応答本文。
 * @returns {boolean} PO の原文定義と訳文定義の両方を確認できる場合は true。
 */
function wpgpt_all_page_warnings_is_po( text ) {
	// 原文と訳文の双方が存在することを、全件確認に必要な最低条件とする。
	return /^msgid\s+"/mu.test( text ) && /^msgstr(?:\[\d+\])?\s+"/mu.test( text );
}

/**
 * GlotPress から PO 出力を取得し、全件確認に利用できる内容であることを保証する。
 *
 * @param {string} url 取得対象の PO 出力 URL。
 * @returns {Promise<string>} 検証済みの PO 本文。
 * @throws {Error} HTTP 応答が失敗した場合、または応答が PO と判定できない場合。
 */
async function wpgpt_all_page_warnings_fetch_po( url ) {
	const response = await fetch( url, {
		credentials: 'same-origin',
	} );

	// 取得失敗時は不完全なデータを解析せず、走査失敗として利用者へ伝える。
	if ( ! response.ok ) {
		throw new Error( 'HTTP ' + response.status + ' while loading the PO export.' );
	}

	const po = await response.text();
	// 認証画面など PO 以外の応答を翻訳データとして扱わない。
	if ( ! wpgpt_all_page_warnings_is_po( po ) ) {
		throw new Error( 'The export response was not a PO file.' );
	}

	return po;
}

/**
 * PO の引用文字列を JavaScript 文字列として扱える内容へ復元する。
 *
 * @param {string} value PO の引用記法を含む値。
 * @returns {string} 引用符と対応するエスケープ表現を復元した文字列。
 */
function wpgpt_all_page_warnings_unquote_po( value ) {
	const trimmed = value.trim();
	// PO の引用文字列として成立しない値は、翻訳内容として復元しない。
	if ( '"' !== trimmed[ 0 ] || '"' !== trimmed[ trimmed.length - 1 ] ) {
		return '';
	}

	return trimmed.slice( 1, -1 ).replace(
		/\\(x[0-9A-Fa-f]{2}|[0-7]{1,3}|[abfnrtv"\\])/gu,
		// PO で許容されるエスケープ表現ごとに、本来の1文字へ復元する。
		( match, escaped ) => {
			// 16進表現は文字コードとして復元する。
			if ( 'x' === escaped[ 0 ] ) {
				return String.fromCharCode( Number.parseInt( escaped.slice( 1 ), 16 ) );
			}
			// 8進表現も文字コードとして復元する。
			if ( /^[0-7]+$/u.test( escaped ) ) {
				return String.fromCharCode( Number.parseInt( escaped, 8 ) );
			}

			const replacements = {
				a: '\x07',
				b: '\b',
				f: '\f',
				n: '\n',
				r: '\r',
				t: '\t',
				v: '\v',
				'"': '"',
				'\\': '\\',
			};
			// 定義済みの標準エスケープだけを置換し、未知の表現は元の内容を保持する。
			return replacements[ escaped ] ?? match;
		}
	);
}

/**
 * PO 本文を、原文・文脈・複数形・訳文フォームを保持する走査用データへ変換する。
 *
 * ヘッダー項目は翻訳文字列として扱わず、複数行の値は所属する項目へ連結する。
 *
 * @param {string} po GlotPress から取得した PO 本文。
 * @returns {Object[]} 全件確認で判定可能な翻訳項目。
 */
function wpgpt_all_page_warnings_parse_po( po ) {
	const entries = [];
	let entry = null;
	let activeField = null;

	/**
	 * PO の1翻訳項目を保持する空の走査用データを作成する。
	 *
	 * @returns {Object} 初期化済みの翻訳項目。
	 */
	const newEntry = () => ( {
		context: null,
		msgid: null,
		msgidPlural: null,
		translations: [],
	} );

	/**
	 * 現在行を所属させる翻訳項目を保証する。
	 *
	 * @returns {Object} 現在編集中の翻訳項目。
	 */
	const ensureEntry = () => {
		// 項目開始前に値行が現れた場合でも、同じ項目として保持できる受け皿を用意する。
		if ( ! entry ) {
			entry = newEntry();
		}
		return entry;
	};

	/**
	 * 読み取り中の翻訳項目を確定し、次の項目を受け取れる状態へ戻す。
	 *
	 * @returns {void}
	 */
	const flush = () => {
		// PO ヘッダーや原文未確定項目は、翻訳文字列の全件確認対象へ含めない。
		if ( entry && null !== entry.msgid && '' !== entry.msgid ) {
			const highestTranslationIndex = entry.translations.length - 1;
			// 複数形の途中フォームが空でもフォーム位置を保てるよう、最大番号まで連続した配列に整える。
			entry.translations = 0 <= highestTranslationIndex ?
				Array.from(
					{ length: highestTranslationIndex + 1 },
					// 未定義のフォームは空訳として保持し、後続フォームの番号をずらさない。
					( unused, index ) => entry.translations[ index ] ?? ''
				) :
				[];
			entries.push( entry );
		}
		entry = null;
		activeField = null;
	};

	/**
	 * PO の継続行を、直前に開始した項目へ追加する。
	 *
	 * @param {string} text 継続行から復元した文字列。
	 * @returns {void}
	 */
	const append = ( text ) => {
		// 所属先が確定していない継続行は、別項目へ誤結合しないため無視する。
		if ( ! entry || ! activeField ) {
			return;
		}
		// 訳文はフォーム番号ごとに保持し、原文や文脈の継続行と混在させない。
		if ( 'translation' === activeField.type ) {
			entry.translations[ activeField.index ] =
				( entry.translations[ activeField.index ] || '' ) + text;
			return;
		}
		entry[ activeField.type ] = ( entry[ activeField.type ] || '' ) + text;
	};

	// PO 全体を行単位で読み取り、各行を現在の翻訳項目の構成要素として解釈する。
	po.replace( /\r\n?/gu, '\n' ).split( '\n' ).forEach( ( line ) => {
		// 空行は翻訳項目の区切りとして扱い、それまでの項目を確定する。
		if ( '' === line.trim() ) {
			flush();
			return;
		}
		// PO コメントは翻訳文字列の判定内容に影響しないため走査用データへ含めない。
		if ( line.startsWith( '#' ) ) {
			return;
		}

		let match = line.match( /^msgctxt\s+(".*")\s*$/u );
		// 文脈定義が始まったら、その行を新しい翻訳項目の文脈として扱う。
		if ( match ) {
			// すでに原文まで確定している場合は前項目を閉じ、別項目として開始する。
			if ( entry?.msgid !== null ) {
				flush();
			}
			ensureEntry().context = wpgpt_all_page_warnings_unquote_po( match[ 1 ] );
			activeField = { type: 'context' };
			return;
		}

		match = line.match( /^msgid\s+(".*")\s*$/u );
		// 原文定義は翻訳項目の開始点として扱う。
		if ( match ) {
			// 次の原文が始まった場合は、直前の項目を確定してから新しい項目へ切り替える。
			if ( entry?.msgid !== null ) {
				flush();
			}
			ensureEntry().msgid = wpgpt_all_page_warnings_unquote_po( match[ 1 ] );
			activeField = { type: 'msgid' };
			return;
		}

		match = line.match( /^msgid_plural\s+(".*")\s*$/u );
		// 複数形原文がある項目では、単数形原文と対になる原文として保持する。
		if ( match ) {
			ensureEntry().msgidPlural = wpgpt_all_page_warnings_unquote_po( match[ 1 ] );
			activeField = { type: 'msgidPlural' };
			return;
		}

		match = line.match( /^msgstr(?:\[(\d+)\])?\s+(".*")\s*$/u );
		// 訳文定義はフォーム番号ごとに保持し、単数形ではフォーム0として統一する。
		if ( match ) {
			const index = undefined === match[ 1 ] ? 0 : Number.parseInt( match[ 1 ], 10 );
			ensureEntry().translations[ index ] = wpgpt_all_page_warnings_unquote_po( match[ 2 ] );
			activeField = { type: 'translation', index };
			return;
		}

		match = line.match( /^(".*")\s*$/u );
		// 単独の引用行は、直前に開始した原文・訳文・文脈の継続内容として扱う。
		if ( match ) {
			append( wpgpt_all_page_warnings_unquote_po( match[ 1 ] ) );
		}
	} );

	flush();
	return entries;
}

/**
 * 1つの PO 翻訳項目に既存の Warning 判定と日本語翻訳ルール判定を適用する。
 *
 * 未翻訳項目は確認対象数に含めず、Warning がない翻訳項目は確認済みとして扱うが
 * 結果一覧には追加しない。
 *
 * @param {Object} entry PO から復元した1つの翻訳項目。
 * @param {string} exportUrl 全件確認に使用した PO 出力 URL。
 * @returns {Object|null} 確認対象外なら null、確認済み項目なら結果情報を含むオブジェクト。
 */
function wpgpt_all_page_warnings_analyze_entry( entry, exportUrl ) {
	// 訳文フォームをすべて確認し、1つも翻訳済みでない項目は全件確認の対象外とする。
	if ( ! entry.translations.length || ! entry.translations.some( ( translated ) => '' !== translated ) ) {
		return null;
	}

	const originalForms = [ entry.msgid ];
	// 複数形原文が定義されている項目は、単数形と複数形の両方を原文候補として保持する。
	if ( null !== entry.msgidPlural ) {
		originalForms.push( entry.msgidPlural );
	}

	let originalFormIndex = 0;
	// 複数形原文に対して訳文フォームが1件だけの PO では、その訳文を複数形側の原文と対応させる。
	if ( 2 === originalForms.length && 1 === entry.translations.length ) {
		originalFormIndex = 1;
	}

	const warnings = [];
	const japaneseFindings = [];
	const singularOriginal = originalForms[ 0 ];

	// 各訳文フォームを、それぞれ対応する原文と組み合わせて Warning 判定する。
	entry.translations.forEach( ( translated, translatedIndex ) => {
		const original = originalForms[ originalFormIndex ];
		const checks = wpgpt_run_checks( original, translated, false, singularOriginal );
		// 既存チェックが返した各 Warning を、全件確認結果でフォーム別に表示できる形で収集する。
		checks.warning.forEach( ( warning ) => {
			warnings.push( {
				text: warning.textContent,
				form: translatedIndex + 1,
				setting: null,
				styleGuideItem: null,
			} );
		} );
		japaneseFindings.push(
			...wpgpt_all_page_warnings_collect_japanese_findings(
				singularOriginal,
				translated,
				translatedIndex + 1
			)
		);

		// 複数形項目では2フォーム目以降を複数形原文に対応させる。
		if ( 2 === originalForms.length ) {
			originalFormIndex = 1;
		}
	} );

	// 確認済みでも Warning がない項目は、件数には含めるが結果一覧には表示しない。
	if ( ! warnings.length ) {
		return {
			result: null,
		};
	}

	return {
		result: {
			context: entry.context,
			sourceUrl: wpgpt_all_page_warnings_build_source_url( exportUrl, singularOriginal ),
			original: originalForms.join( '\n' ),
			translations: entry.translations,
			warnings,
			japaneseFindings,
		},
	};
}

/**
 * PO 内の翻訳項目を一括確認し、Warning がある項目と確認済み文字列数を集計する。
 *
 * @param {Object[]} entries PO から復元した翻訳項目。
 * @param {string} exportUrl 全件確認に使用した PO 出力 URL。
 * @returns {{results: Object[], checkedStrings: number}} Warning 結果と確認済み翻訳文字列数。
 */
function wpgpt_all_page_warnings_analyze_entries( entries, exportUrl ) {
	const results = [];
	let checkedStrings = 0;

	// PO 内の各翻訳項目を確認し、対象外・問題なし・Warning ありを区別して集計する。
	entries.forEach( ( entry ) => {
		const analyzed = wpgpt_all_page_warnings_analyze_entry( entry, exportUrl );
		// 未翻訳など確認対象外の項目は、確認済み件数にも結果一覧にも含めない。
		if ( ! analyzed ) {
			return;
		}
		checkedStrings++;
		// Warning が存在する項目だけを利用者向け結果一覧へ追加する。
		if ( analyzed.result ) {
			results.push( analyzed.result );
		}
	} );

	return {
		results,
		checkedStrings,
	};
}

/**
 * 全件確認 UI で使用する基本要素を作成する。
 *
 * @param {string} tagName 作成する HTML 要素名。
 * @param {string} className 付与するクラス名。不要な場合は空文字列。
 * @param {string} text 表示する文字列。未指定の場合は内容を設定しない。
 * @returns {HTMLElement} 作成した要素。
 */
function wpgpt_all_page_warnings_create_element( tagName, className, text ) {
	const element = document.createElement( tagName );
	// クラス指定がある要素だけにクラス名を付与する。
	if ( className ) {
		element.className = className;
	}
	// 空文字列も有効な表示内容なので、未指定の場合だけ文字列設定を省略する。
	if ( undefined !== text ) {
		element.textContent = text;
	}
	return element;
}

/**
 * 訳文中で強調表示する日本語ルール指摘範囲を決定する。
 *
 * 現在表示しているフォームと絞り込みルールだけを対象にし、訳文範囲外や不正な位置を除外する。
 * 重複・連続する指摘範囲は一つへ統合し、同じ文字列を重ねて強調しない。
 *
 * @param {Object} result 1翻訳文字列分の全件確認結果。
 * @param {number} form 強調対象の訳文フォーム番号。
 * @param {Set<string>} selectedRules 現在選択中の絞り込みルール。
 * @param {number} textLength 対象訳文の文字数。
 * @returns {Object[]} 重複を統合した強調表示範囲。
 */
function wpgpt_all_page_warnings_normalize_ranges( matches, textLength ) {
	const ranges = ( Array.isArray( matches ) ? matches : [] )
		.map( ( match ) => ( {
			start: Math.max( 0, Math.min( textLength, match.start ) ),
			end: Math.max( 0, Math.min( textLength, match.end ) ),
		} ) )
		.filter( ( match ) => Number.isInteger( match.start ) && Number.isInteger( match.end ) && match.start < match.end )
		.sort( ( a, b ) => a.start - b.start || a.end - b.end );

	return ranges.reduce( ( merged, range ) => {
		const previous = merged[ merged.length - 1 ];
		// 直前の範囲と重なる、または連続する指摘は一つの強調範囲として扱う。
		if ( previous && range.start <= previous.end ) {
			previous.end = Math.max( previous.end, range.end );
		} else {
			merged.push( { ...range } );
		}
		return merged;
	}, [] );
}

function wpgpt_all_page_warnings_highlight_ranges( result, form, selectedRules, textLength ) {
	const warnings = result.displayWarnings || result.japaneseFindings || [];
	const matches = warnings
		.filter( ( warning ) => warning.form === form )
		.filter( ( warning ) => ! selectedRules?.size || ! warning.setting || selectedRules.has( warning.setting ) )
		.flatMap( ( warning ) => Array.isArray( warning.matches ) ? warning.matches : [] );

	return wpgpt_all_page_warnings_normalize_ranges( matches, textLength );
}

/**
 * 訳文を、通常文字列と問題箇所の強調表示に分けて結果画面へ追加する。
 *
 * @param {HTMLElement} container 訳文を追加する表示先。
 * @param {string} text 表示対象の訳文。
 * @param {Object[]} ranges 強調表示する文字位置の範囲。
 * @returns {void}
 */
function wpgpt_all_page_warnings_append_highlighted_text( container, text, ranges ) {
	let cursor = 0;

	// 強調範囲を先頭から順に適用し、問題箇所以外の文字列も失わず表示する。
	ranges.forEach( ( range ) => {
		// 次の問題箇所までに通常文字列がある場合は、その部分を通常表示する。
		if ( cursor < range.start ) {
			container.appendChild( document.createTextNode( text.slice( cursor, range.start ) ) );
		}
		const mark = wpgpt_all_page_warnings_create_element(
			'mark',
			'wpgpt-all-page-warnings__highlight',
			text.slice( range.start, range.end )
		);
		container.appendChild( mark );
		cursor = range.end;
	} );

	// 最後の問題箇所以降に文字列が残る場合も通常表示として追加する。
	if ( cursor < text.length ) {
		container.appendChild( document.createTextNode( text.slice( cursor ) ) );
	}
}


/**
 * Slack へ貼り付ける利用者由来の文字列を、書式解釈されないコードブロックとして出力する。
 *
 * @param {string} value リテラル表示する文字列。
 * @returns {string} Slack の複数行コードブロック。
 */
function wpgpt_all_page_warnings_slack_literal( value ) {
	return '```\n' + String( value ?? '' ) + '\n```';
}

/**
 * Warning の位置情報を使い、Slack で問題箇所だけが太字になる確認用訳文を作成する。
 *
 * 正確な訳文は別途コードブロックで出力するため、この文字列は問題箇所を見つけやすくする
 * レビュー補助表示として扱う。
 *
 * @param {string} translation 対象 Warning が属する訳文。
 * @param {Object} warning 表示対象の Warning。
 * @returns {string} 問題箇所を Slack の太字記法で囲んだ確認用訳文。
 */
function wpgpt_all_page_warnings_slack_problem_text( translation, warning ) {
	const ranges = wpgpt_all_page_warnings_normalize_ranges(
		warning.matches,
		translation.length
	);
	if ( ! ranges.length ) {
		return '';
	}

	let cursor = 0;
	let output = '';
	ranges.forEach( ( range ) => {
		output += translation.slice( cursor, range.start );
		output += '*' + translation.slice( range.start, range.end ) + '*';
		cursor = range.end;
	} );
	return output + translation.slice( cursor );
}

function wpgpt_all_page_warnings_slack_warning( warning, translation, multipleForms, index = null ) {
	const lines = [];
	const heading = null === index ? '*Warning*' : '*Warning ' + index + '*';
	lines.push( heading );
	if ( multipleForms ) {
		lines.push( 'Form #' + warning.form );
	}
	lines.push( wpgpt_all_page_warnings_slack_literal( warning.text ) );

	const problemText = wpgpt_all_page_warnings_slack_problem_text( translation, warning );
	if ( problemText ) {
		lines.push(
			'',
			'*Problem location*',
			problemText
		);
	}
	return lines.join( '\n' );
}

function wpgpt_all_page_warnings_slack_result( result, warnings = result.displayWarnings ) {
	const lines = [];
	if ( result.context ) {
		lines.push( '*Context*', wpgpt_all_page_warnings_slack_literal( result.context ), '' );
	}
	lines.push( '*Original*', wpgpt_all_page_warnings_slack_literal( result.original ), '' );

	const multipleForms = result.translations.length > 1;
	result.translations.forEach( ( translation, index ) => {
		lines.push(
			multipleForms ? '*Translation Form #' + ( index + 1 ) + '*' : '*Translation*',
			wpgpt_all_page_warnings_slack_literal( translation ),
			''
		);
	} );

	lines.push( '*Warnings*' );
	warnings.forEach( ( warning, index ) => {
		const translation = result.translations[ warning.form - 1 ] || '';
		lines.push(
			wpgpt_all_page_warnings_slack_warning(
				warning,
				translation,
				multipleForms,
				index + 1
			),
			''
		);
	} );
	lines.push( '*GlotPress*', result.sourceUrl );
	return lines.join( '\n' ).trim();
}

function wpgpt_all_page_warnings_slack_all( results, selectedRules, searchQuery ) {
	const summary = wpgpt_all_page_warnings_summarize( results );
	const selectedLabels = WPGPT_ALL_PAGE_WARNING_RULES
		.filter( ( rule ) => selectedRules?.has( rule.setting ) )
		.map( ( rule ) => rule.label.split( ' ' )[ 0 ] );

	const lines = [
		'*Warning レビュー*',
		'対象: ' + summary.strings + '文字列 / ' + summary.warnings + ' Warnings',
	];
	if ( selectedLabels.length ) {
		lines.push( 'ルール: ' + selectedLabels.join( ', ' ) );
	}
	if ( String( searchQuery || '' ).trim() ) {
		lines.push(
			'検索:',
			wpgpt_all_page_warnings_slack_literal( String( searchQuery ).trim() )
		);
	}

	results.forEach( ( result, index ) => {
		lines.push(
			'',
			'*' + ( index + 1 ) + '. Review item*',
			wpgpt_all_page_warnings_slack_result( result ),
			'',
			'──────────'
		);
	} );
	return lines.join( '\n' ).replace( /\n──────────$/u, '' ).trim();
}

function wpgpt_all_page_warnings_slack_single( result, warning ) {
	const translation = result.translations[ warning.form - 1 ] || '';
	const lines = [];
	if ( result.context ) {
		lines.push( '*Context*', wpgpt_all_page_warnings_slack_literal( result.context ), '' );
	}
	lines.push(
		'*Original*',
		wpgpt_all_page_warnings_slack_literal( result.original ),
		'',
		'*Translation*',
		wpgpt_all_page_warnings_slack_literal( translation ),
		'',
		wpgpt_all_page_warnings_slack_warning( warning, translation, false ),
		'',
		'*GlotPress*',
		result.sourceUrl
	);
	return lines.join( '\n' ).trim();
}

async function wpgpt_all_page_warnings_copy_text( text, clipboard = navigator.clipboard ) {
	if ( ! clipboard || 'function' !== typeof clipboard.writeText ) {
		throw new Error( 'Clipboard API is not available.' );
	}
	await clipboard.writeText( text );
}

/**
 * 全件確認 UI の1画面内状態。
 *
 * PO から得た走査結果、ルール絞り込み、表示ページ、走査中状態、確認件数、
 * および構築済み UI 要素への参照を保持する。翻訳の保存状態は永続保持しない。
 */
const wpgptAllPageWarningsState = {
	results: [],
	selectedRules: new Set(),
	searchQuery: '',
	page: 1,
	pageSize: 25,
	scanning: false,
	checkedStrings: 0,
	ui: {},
};

/**
 * 現在の GlotPress 画面に、保存済み初期値と異なる訳文が残っているか確認する。
 *
 * 保存前の訳文をサーバー側 PO 出力で上書きして確認しないため、全件確認の開始条件として使用する。
 *
 * @param {Document|Object} root 判定対象の GlotPress 画面またはテスト用文書。
 * @returns {boolean} 1件でも未保存の訳文がある場合は true。
 */
function wpgpt_all_page_warnings_has_unsaved_translations( root = document ) {
	// 画面上のすべての訳文フォームを確認し、1件でも保存済み初期値と異なれば未保存ありとする。
	return Array.from(
		root.querySelectorAll(
			'#translations tbody tr.editor .translation-wrapper div.textareas textarea'
		)
	).some( ( textarea ) => textarea.value !== textarea.defaultValue );
}

/**
 * 全件確認の進行状況・成功・注意・失敗を利用者へ表示する。
 *
 * @param {string} text 表示する状態メッセージ。
 * @param {string} state 表示種別を示す状態名。通常表示では空文字列。
 * @returns {void}
 */
function wpgpt_all_page_warnings_set_status( text, state = '' ) {
	const status = wpgptAllPageWarningsState.ui.status;
	// 状態種別が指定された場合だけ対応する表示用クラスを追加する。
	status.className = 'wpgpt-all-page-warnings__status' + ( state ? ' is-' + state : '' );
	status.textContent = text;
	status.hidden = false;
}

/**
 * 全件確認の実行中状態を画面と共有し、重複実行につながる操作を抑止する。
 *
 * @param {boolean} scanning 全件確認を実行中として扱うかどうか。
 * @returns {void}
 */
function wpgpt_all_page_warnings_set_scanning( scanning ) {
	wpgptAllPageWarningsState.scanning = scanning;
	wpgptAllPageWarningsState.ui.scan.disabled = scanning;
	wpgptAllPageWarningsState.ui.rescan.disabled = scanning;
}

/**
 * 全件確認結果に含まれる日本語ルール別の指摘件数を集計する。
 *
 * @param {Object[]} results 全件確認で Warning が見つかった翻訳文字列。
 * @returns {Map<string, number>} ルール識別子ごとの指摘件数。
 */
function wpgpt_all_page_warnings_rule_counts( results ) {
	const counts = new Map();
	// すべての結果文字列を対象に、日本語ルールごとの指摘件数を集計する。
	results.forEach( ( result ) => {
		// 1文字列に複数ルールの指摘があるため、各指摘を個別に件数へ反映する。
		result.japaneseFindings.forEach( ( finding ) => {
			// 初出ルールは0件から開始し、指摘1件ごとに加算する。
			counts.set( finding.setting, ( counts.get( finding.setting ) || 0 ) + 1 );
		} );
	} );
	return counts;
}

/**
 * 実際に指摘が存在する日本語ルールだけを絞り込み候補として作成する。
 *
 * @param {Object[]} results 全件確認で Warning が見つかった翻訳文字列。
 * @returns {Object[]} 件数表示を含む絞り込み候補。
 */
function wpgpt_all_page_warnings_rule_options( results ) {
	const counts = wpgpt_all_page_warnings_rule_counts( results );
	return WPGPT_ALL_PAGE_WARNING_RULES
		// 定義済みの各ルールへ、今回の走査結果における指摘件数を付与する。
		.map( ( rule ) => {
			const count = counts.get( rule.setting ) || 0;
			return {
				...rule,
				count,
				countLabel: count + '件',
			};
		} )
		// 指摘0件のルールは選んでも結果が変わらないため、絞り込み候補には表示しない。
		.filter( ( rule ) => 0 < rule.count );
}

/**
 * 現在の全件確認結果に基づいて、ルール絞り込みの選択肢を再構築する。
 *
 * @returns {void}
 */
function wpgpt_all_page_warnings_render_rule_options() {
	const container = wpgptAllPageWarningsState.ui.ruleOptions;
	container.replaceChildren();

	const close = wpgpt_all_page_warnings_create_element(
		'button',
		'button wpgpt-all-page-warnings__rule-close',
		'× 閉じる'
	);
	close.type = 'button';
	close.addEventListener( 'click', () => {
		container.closest( 'details' ).open = false;
	} );
	container.appendChild( close );

	// 今回の走査で実際に指摘があるルールごとに、選択可能な項目を作成する。
	wpgpt_all_page_warnings_rule_options( wpgptAllPageWarningsState.results ).forEach( ( rule ) => {
		const label = wpgpt_all_page_warnings_create_element( 'label', 'wpgpt-all-page-warnings__rule' );
		const checkbox = document.createElement( 'input' );
		checkbox.type = 'checkbox';
		checkbox.value = rule.setting;
		checkbox.checked = wpgptAllPageWarningsState.selectedRules.has( rule.setting );
		checkbox.addEventListener( 'change', () => {
			// チェック状態を現在の絞り込み条件へ反映し、解除時は条件から取り除く。
			if ( checkbox.checked ) {
				wpgptAllPageWarningsState.selectedRules.add( rule.setting );
			} else {
				wpgptAllPageWarningsState.selectedRules.delete( rule.setting );
			}
			wpgptAllPageWarningsState.page = 1;
			wpgpt_all_page_warnings_render();
		} );
		label.append(
			checkbox,
			wpgpt_all_page_warnings_create_element( 'span', '', rule.label ),
			wpgpt_all_page_warnings_create_element( 'small', '', rule.countLabel )
		);
		container.appendChild( label );
	} );
}

/**
 * 現在選択中の絞り込みルールを、解除可能な表示として反映する。
 *
 * @returns {void}
 */
function wpgpt_all_page_warnings_render_chips() {
	const chips = wpgptAllPageWarningsState.ui.chips;
	chips.replaceChildren();

	// 定義済みルールを確認し、現在選択されているものだけを解除用表示として並べる。
	WPGPT_ALL_PAGE_WARNING_RULES.forEach( ( rule ) => {
		// 未選択ルールは現在の絞り込み状態を表さないため表示しない。
		if ( ! wpgptAllPageWarningsState.selectedRules.has( rule.setting ) ) {
			return;
		}
		const chip = wpgpt_all_page_warnings_create_element( 'span', 'wpgpt-all-page-warnings__chip' );
		chip.appendChild( wpgpt_all_page_warnings_create_element( 'span', '', rule.label ) );
		const remove = wpgpt_all_page_warnings_create_element( 'button', '', '×' );
		remove.type = 'button';
		remove.setAttribute( 'aria-label', rule.label + ' の絞り込みを解除' );
		remove.addEventListener( 'click', () => {
			wpgptAllPageWarningsState.selectedRules.delete( rule.setting );
			wpgptAllPageWarningsState.page = 1;
			wpgpt_all_page_warnings_render_rule_options();
			wpgpt_all_page_warnings_render();
		} );
		chip.appendChild( remove );
		chips.appendChild( chip );
	} );
}

/**
 * 1件の Warning を結果カード内の一覧項目として作成する。
 *
 * @param {Object} warning 表示対象の Warning。
 * @param {boolean} multipleForms 複数の訳文フォームを区別して表示する必要があるかどうか。
 * @returns {HTMLElement} Warning の一覧項目。
 */
function wpgpt_all_page_warnings_warning_item( warning, multipleForms, result ) {
	const item = wpgpt_all_page_warnings_create_element( 'li', 'wpgpt-all-page-warnings__warning' );
	// 日本語ルール由来の Warning だけにルール識別表示を付け、既存の一般 Warning と区別する。
	if ( warning.setting ) {
		// 表示名を得るため、Warning のルール識別子に対応する定義を検索する。
		const rule = WPGPT_ALL_PAGE_WARNING_RULES.find( ( candidate ) => candidate.setting === warning.setting );
		item.appendChild(
			wpgpt_all_page_warnings_create_element(
				'span',
				'wpgpt-all-page-warnings__badge',
				// 定義済みルールはガイド番号を表示し、未知のルールでも識別子を失わない。
				rule ? rule.label.split( ' ' )[ 0 ] : warning.setting
			)
		);
	}
	// 複数フォームがある場合だけフォーム番号を付け、どの訳文への指摘かを明確にする。
	const text = multipleForms ? 'Form #' + warning.form + ': ' + warning.text : warning.text;
	item.appendChild( wpgpt_all_page_warnings_create_element( 'span', '', text ) );

	const copyWrap = wpgpt_all_page_warnings_create_element( 'span', 'wpgpt-all-page-warnings__warning-copy' );
	const copy = wpgpt_all_page_warnings_create_element( 'button', 'button button-small', 'この指摘をコピー' );
	copy.type = 'button';
	copy.setAttribute( 'aria-label', 'この指摘を Slack 用にコピー' );
	const copyStatus = wpgpt_all_page_warnings_create_element( 'small', 'wpgpt-all-page-warnings__copy-status' );
	copy.addEventListener( 'click', async () => {
		copyStatus.textContent = '';
		try {
			await wpgpt_all_page_warnings_copy_text(
				wpgpt_all_page_warnings_slack_single( result, warning )
			);
			copyStatus.textContent = '✓ コピーしました';
		} catch ( error ) {
			copyStatus.textContent = 'コピーできませんでした';
		}
	} );
	copyWrap.append( copy, copyStatus );
	item.appendChild( copyWrap );
	return item;
}

/**
 * 1つの翻訳文字列について、原文・訳文・Warning・GlotPress 確認導線をまとめた結果カードを作成する。
 *
 * @param {Object} result 表示対象の全件確認結果。
 * @returns {HTMLElement} 結果一覧へ追加するカード。
 */
function wpgpt_all_page_warnings_result_card( result ) {
	const card = wpgpt_all_page_warnings_create_element( 'article', 'wpgpt-all-page-warnings__card' );
	const head = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__card-head' );
	// 文脈付き翻訳では文脈を見出しに示し、同じ原文の別用途を区別できるようにする。
	const sourceLabel = result.context ? 'Context: ' + result.context : '翻訳文字列';
	head.appendChild( wpgpt_all_page_warnings_create_element( 'strong', '', sourceLabel ) );
	const open = wpgpt_all_page_warnings_create_element( 'a', 'button', 'GlotPressで確認' );
	open.href = result.sourceUrl;
	open.target = '_blank';
	open.rel = 'noopener';
	head.appendChild( open );
	card.appendChild( head );

	const body = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__card-body' );
	const original = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__field' );
	original.append(
		wpgpt_all_page_warnings_create_element( 'strong', '', '原文' ),
		wpgpt_all_page_warnings_create_element( 'div', '', result.original )
	);
	const translated = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__field' );
	const translatedText = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__translation' );
	// 複数形を含む各訳文フォームを順に表示し、それぞれの問題箇所を強調する。
	result.translations.forEach( ( translation, index ) => {
		// 2フォーム目以降は改行で区切り、各訳文の境界を保持する。
		if ( 0 < index ) {
			translatedText.appendChild( document.createTextNode( '\n' ) );
		}
		const ranges = wpgpt_all_page_warnings_highlight_ranges(
			result,
			index + 1,
			wpgptAllPageWarningsState.selectedRules,
			translation.length
		);
		wpgpt_all_page_warnings_append_highlighted_text( translatedText, translation, ranges );
	} );
	translated.append(
		wpgpt_all_page_warnings_create_element( 'strong', '', '訳文' ),
		translatedText
	);
	const warnings = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__warnings' );
	warnings.appendChild( wpgpt_all_page_warnings_create_element( 'strong', '', 'Warnings' ) );
	const list = document.createElement( 'ul' );
	// 複数の訳文フォームがある場合だけ、各 Warning にフォーム番号を表示する。
	const multipleForms = result.translations.length > 1;
	// 現在の絞り込み条件で表示対象となった Warning をすべてカードへ並べる。
	result.displayWarnings.forEach( ( warning ) => {
		list.appendChild( wpgpt_all_page_warnings_warning_item( warning, multipleForms, result ) );
	} );
	warnings.appendChild( list );
	body.append( original, translated, warnings );
	card.appendChild( body );
	return card;
}

/**
 * 結果ページ移動用の操作を描画する。
 *
 * ページ数が多い場合は、現在ページ付近と両端を優先して表示し、中間の連続範囲を省略記号でまとめる。
 *
 * @param {Object} pageInfo 現在ページ、総ページ数などのページ情報。
 * @param {HTMLElement} pagination ページ操作を描画する表示先。
 * @returns {void}
 */
function wpgpt_all_page_warnings_render_pagination( pageInfo, pagination ) {
	pagination.replaceChildren();
	// 1ページで収まる結果ではページ移動操作を表示しない。
	if ( pageInfo.totalPages <= 1 ) {
		return;
	}

	/**
	 * 1つのページ移動ボタンを追加する。
	 *
	 * @param {string} label ボタンに表示する文字列。
	 * @param {number} page 選択時に移動する結果ページ。
	 * @param {boolean} disabled 現在位置の都合で操作不可にするかどうか。
	 * @param {boolean} active 現在表示中ページとして強調するかどうか。
	 * @returns {void}
	 */
	const addButton = ( label, page, disabled = false, active = false ) => {
		// 現在ページのボタンだけを選択中として見分けられる表示にする。
		const button = wpgpt_all_page_warnings_create_element( 'button', active ? 'is-active' : '', label );
		button.type = 'button';
		button.disabled = disabled;
		button.addEventListener( 'click', () => {
			wpgptAllPageWarningsState.page = page;
			wpgpt_all_page_warnings_render();
			wpgptAllPageWarningsState.ui.root.scrollIntoView( { block: 'start' } );
		} );
		pagination.appendChild( button );
	};

	addButton( '←', pageInfo.page - 1, 1 === pageInfo.page );
	// 全ページ番号を評価し、現在ページ付近と両端だけを利用者が直接選べる形で表示する。
	for ( let page = 1; page <= pageInfo.totalPages; page++ ) {
		const nearCurrent = Math.abs( page - pageInfo.page ) <= 1;
		const edge = page <= 2 || page > pageInfo.totalPages - 2;
		// 現在ページから離れた中間ページは個別表示せず、省略範囲としてまとめる。
		if ( ! nearCurrent && ! edge ) {
			// 連続する省略範囲には省略記号を1つだけ表示する。
			if ( ! pagination.lastElementChild?.classList.contains( 'is-dots' ) ) {
				pagination.appendChild( wpgpt_all_page_warnings_create_element( 'span', 'is-dots', '…' ) );
			}
			continue;
		}
		addButton( String( page ), page, false, page === pageInfo.page );
	}
	addButton( '→', pageInfo.page + 1, pageInfo.page === pageInfo.totalPages );
}

/**
 * 現在の走査結果・絞り込み条件・ページ設定を結果画面へ反映する。
 *
 * @returns {void}
 */
function wpgpt_all_page_warnings_render() {
	const filtered = wpgpt_all_page_warnings_apply_filters(
		wpgptAllPageWarningsState.results,
		wpgptAllPageWarningsState.selectedRules,
		wpgptAllPageWarningsState.searchQuery
	);
	const summary = wpgpt_all_page_warnings_summarize( filtered );
	const pageInfo = wpgpt_all_page_warnings_paginate(
		filtered,
		wpgptAllPageWarningsState.page,
		wpgptAllPageWarningsState.pageSize
	);
	wpgptAllPageWarningsState.page = pageInfo.page;

	wpgptAllPageWarningsState.ui.warningCount.textContent = String( summary.warnings );
	wpgptAllPageWarningsState.ui.stringCount.textContent = String( summary.strings );
	wpgptAllPageWarningsState.ui.checkedCount.textContent = String( wpgptAllPageWarningsState.checkedStrings );
	wpgptAllPageWarningsState.ui.results.replaceChildren();

	// 現在の絞り込み・ページ条件で表示項目がない場合は、結果カードの代わりに理由を表示する。
	if ( ! pageInfo.items.length ) {
		wpgptAllPageWarningsState.ui.results.appendChild(
			wpgpt_all_page_warnings_create_element(
				'div',
				'wpgpt-all-page-warnings__empty',
				// 元の走査結果がある場合は絞り込み0件、ない場合は Warning 0件として案内を分ける。
				wpgptAllPageWarningsState.results.length ?
					'現在の絞り込み条件に一致する Warning はありません。' :
					'Warning は見つかりませんでした。'
			)
		);
	} else {
		// 現在ページに属する各翻訳文字列を結果カードとして表示する。
		pageInfo.items.forEach( ( result ) => {
			wpgptAllPageWarningsState.ui.results.appendChild(
				wpgpt_all_page_warnings_result_card( result )
			);
		} );
	}

	// 表示対象がない場合は範囲開始を0とし、空結果でも件数表示を自然に保つ。
	const first = summary.strings ? pageInfo.start + 1 : 0;
	const last = Math.min( pageInfo.start + pageInfo.items.length, summary.strings );
	wpgptAllPageWarningsState.ui.range.textContent =
		first + '–' + last + ' / ' + summary.strings + '文字列';
	wpgptAllPageWarningsState.ui.resultPage.textContent =
		'結果ページ ' + pageInfo.page + ' / ' + pageInfo.totalPages;
	wpgptAllPageWarningsState.ui.content.hidden = false;
	wpgpt_all_page_warnings_render_chips();
	wpgpt_all_page_warnings_render_pagination( pageInfo, wpgptAllPageWarningsState.ui.paginationTop );
	wpgpt_all_page_warnings_render_pagination( pageInfo, wpgptAllPageWarningsState.ui.paginationBottom );
}

/**
 * 新しい全件確認を開始する前に、前回の結果表示と絞り込み状態を初期化する。
 *
 * @returns {void}
 */
function wpgpt_all_page_warnings_reset_results() {
	wpgptAllPageWarningsState.results = [];
	wpgptAllPageWarningsState.selectedRules.clear();
	wpgptAllPageWarningsState.searchQuery = '';
	wpgptAllPageWarningsState.page = 1;
	wpgptAllPageWarningsState.checkedStrings = 0;
	wpgptAllPageWarningsState.ui.content.hidden = true;
	if ( wpgptAllPageWarningsState.ui.search ) {
		wpgptAllPageWarningsState.ui.search.value = '';
	}
	if ( wpgptAllPageWarningsState.ui.copyStatus ) {
		wpgptAllPageWarningsState.ui.copyStatus.textContent = '';
	}
	wpgptAllPageWarningsState.ui.results.replaceChildren();
	wpgptAllPageWarningsState.ui.paginationTop.replaceChildren();
	wpgptAllPageWarningsState.ui.paginationBottom.replaceChildren();
}

/**
 * 現在の GlotPress 絞り込み条件を対象として全件 Warning 確認を実行する。
 *
 * 二重実行と未保存訳文がある状態での走査を禁止し、取得・解析・表示の一連の処理中は
 * 操作を無効化する。終了時は成功・失敗にかかわらず操作可能状態へ戻す。
 *
 * @returns {Promise<void>}
 */
async function wpgpt_all_page_warnings_scan() {
	// 走査中の再実行は同じ結果領域と取得処理を競合させるため受け付けない。
	if ( wpgptAllPageWarningsState.scanning ) {
		return;
	}

	// サーバー側 PO に未保存の編集が含まれないため、未保存訳文がある間は全件確認を開始しない。
	if ( wpgpt_all_page_warnings_has_unsaved_translations() ) {
		wpgpt_all_page_warnings_set_status(
			'未保存の編集があります。翻訳を保存してから、もう一度全件確認を実行してください。',
			'warning'
		);
		return;
	}

	wpgpt_all_page_warnings_reset_results();
	wpgpt_all_page_warnings_set_scanning( true );
	wpgpt_all_page_warnings_set_status( '翻訳データを取得しています…' );

	try {
		const exportUrl = wpgpt_all_page_warnings_build_export_url();
		const po = await wpgpt_all_page_warnings_fetch_po( exportUrl );
		const entries = wpgpt_all_page_warnings_parse_po( po );
		wpgpt_all_page_warnings_set_status( entries.length + '件の翻訳データを確認しています…' );

		const analyzed = wpgpt_all_page_warnings_analyze_entries( entries, exportUrl );
		wpgptAllPageWarningsState.results = analyzed.results;
		wpgptAllPageWarningsState.checkedStrings = analyzed.checkedStrings;

		wpgpt_all_page_warnings_set_status(
			'✓ ' + wpgptAllPageWarningsState.checkedStrings + '件の翻訳文字列を確認しました。',
			'success'
		);
		wpgpt_all_page_warnings_render_rule_options();
		wpgpt_all_page_warnings_render();
		wpgptAllPageWarningsState.ui.scan.textContent = 'Scan again';
	} catch ( error ) {
		wpgpt_all_page_warnings_set_status(
			'Scan incomplete. ' + error.message,
			'error'
		);
	} finally {
		wpgpt_all_page_warnings_set_scanning( false );
	}
}

/**
 * 全件確認の操作領域、状態表示、集計、絞り込み、結果一覧、ページ操作を構築する。
 *
 * @returns {HTMLElement} GlotPress 画面へ挿入する全件確認 UI。
 */
function wpgpt_all_page_warnings_build_ui() {
	const root = wpgpt_all_page_warnings_create_element( 'section', 'wpgpt-all-page-warnings' );
	const head = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__head' );
	const titleWrap = document.createElement( 'div' );
	titleWrap.append(
		wpgpt_all_page_warnings_create_element( 'h2', '', '全件の Warning を確認' ),
		wpgpt_all_page_warnings_create_element(
			'p',
			'',
			'現在の検索・ステータス等を反映した翻訳データを一度だけ取得し、ブラウザー内で Warning を確認します。'
		)
	);
	const scan = wpgpt_all_page_warnings_create_element( 'button', 'button is-primary', 'Scan all warnings' );
	scan.type = 'button';
	scan.addEventListener( 'click', wpgpt_all_page_warnings_scan );
	head.append( titleWrap, scan );
	root.appendChild( head );

	const status = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__status' );
	status.hidden = true;
	root.appendChild( status );

	const content = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__content' );
	content.hidden = true;
	const snapshot = wpgpt_all_page_warnings_create_element(
		'p',
		'wpgpt-all-page-warnings__snapshot',
		'この一覧は走査時点の結果です。翻訳を修正した後は「Scan again」を実行してください。'
	);
	content.appendChild( snapshot );

	const metrics = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__metrics' );
	/**
	 * 集計値と説明を組み合わせた表示要素を追加する。
	 *
	 * @param {string} label 集計値の意味を示す表示名。
	 * @returns {HTMLElement} 後から件数を書き換える数値要素。
	 */
	const createMetric = ( label ) => {
		const metric = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__metric' );
		const value = wpgpt_all_page_warnings_create_element( 'strong', '', '0' );
		metric.append( value, wpgpt_all_page_warnings_create_element( 'span', '', label ) );
		metrics.appendChild( metric );
		return value;
	};
	const warningCount = createMetric( 'Warning' );
	const stringCount = createMetric( '影響する文字列' );
	const checkedCount = createMetric( '確認した翻訳文字列' );
	content.appendChild( metrics );

	const filters = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__filters' );
	const details = document.createElement( 'details' );
	const summary = wpgpt_all_page_warnings_create_element( 'summary', 'button', 'ルールで絞り込む' );
	details.appendChild( summary );
	const ruleOptions = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__rule-options' );
	details.appendChild( ruleOptions );
	const clear = wpgpt_all_page_warnings_create_element( 'button', 'button', 'すべて解除' );
	clear.type = 'button';
	clear.addEventListener( 'click', () => {
		wpgptAllPageWarningsState.selectedRules.clear();
		wpgptAllPageWarningsState.page = 1;
		wpgpt_all_page_warnings_render_rule_options();
		wpgpt_all_page_warnings_render();
	} );
	details.appendChild( clear );
	const search = document.createElement( 'input' );
	search.type = 'search';
	search.className = 'wpgpt-all-page-warnings__search';
	search.placeholder = '原文・訳文・Contextを検索';
	search.setAttribute( 'aria-label', '原文・訳文・Contextを検索' );
	search.addEventListener( 'input', () => {
		wpgptAllPageWarningsState.searchQuery = search.value;
		wpgptAllPageWarningsState.page = 1;
		wpgpt_all_page_warnings_render();
	} );

	const copyAll = wpgpt_all_page_warnings_create_element( 'button', 'button', 'Slack用にコピー' );
	copyAll.type = 'button';
	const copyStatus = wpgpt_all_page_warnings_create_element(
		'span',
		'wpgpt-all-page-warnings__copy-status'
	);
	copyAll.addEventListener( 'click', async () => {
		const filtered = wpgpt_all_page_warnings_apply_filters(
			wpgptAllPageWarningsState.results,
			wpgptAllPageWarningsState.selectedRules,
			wpgptAllPageWarningsState.searchQuery
		);
		copyStatus.textContent = '';
		if ( ! filtered.length ) {
			copyStatus.textContent = 'コピー対象がありません';
			return;
		}
		try {
			await wpgpt_all_page_warnings_copy_text(
				wpgpt_all_page_warnings_slack_all(
					filtered,
					wpgptAllPageWarningsState.selectedRules,
					wpgptAllPageWarningsState.searchQuery
				)
			);
			copyStatus.textContent = '✓ Slack用テキストをコピーしました（' + filtered.length + '文字列）';
		} catch ( error ) {
			copyStatus.textContent = 'Slack用テキストをコピーできませんでした';
		}
	} );

	const chips = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__chips' );
	filters.append( details, search, copyAll, copyStatus, chips );
	content.appendChild( filters );

	const toolbar = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__toolbar' );
	const range = wpgpt_all_page_warnings_create_element( 'strong', '', '0–0 / 0文字列' );
	const pageSize = document.createElement( 'select' );
	// 利用者が結果量に応じて選べる既定の表示件数を選択肢として用意する。
	[ 25, 50, 100 ].forEach( ( size ) => {
		const option = document.createElement( 'option' );
		option.value = String( size );
		option.textContent = size + '件ずつ';
		pageSize.appendChild( option );
	} );
	pageSize.addEventListener( 'change', () => {
		wpgptAllPageWarningsState.pageSize = Number.parseInt( pageSize.value, 10 );
		wpgptAllPageWarningsState.page = 1;
		wpgpt_all_page_warnings_render();
	} );
	const resultPage = wpgpt_all_page_warnings_create_element( 'span', '', '結果ページ 1 / 1' );
	const rescan = wpgpt_all_page_warnings_create_element( 'button', 'button', 'Scan again' );
	rescan.type = 'button';
	rescan.addEventListener( 'click', wpgpt_all_page_warnings_scan );
	toolbar.append( range, pageSize, resultPage, rescan );
	content.appendChild( toolbar );

	const paginationTop = wpgpt_all_page_warnings_create_element(
		'div',
		'wpgpt-all-page-warnings__pagination is-top'
	);
	const results = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__results' );
	const paginationBottom = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__pagination' );
	content.append( paginationTop, results, paginationBottom );
	root.appendChild( content );

	wpgptAllPageWarningsState.ui = {
		root,
		scan,
		rescan,
		status,
		content,
		warningCount,
		stringCount,
		checkedCount,
		ruleOptions,
		search,
		copyAll,
		copyStatus,
		chips,
		range,
		resultPage,
		results,
		paginationTop,
		paginationBottom,
	};

	return root;
}

/**
 * GlotPress の翻訳一覧画面に全件確認 UI を1度だけ組み込む。
 *
 * 対象画面でない場合や、すでに UI が存在する場合は何も行わない。
 *
 * @returns {void}
 */
function wpgpt_init_all_page_warnings() {
	const translations = document.querySelector( '#translations' );
	// 翻訳一覧でない画面、またはすでに初期化済みの画面では UI を追加しない。
	if ( ! translations || document.querySelector( '.wpgpt-all-page-warnings' ) ) {
		return;
	}

	const paging = document.querySelector( '.paging' );
	// 規定の挿入位置を確認できない画面では、既存画面を崩さないため UI を追加しない。
	if ( ! paging ) {
		return;
	}

	const ui = wpgpt_all_page_warnings_build_ui();
	paging.insertAdjacentElement( 'afterend', ui );
}

/**
 * 単体テストから仕様上の境界を直接検証するための公開 API。
 *
 * 本番 UI の利用者向け API ではなく、全件確認の判定・変換規則をテストするために公開する。
 */
globalThis.wpgpt_all_page_warnings_test_api = {
	hasUnsavedTranslations: wpgpt_all_page_warnings_has_unsaved_translations,
	normalizeResult: wpgpt_all_page_warnings_normalize_result,
	filterResults: wpgpt_all_page_warnings_filter_results,
	searchResults: wpgpt_all_page_warnings_search_results,
	applyFilters: wpgpt_all_page_warnings_apply_filters,
	summarize: wpgpt_all_page_warnings_summarize,
	paginate: wpgpt_all_page_warnings_paginate,
	ruleOptions: wpgpt_all_page_warnings_rule_options,
	collectJapaneseFindings: wpgpt_all_page_warnings_collect_japanese_findings,
	highlightRanges: wpgpt_all_page_warnings_highlight_ranges,
	normalizeRanges: wpgpt_all_page_warnings_normalize_ranges,
	slackLiteral: wpgpt_all_page_warnings_slack_literal,
	slackProblemText: wpgpt_all_page_warnings_slack_problem_text,
	slackAll: wpgpt_all_page_warnings_slack_all,
	slackSingle: wpgpt_all_page_warnings_slack_single,
	copyText: wpgpt_all_page_warnings_copy_text,
	buildExportUrl: wpgpt_all_page_warnings_build_export_url,
	buildSourceUrl: wpgpt_all_page_warnings_build_source_url,
	isPo: wpgpt_all_page_warnings_is_po,
	parsePo: wpgpt_all_page_warnings_parse_po,
};

// ブラウザー画面で読み込まれた場合だけ自動初期化し、単体テスト環境では明示呼び出しに任せる。
if ( 'undefined' !== typeof document && 'undefined' !== typeof window ) {
	wpgpt_init_all_page_warnings();
}
