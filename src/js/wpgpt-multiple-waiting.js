/**
 * 同一翻訳セットの複数 Waiting 提案を元の翻訳画面内で探す。
 * 検索の通信、取り消し、途中結果の所有権をこの画面に限定し、
 * 個別比較では既存の読み取り専用機能を利用する。
 */
( () => {
	'use strict';

	/** 意図しない大量アクセスを避けるための、空ページ確認を含む最大通信回数。 */
	const MAX_PAGES = 50;
	/** GlotPress への逐次取得の間隔。 */
	const PAGE_INTERVAL_MS = 1000;
	// 一覧の描画量を抑えるため、原文一覧の1ページを25件に制限する。
	const DISPLAY_SIZE = 25;
	// ページをまたいだ同一原文の提案を保持する。
	const groups = new Map();
	// 再登場した翻訳 ID の重複・内容矛盾を確認するための検索内照合情報。
	const translationIds = new Map();
	// 実行中検索の所有者と中止対象。同時に2件は保持しない。
	let session = null;
	// 元タブだけが所有する検索専用表示領域。
	let ui = null;
	// 検索 API のページとは独立した原文一覧の表示ページ。
	let page = 1;
	// Warning 条件は一覧表示だけに反映し、取得条件には適用しない。
	let warningOnly = false;
	// 現在の検索だけの進捗と停止理由。
	let stats = { pages: 0, records: 0, duplicates: 0, outcome: '' };

	/** @param {string} value 表示する文字列。 @param {string} tag HTML 要素名。 @returns {HTMLElement} 安全なテキスト要素。 */
	function el( value, tag = 'span' ) {
		const node = document.createElement( tag );
		node.textContent = value;
		return node;
	}

	/**
	 * API が返した提案の識別情報を検証する。
	 * @param {Object} row GlotPress の Waiting レコード。
	 * @returns {Object} 取得した提案の正規化済み情報。
	 */
	function normalize( row ) {
		/** @param {unknown} value API に含まれる原文または翻訳の ID。 @returns {boolean} 正の整数形式か。 */
		const validId = ( value ) => /^[1-9][0-9]*$/u.test( String( value ) );
		// Waiting 以外や識別不能な提案を誤って比較対象に含めないため、必要な項目と形式を検証する。
		if ( ! row || typeof row !== 'object' || Array.isArray( row ) ||
			! validId( row.id ) || ! validId( row.original_id ) ||
			( row.translation_status ?? row.status ) !== 'waiting' ||
			typeof row.singular !== 'string' ||
			( row.context != null && typeof row.context !== 'string' ) ||
			( row.plural != null && typeof row.plural !== 'string' ) ||
			! Array.isArray( row.translations ) ||
			! row.translations.length ||
			! row.translations.every( ( value ) => typeof value === 'string' ) ||
			( row.user != null && ( typeof row.user !== 'object' || Array.isArray( row.user ) ) ) ) {
			throw new Error( 'Waiting の翻訳データが不正です。' );
		}
		return {
			id: String( row.id ),
			originalId: String( row.original_id ),
			original: row.singular,
			context: row.context || null,
			plural: row.plural || null,
			translations: row.translations,
			user: row.user?.user_login || null,
		};
	}

	/**
	 * 翻訳 ID をページ横断で一意に保持し、同じ原文の提案を集約する。
	 * データの内容に食い違いがある場合は、推測で補正せず走査を停止する。
	 * @param {Object[]} rows API の1ページ分。
	 * @returns {void}
	 */
	function ingest( rows ) {
		// 取得 API が翻訳配列以外を返した場合は不正応答として検索を中止する。
		if ( ! Array.isArray( rows ) ) throw new Error( 'API の応答が配列ではありません。' );
		// ページ内に矛盾がある場合に中途半端に追加しないよう、先に全件を検証する。
		// 集約前に当該ページの全提案を正規化し、不正なデータを後続処理に渡さない。
		const prepared = rows.map( normalize );
		const seen = new Map( translationIds );
		const originals = new Map();
		// 過去ページの原文情報を照合対象として保持し、文脈が異なる提案を混同しない。
		for ( const [ id, group ] of groups ) {
			originals.set( id, { original: group.original, context: group.context, plural: group.plural } );
		}
		let duplicates = 0;
		// 別ページに分かれた提案を一つの原文 ID へ合流させるため、ページ内の全行を確認する。
		for ( const item of prepared ) {
			const signature = JSON.stringify( item );
			// 同じ翻訳 ID は内容一致時だけ重複として許容し、別提案として数えない。
			if ( seen.has( item.id ) ) {
				// 同一 ID で内容が異なる応答は整合性を確証できないため停止する。
				if ( seen.get( item.id ) !== signature ) throw new Error( '同一翻訳 ID の内容が異なります。' );
				duplicates++;
				continue;
			}
			const previous = originals.get( item.originalId );
			// 同じ原文 ID の原文・文脈・複数形が矛盾したときは合成結果を表示しない。
			if ( previous && ( previous.original !== item.original ||
				previous.context !== item.context || previous.plural !== item.plural ) ) {
				throw new Error( '同じ原文 ID の原文または Context が一致しません。' );
			}
			originals.set( item.originalId, { original: item.original, context: item.context, plural: item.plural } );
			seen.set( item.id, signature );
		}
		// 検証できたページだけ確定状態に取り込む。
		// 検証が完了したページの新しい翻訳 ID だけを集計し、二重計上を防ぐ。
		for ( const item of prepared ) {
			// 確認済みの翻訳 ID は追加せず、翻訳 ID の種類で複数 Waiting を数える。
			if ( translationIds.has( item.id ) ) continue;
			translationIds.set( item.id, JSON.stringify( item ) );
			// 初めて確認した原文は新規登録し、次のページの提案も同じ原文へ追加できるようにする。
			if ( ! groups.has( item.originalId ) ) {
				groups.set( item.originalId, {
					originalId: item.originalId, original: item.original,
					context: item.context, plural: item.plural, proposals: new Map(),
				} );
			}
			// 既存の Warning 設定に基づいてフォームごとの指摘数を判定する。
			// 複数形を含む各訳文フォームを対応する原文で判定し、既存の検査が返す Warning のみを集計する。
			const warnings = item.translations.reduce( ( count, translated, index ) => {
				const original = index === 0 ? item.original : ( item.plural || item.original );
				return count + wpgpt_run_checks( original, translated, false, item.original ).warning.length;
			}, 0 );
			groups.get( item.originalId ).proposals.set( item.id, { ...item, warnings } );
		}
		stats.duplicates += duplicates;
	}

	/**
	 * 翻訳 ID の異なる提案が2件以上ある原文を表示し、Warning 条件はその一覧だけに適用する。
	 * @returns {Object[]} 検索済みの複数 Waiting 原文。
	 */
	function visible() {
		// 異なる提案が2件以上ある原文を対象とし、Warning は表示条件にだけ反映する。
		return Array.from( groups.values() ).filter( ( group ) => group.proposals.size >= 2 &&
			( ! warningOnly || Array.from( group.proposals.values() ).some( ( proposal ) => proposal.warnings > 0 ) ) );
	}

	/**
	 * 暫定・途中・空ページ確認を区別し、網羅性の制約とともに現在の一覧ページを描画する。
	 * @returns {void} 元タブ内の検索状態を反映する。
	 */
	function render() {
		// 検索領域が設置されていない画面では他の UI を変更しない。
		if ( ! ui ) return;
		const items = visible();
		const totalPages = Math.max( 1, Math.ceil( items.length / DISPLAY_SIZE ) );
		// 絞り込みで一覧が短くなった場合も表示可能なページに補正する。
		page = Math.min( page, totalPages );
		ui.info.textContent = ( stats.outcome || '取得途中／暫定' ) +
			'｜取得ページ: ' + stats.pages + ' / ' + MAX_PAGES +
			'｜取得レコード: ' + stats.records +
			'｜複数 Waiting: ' + Array.from( groups.values() ).filter( ( item ) => item.proposals.size >= 2 ).length +
			' 原文｜重複 ID: ' + stats.duplicates + ' 件';
		ui.qualification.textContent = '注意: ソート日時が同じ提案や検索中の追加・更新・削除でページ境界が変化し、' +
			'空ページを確認しても全件網羅・同時点の状態は保証されません。' +
			// 重複が観測された検索では、表示上も網羅性の不確実さを強調する。
			( stats.duplicates ? ' ページ境界重複あり／網羅性未保証。' : '' );
		ui.results.replaceChildren();
		// DOM の増加を抑えるため、原文単位で25件ずつ表示する。
		// 画面の大量描画を避けるため、現在の一覧ページに属する原文だけをカード化する。
		for ( const group of items.slice( ( page - 1 ) * DISPLAY_SIZE, page * DISPLAY_SIZE ) ) {
			const card = el( '', 'article' );
			card.className = 'wpgpt-all-page-warnings__card';
			const count = Array.from( group.proposals.values() ).reduce( ( n, proposal ) => n + proposal.warnings, 0 );
			const heading = el( '原文 ID: ' + group.originalId + '｜提案 ' + group.proposals.size +
				' 件｜Warning ' + count + ' 件', 'strong' );
			const original = el( group.original, 'p' );
			const context = el( 'Context: ' + ( group.context || 'なし' ), 'p' );
			const users = el( '提案者: ' + Array.from( group.proposals.values() )
				.map( ( proposal ) => ( proposal.user || '取得不可' ) + '（ID ' + proposal.id +
					'、Warning ' + proposal.warnings + '）' ).join( ' / ' ), 'p' );
			const compare = el( '個別比較', 'button' );
			compare.type = 'button';
			compare.className = 'button';
			compare.addEventListener( 'click', () => {
				// 検索途中の提案は網羅性が未確認のため、個別比較では対象原文を既存 API で再検証する。
				wpgpt_all_page_warnings_open_waiting( {
					original: group.original, singularOriginal: group.original,
					context: group.context, sourceUrl: location.origin + location.pathname,
				}, compare, group.originalId );
			} );
			card.append( heading, original, context, users, compare );
			ui.results.appendChild( card );
		}
		ui.page.textContent = '結果ページ ' + page + ' / ' + totalPages + '（' + items.length + ' 原文）';
		ui.prev.disabled = page === 1;
		ui.next.disabled = page === totalPages;
	}

	/**
	 * 一定の取得間隔を確保し、中止された検索の追加通信を許さない。
	 * @param {AbortSignal} signal 当該検索の中止通知。
	 * @returns {Promise<void>} 間隔経過または中止による待機終了。
	 */
	function pause( signal ) {
		return new Promise( ( resolve ) => {
			// 既に中止された検索では次ページのための待機を開始しない。
			if ( signal.aborted ) return resolve();
			const timer = setTimeout( () => { signal.removeEventListener( 'abort', onAbort ); resolve(); }, PAGE_INTERVAL_MS );
			/** 中止を受けた場合、残りの待機時間を省いて次の GET を防ぐ。 */
			function onAbort() { clearTimeout( timer ); resolve(); }
			signal.addEventListener( 'abort', onAbort, { once: true } );
		} );
	}

	/**
	 * 同じ翻訳セットの Waiting だけを固定順序・逐次 GET で調べる。
	 * 空配列以外のレスポンスは終端として扱わない。
	 * @param {AbortSignal} signal ユーザーの中止要求。
	 * @returns {Promise<void>} 成功・途中停止の表示完了。
	 */
	async function scan( signal ) {
		let outcome = '途中結果：最大ページ数に到達';
		try {
			const url = new URL( wpgpt_all_page_warnings_waiting_api_url(
				location.origin + location.pathname, {}
			) );
			url.searchParams.set( 'sort[by]', 'translation_date_added' );
			url.searchParams.set( 'sort[how]', 'asc' );
			// API が総ページ数を返さないため、空配列を受け取るか上限に達するまで順に取得する。
			// API に総ページ数がないため、空ページの確認または上限まで、同一条件の Waiting を逐次調べる。
			for ( let number = 1; number <= MAX_PAGES; number++ ) {
				// 取得開始前に中止された場合は、新たな通信を発生させない。
				if ( signal.aborted ) { outcome = '途中結果：中止'; break; }
				url.searchParams.set( 'page', String( number ) );
				const response = await fetch( url.href, {
					method: 'GET', credentials: 'same-origin', redirect: 'error', signal,
				} );
				// 応答待ちの間に中止された結果は採用せず、次ページも取得しない。
				if ( signal.aborted ) { outcome = '途中結果：中止'; break; }
				// HTTP の制限・権限・障害は自動再試行せず取得済みの途中結果として扱う。
				if ( ! response.ok ) throw new Error( 'HTTP ' + response.status + '（自動再試行なし）' );
				// JSON 以外の応答は翻訳結果として解釈せず停止する。
				if ( ! /application\/json/iu.test( response.headers.get( 'content-type' ) || '' ) ) {
					throw new Error( 'JSON 以外の応答です。' );
				}
				const rows = await response.json();
				// 応答本文の読み取り中に中止されたページは集計せず、途中結果を維持する。
				if ( signal.aborted ) { outcome = '途中結果：中止'; break; }
				ingest( rows );
				stats.pages++;
				stats.records += rows.length;
				// 不足件数では終端とせず、正常な空配列だけを走査終了の根拠とする。
				if ( rows.length === 0 ) {
					outcome = '走査終了（空ページ確認）';
					break;
				}
				render();
				// 上限に達した場合は次ページを取得せず途中結果とし、制限内だけ取得間隔を守る。
				if ( number < MAX_PAGES ) await pause( signal );
			}
		} catch ( error ) {
			// 中止による停止と通信・形式の異常を区別し、利用者が理由を確認できるようにする。
			outcome = signal.aborted ? '途中結果：中止' :
				'途中結果：' + ( error?.message || String( error ) );
		} finally {
			stats.outcome = outcome;
			session = null;
			ui.start.disabled = false;
			ui.stop.disabled = true;
			render();
		}
	}

	/**
	 * 二重実行を禁止し、再検索では以前の結果と進捗を破棄して新しい検索を開始する。
	 * @returns {void} 新しい検索を開始する。
	 */
	function start() {
		// 通信中の重複開始を禁止し、一つの検索だけが結果を所有する。
		if ( session ) return;
		groups.clear();
		translationIds.clear();
		stats = { pages: 0, records: 0, duplicates: 0, outcome: '' };
		page = 1;
		warningOnly = ui.warning.checked;
		const controller = new AbortController();
		session = controller;
		ui.start.disabled = true;
		ui.stop.disabled = false;
		render();
		void scan( controller.signal );
	}

	/**
	 * 全件 Warning 機能の近くに独立した検索領域を一度だけ設置する。
	 * @param {HTMLElement} root 既存の全件 Warning 検索領域。
	 * @returns {void} 表示領域を初期化する。
	 */
	function mount( root ) {
		// 未対応ページや既に設置済みの画面では検索領域を追加しない。
		if ( ui || ! root || ! /^\/projects\//u.test( location.pathname ) ) return;
		const section = el( '', 'section' );
		section.className = 'wpgpt-all-page-warnings wpgpt-multiple-waiting';
		const title = el( '複数 Waiting の検索', 'h2' );
		const description = el( '全翻訳者の Waiting を原文 ID ごとに探します。明示操作時だけ最大50ページを逐次取得します。', 'p' );
		const startButton = el( '複数 Waiting を検索', 'button' );
		const stopButton = el( '中止', 'button' );
		startButton.type = stopButton.type = 'button';
		startButton.className = stopButton.className = 'button';
		stopButton.disabled = true;
		const label = el( '', 'label' );
		const warning = document.createElement( 'input' );
		warning.type = 'checkbox';
		label.append( warning, document.createTextNode( ' Warning ありのみ' ) );
		const info = el( '', 'p' );
		info.setAttribute( 'role', 'status' );
		info.setAttribute( 'aria-live', 'polite' );
		const qualification = el( '', 'p' );
		const results = el( '', 'div' );
		const prev = el( '前へ', 'button' );
		const next = el( '次へ', 'button' );
		prev.type = next.type = 'button';
		prev.className = next.className = 'button';
		const pageLabel = el( '', 'span' );
		section.append( title, description, startButton, stopButton, label,
			info, qualification, results, prev, pageLabel, next );
		root.insertAdjacentElement( 'afterend', section );
		ui = { start: startButton, stop: stopButton, warning, info, qualification, results, prev, next, page: pageLabel };
		startButton.addEventListener( 'click', start );
		stopButton.addEventListener( 'click', () => session?.abort() );
		// Warning 表示条件の変更ではサーバーを再取得せず、既存の結果だけを絞り込む。
		warning.addEventListener( 'change', () => { warningOnly = warning.checked; page = 1; render(); } );
		prev.addEventListener( 'click', () => { page--; render(); } );
		next.addEventListener( 'click', () => { page++; render(); } );
		// 元ページの離脱時に通信を中止し、旧ページの結果を引き継がない。
		window.addEventListener( 'pagehide', () => session?.abort(), { once: true } );
		render();
	}

	// Node の単体テストでは実ネットワークに接続せず、集約と停止契約だけを検証する。
	// ブラウザーでの内部状態公開は避け、Node の単体テスト環境でだけ検証境界を提供する。
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = {
			normalize, ingest, visible, scan, start,
			groups, translationIds,
			get stats() { return stats; },
			/** @param {Object} value 単体テストで用いる表示領域。 */
			setUI( value ) { ui = value; },
		};
	}
	// 既存の表示領域と依存する検査機能の読み込み完了後だけ設置する。
	document.addEventListener( 'wpgpt-all-page-warnings-ready', ( event ) => mount( event.detail?.root ) );
	mount( document.querySelector( '.wpgpt-all-page-warnings:not(.wpgpt-multiple-waiting)' ) );
} )();
