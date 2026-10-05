/**
 * GlotPress の翻訳一覧を対象に、現在の絞り込み条件に対応する翻訳データを一括確認する機能を提供する。
 *
 * このファイルは、全件確認の開始条件、取得した翻訳データの解析、指摘結果の保持、
 * 絞り込み・検索・ページ分割、問題箇所の表示、Slack 共有用文字列の生成、結果画面の状態管理を所有する。
 * 翻訳の保存処理そのものは所有せず、保存前の編集がある場合はサーバー側データとの不一致を避けるため確認を開始しない。
 */

/* global wpgpt_settings, wpgpt_is_japanese_locale, wpgpt_run_checks, wpgpt_ja_check_punctuation, wpgpt_ja_check_half_width, wpgpt_ja_check_half_full_spacing, wpgpt_ja_check_parentheses, wpgpt_ja_check_inner_parentheses_spacing, wpgpt_ja_check_period_inside_parentheses, wpgpt_ja_check_sentence_ending_parentheses, wpgpt_ja_check_number_spacing, wpgpt_ja_check_recommended_expressions, wpgpt_ja_check_view_expression, wpgpt_ja_check_not_allowed_expression, wpgpt_ja_check_sorry_prefix, wpgpt_ja_check_middle_dot */

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
	// 構造化された日本語指摘は既存 Warning の補完にだけ使い、同じ指摘を追加件数として扱わない。
	const unusedFindings = ( result.japaneseFindings || [] ).map( ( finding ) => ( {
		...finding,
		used: false,
	} ) );

	// 既存 Warning を基準に1件ずつ補完し、正規化前後で Warning の論理件数を維持する。
	const displayWarnings = result.warnings.map( ( warning ) => {
		// 同じ訳文フォーム・同じ指摘内容に対応する未使用の日本語指摘だけを補完元として採用する。
		const finding = unusedFindings.find( ( candidate ) =>
			! candidate.used &&
			candidate.form === warning.form &&
			candidate.style_guide_item + ': ' + candidate.message === warning.text
		);
		// 対応する日本語指摘がない一般 Warning は既存情報を保持し、位置情報なしとして共通形式へ揃える。
		if ( ! finding ) {
			return {
				...warning,
				// 位置情報を持たない Warning も後続処理で同じ契約として扱えるよう、範囲は常に配列にする。
				matches: Array.isArray( warning.matches ) ? warning.matches : [],
			};
		}

		finding.used = true;
		return {
			...warning,
			setting: finding.setting,
			styleGuideItem: finding.style_guide_item,
			// 構造化指摘に位置情報がない場合も、問題箇所を推測せず空配列として扱う。
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
	// 絞り込みの有無にかかわらず、すべての結果を同じ Warning 表現へ揃えてから表示条件を適用する。
	const normalized = results.map( wpgpt_all_page_warnings_normalize_result );

	// ルール未選択時は Warning を減らさず、正規化済みの全結果を表示対象とする。
	if ( ! selectedRules || 0 === selectedRules.size ) {
		return normalized;
	}

	// 各翻訳文字列について選択ルールに該当する Warning だけを残し、該当文字列だけを結果集合へ含める。
	return normalized.reduce( ( filtered, result ) => {
		// 複数ルール選択は OR 条件とし、いずれかの選択ルールに属する Warning を表示対象とする。
		const matching = result.displayWarnings.filter(
			( warning ) => warning.setting && selectedRules.has( warning.setting )
		);
		// 表示対象 Warning が1件以上ある翻訳文字列だけを、絞り込み後の一覧へ残す。
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
	// 空の検索条件は検索なしとして扱い、ルール絞り込み後の結果をそのまま保持する。
	if ( ! query ) {
		return results;
	}

	// 各翻訳文字列を独立して判定し、検索対象のいずれかに部分一致する項目だけを残す。
	return results.filter( ( result ) => {
		const searchable = [
			result.original,
			result.context || '',
			...( result.translations || [] ),
		];
		// 原文・文脈・すべての訳文フォームのいずれかに一致すれば、その翻訳文字列を検索結果とする。
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
			// 単数形の訳文はフォーム0として扱い、複数形では PO に記録されたフォーム番号をそのまま使用する。
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
 * 指摘位置を、画面表示と共有用出力で共通利用できる安全な範囲へ正規化する。
 *
 * 訳文の外側を指す位置は文字列境界へ収め、成立しない範囲は除外する。
 * 重複または連続する範囲は1つに統合し、同じ問題箇所を重ねて表示しない。
 *
 * @param {Object[]} matches 指摘が示す開始位置と終了位置の集合。
 * @param {number} textLength 対象訳文の文字数。
 * @returns {Object[]} 表示可能な範囲へ補正・統合した指摘位置。
 */
function wpgpt_all_page_warnings_normalize_ranges( matches, textLength ) {
	// 位置情報がない Warning も同じ契約で扱い、存在する指摘だけを訳文の有効範囲へ収める。
	const ranges = ( Array.isArray( matches ) ? matches : [] )
		// 各指摘は訳文の先頭から末尾までの範囲を越えない位置として扱う。
		.map( ( match ) => ( {
			start: Math.max( 0, Math.min( textLength, match.start ) ),
			end: Math.max( 0, Math.min( textLength, match.end ) ),
		} ) )
		// 開始・終了位置が整数で、実際に1文字以上を指す範囲だけを表示対象とする。
		.filter( ( match ) => Number.isInteger( match.start ) && Number.isInteger( match.end ) && match.start < match.end )
		.sort( ( a, b ) => a.start - b.start || a.end - b.end );

	// 位置順に確認し、重複または連続する指摘を一つの表示範囲へまとめる。
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

/**
 * 現在の表示条件に対応する訳文フォームについて、強調表示する問題位置を決定する。
 *
 * 対象フォームに属し、現在のルール絞り込みで除外されていない Warning の位置情報だけを使用する。
 * 問題位置を持たない Warning から位置を推測せず、正規化処理と同じ境界規則を適用する。
 *
 * @param {Object} result 1翻訳文字列分の全件確認結果。
 * @param {number} form 強調対象の訳文フォーム番号。
 * @param {Set<string>} selectedRules 現在選択中の絞り込みルール。
 * @param {number} textLength 対象訳文の文字数。
 * @returns {Object[]} 現在の表示条件で強調する問題位置。
 */
function wpgpt_all_page_warnings_highlight_ranges( result, form, selectedRules, textLength ) {
	// 画面表示用に正規化済みの Warning を優先し、旧形式の結果でも日本語指摘を参照できるようにする。
	const warnings = result.displayWarnings || result.japaneseFindings || [];
	const matches = warnings
		// 複数形では、現在表示している訳文フォームに属する指摘だけを対象とする。
		.filter( ( warning ) => warning.form === form )
		// ルール絞り込み中は、表示対象から外れた日本語ルールの問題位置を混在させない。
		.filter( ( warning ) => ! selectedRules?.size || ! warning.setting || selectedRules.has( warning.setting ) )
		// 位置情報を持つ Warning だけを強調対象とし、位置情報がない指摘は推測しない。
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
 * Warning の位置情報を使い、Slack で問題箇所を明示した確認用訳文を作成する。
 *
 * 記号や空白だけが問題箇所でも判別できるよう、Slack の太字記法には依存せず、
 * 対象範囲を「【...】」で囲む。正確な訳文は別途コードブロックで保持する。
 *
 * @param {string} translation 対象 Warning が属する訳文。
 * @param {Object} warning 表示対象の Warning。
 * @returns {string} 問題箇所を「【...】」で囲んだ確認用訳文。
 */
function wpgpt_all_page_warnings_slack_problem_text( translation, warning ) {
	const ranges = wpgpt_all_page_warnings_normalize_ranges(
		warning.matches,
		translation.length
	);
	// 位置情報がない Warning では問題箇所を推測せず、確認用訳文そのものを出力しない。
	if ( ! ranges.length ) {
		return '';
	}

	let cursor = 0;
	let output = '';
	// すべての問題範囲を訳文の並び順で示し、複数箇所の指摘でも同じ確認用訳文で判別できるようにする。
	ranges.forEach( ( range ) => {
		output += translation.slice( cursor, range.start );
		output += '【' + translation.slice( range.start, range.end ) + '】';
		cursor = range.end;
	} );
	return output + translation.slice( cursor );
}

/**
 * 1件の Warning を、Slack で共有するための独立した指摘ブロックへ変換する。
 *
 * 複数形では対象フォームを明示し、位置情報がある場合だけ問題箇所の確認用訳文を追加する。
 *
 * @param {Object} warning 共有対象の Warning。
 * @param {string} translation Warning が属する訳文。
 * @param {boolean} multipleForms 複数の訳文フォームを区別する必要があるかどうか。
 * @param {number|null} index 一覧内の Warning 番号。個別共有では番号を付けない。
 * @returns {string} Slack へ貼り付ける1件分の指摘ブロック。
 */
function wpgpt_all_page_warnings_slack_warning( warning, translation, multipleForms, index = null ) {
	const lines = [];
	// 一覧共有では順序を判別できる番号を付け、個別共有では単独の Warning 見出しとする。
	const heading = null === index ? '*Warning*' : '*Warning ' + index + '*';
	lines.push( heading );
	// 複数形の翻訳だけフォーム番号を表示し、単数形では不要な情報を増やさない。
	if ( multipleForms ) {
		lines.push( 'Form #' + warning.form );
	}
	lines.push( wpgpt_all_page_warnings_slack_literal( warning.text ) );

	const problemText = wpgpt_all_page_warnings_slack_problem_text( translation, warning );
	// 位置情報を持つ Warning だけ問題箇所表示を追加し、位置不明の指摘は Warning 文言だけを共有する。
	if ( problemText ) {
		lines.push(
			'',
			'*Problem location*',
			wpgpt_all_page_warnings_slack_literal( problemText )
		);
	}
	return lines.join( '\n' );
}

/**
 * 1つの翻訳文字列について、原文・訳文・対象 Warning・確認先を Slack 共有用にまとめる。
 *
 * 共有対象の Warning は呼び出し側から渡された集合だけを使用し、同じ文字列に属する非表示 Warning を混在させない。
 *
 * @param {Object} result 共有対象の翻訳文字列。
 * @param {Object[]} warnings 共有対象として確定済みの Warning。
 * @returns {string} Slack へ貼り付ける1翻訳文字列分の内容。
 */
function wpgpt_all_page_warnings_slack_result( result, warnings = result.displayWarnings ) {
	const lines = [];
	// 文脈がある翻訳では用途を判断できるよう共有し、文脈なしでは空の見出しを作らない。
	if ( result.context ) {
		lines.push( '*Context*', wpgpt_all_page_warnings_slack_literal( result.context ), '' );
	}
	lines.push( '*Original*', wpgpt_all_page_warnings_slack_literal( result.original ), '' );

	const multipleForms = result.translations.length > 1;
	// 複数形を含むすべての訳文フォームを共有し、一覧全体のレビューで原文との対応を失わない。
	result.translations.forEach( ( translation, index ) => {
		lines.push(
			// 複数フォームがある場合だけ番号を付け、各訳文を区別できる見出しにする。
			multipleForms ? '*Translation Form #' + ( index + 1 ) + '*' : '*Translation*',
			wpgpt_all_page_warnings_slack_literal( translation ),
			''
		);
	} );

	lines.push( '*Warnings*' );
	// 共有対象として確定した Warning を順に出力し、各指摘を対応する訳文フォームと組み合わせる。
	warnings.forEach( ( warning, index ) => {
		// 対応フォームが存在しない場合は位置表示を作らず、Warning 文言だけを共有できる空文字列とする。
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

/**
 * 現在の絞り込み条件に一致する結果全体を、Slack 共有用のレビュー文へ変換する。
 *
 * ページ表示には依存せず、呼び出し側で確定した全結果を対象とする。
 * 選択中ルールと検索条件はレビュー条件として先頭に示す。
 *
 * @param {Object[]} results 現在の絞り込み条件に一致する全結果。
 * @param {Set<string>} selectedRules 現在選択中の日本語翻訳ルール。
 * @param {string} searchQuery 現在の文字列検索条件。
 * @returns {string} Slack へ貼り付けるレビュー全文。
 */
function wpgpt_all_page_warnings_slack_all( results, selectedRules, searchQuery ) {
	const summary = wpgpt_all_page_warnings_summarize( results );
	// 選択中ルールだけをレビュー条件として示し、未選択ルールは共有内容へ含めない。
	const selectedLabels = WPGPT_ALL_PAGE_WARNING_RULES
		.filter( ( rule ) => selectedRules?.has( rule.setting ) )
		// 利用者が一覧で認識しているスタイルガイド番号だけを簡潔な条件表示へ使用する。
		.map( ( rule ) => rule.label.split( ' ' )[ 0 ] );

	const lines = [
		'*Warning レビュー*',
		'対象: ' + summary.strings + '文字列 / ' + summary.warnings + ' Warnings',
	];
	// ルールが選択されている場合だけ、レビュー対象を限定した条件として共有する。
	if ( selectedLabels.length ) {
		lines.push( 'ルール: ' + selectedLabels.join( ', ' ) );
	}
	// 空でない検索条件だけを共有し、検索なしのレビューには不要な条件欄を追加しない。
	if ( String( searchQuery || '' ).trim() ) {
		lines.push(
			'検索:',
			wpgpt_all_page_warnings_slack_literal( String( searchQuery ).trim() )
		);
	}

	// 絞り込み後の全翻訳文字列を共有し、ページングによってレビュー対象が欠落しないようにする。
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

/**
 * 利用者が選択した1件の Warning だけを Slack 共有用の内容へ変換する。
 *
 * 同じ翻訳文字列に別の Warning があっても混在させず、対象 Warning が属する訳文フォームだけを共有する。
 *
 * @param {Object} result 対象 Warning が属する翻訳文字列。
 * @param {Object} warning 利用者が個別共有を選択した Warning。
 * @returns {string} Slack へ貼り付ける1件分のレビュー内容。
 */
function wpgpt_all_page_warnings_slack_single( result, warning ) {
	// 対応フォームが存在しない場合でも Warning 文言と確認先は共有できるよう、訳文は空文字列として扱う。
	const translation = result.translations[ warning.form - 1 ] || '';
	const multipleForms = result.translations.length > 1;
	const lines = [];
	// 文脈がある場合だけ共有し、同一原文の用途をレビュー時に判別できるようにする。
	if ( result.context ) {
		lines.push( '*Context*', wpgpt_all_page_warnings_slack_literal( result.context ), '' );
	}
	lines.push(
		'*Original*',
		wpgpt_all_page_warnings_slack_literal( result.original ),
		'',
		// 複数形の一部だけを共有する場合も、元の訳文フォーム番号を失わない見出しにする。
		multipleForms ? '*Translation Form #' + warning.form + '*' : '*Translation*',
		wpgpt_all_page_warnings_slack_literal( translation ),
		'',
		wpgpt_all_page_warnings_slack_warning( warning, translation, false ),
		'',
		'*GlotPress*',
		result.sourceUrl
	);
	return lines.join( '\n' ).trim();
}

/**
 * 生成済みの共有文字列をクリップボードへ書き込み、完了後にだけ成功として扱える境界を提供する。
 *
 * @param {string} text クリップボードへ書き込む共有文字列。
 * @param {Object} clipboard 書き込みに使用する Clipboard API。単体テストでは代替実装を渡せる。
 * @returns {Promise<void>} クリップボードへの書き込み完了を表す Promise。
 * @throws {Error} Clipboard API を利用できない場合、または書き込みに失敗した場合。
 */
async function wpgpt_all_page_warnings_copy_text( text, clipboard = navigator.clipboard ) {
	// 書き込み機能を利用できない環境では成功扱いにせず、呼び出し側で失敗表示できるよう中止する。
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
			// 共有対象が変わるため、変更前の結果を示すコピー状態は残さない。
			wpgptAllPageWarningsState.ui.copyStatus.textContent = '';
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
			// 絞り込み解除で共有対象が変わるため、変更前のコピー状態を消す。
			wpgptAllPageWarningsState.ui.copyStatus.textContent = '';
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
 * @param {Object} result 対象 Warning が属する翻訳文字列。個別コピー内容の生成に使用する。
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
			// コピーが完了した場合だけ成功表示へ切り替え、利用者へ誤った完了状態を示さない。
			await wpgpt_all_page_warnings_copy_text(
				wpgpt_all_page_warnings_slack_single( result, warning )
			);
			copyStatus.textContent = '✓ コピーしました';
		} catch ( error ) {
			// 権限や実行環境の理由で失敗した場合は、成功表示を残さずこの指摘の近くで失敗を知らせる。
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
	// 検索欄が構築済みの場合だけ表示値も初期化し、再走査時に前回条件を持ち越さない。
	if ( wpgptAllPageWarningsState.ui.search ) {
		wpgptAllPageWarningsState.ui.search.value = '';
	}
	// コピー状態が構築済みの場合だけ前回の成功・失敗表示を消し、新しい走査結果と混同させない。
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
		// 取得・解析・判定のいずれかが失敗した場合は途中結果を成功扱いせず、走査未完了として通知する。
		wpgpt_all_page_warnings_set_status(
			'Scan incomplete. ' + error.message,
			'error'
		);
	} finally {
		// 成功・失敗にかかわらず操作抑止を解除し、利用者が再試行できる状態へ戻す。
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
		// 共有対象が全ルールへ戻るため、変更前のコピー状態を消す。
		wpgptAllPageWarningsState.ui.copyStatus.textContent = '';
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
		// 検索条件で共有対象が変わるため、変更前の件数を示すコピー状態を残さない。
		wpgptAllPageWarningsState.ui.copyStatus.textContent = '';
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
		// 現在の絞り込み条件に一致する結果がない場合は、空の共有内容をコピーせず利用者へ知らせる。
		if ( ! filtered.length ) {
			copyStatus.textContent = 'コピー対象がありません';
			return;
		}
		try {
			// 現在の絞り込み結果全体を書き込めた場合だけ、コピー成功を表示する。
			await wpgpt_all_page_warnings_copy_text(
				wpgpt_all_page_warnings_slack_all(
					filtered,
					wpgptAllPageWarningsState.selectedRules,
					wpgptAllPageWarningsState.searchQuery
				)
			);
			copyStatus.textContent = '✓ Slack用テキストをコピーしました（' + filtered.length + '文字列）';
		} catch ( error ) {
			// クリップボードへの書き込み失敗時は成功表示を出さず、利用者へ再試行可能な失敗として通知する。
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

// ブラウザー画面で読み込まれた場合だけ自動初期化し、単体テスト環境では明示呼び出しに任せる。
if ( 'undefined' !== typeof document && 'undefined' !== typeof window ) {
	wpgpt_init_all_page_warnings();
}
