/**
 * ログイン中の WordPress.org アカウントが投稿した承認待ち翻訳を識別し、一覧に印を付ける。
 * 本ファイルは表示判定とその更新を担当する。外部通信は行わず、投稿者を確定できない場合は表示しない。
 */
/**
 * WordPress.org のプロフィール URL から、照合に使えるアカウント名を取得する。
 * 正規のプロフィールを一意に示さない URL は、誤認を防ぐため受け付けない。
 * @param {string} href プロフィールへのリンク先。
 * @return {?string} 小文字に正規化したアカウント名。判定不能の場合は null。
 */
function wpgpt_my_suggestion_profile( href ) {
	// 本人確認には、正規の WordPress.org プロフィールだけを使用する。
	try {
		const url = new URL( href, window.location.href );
		const parts = url.pathname.split( '/' ).filter( Boolean );
		if ( 'https:' !== url.protocol || 'profiles.wordpress.org' !== url.hostname ||
			1 !== parts.length || ! /^[a-z0-9_.-]+$/iu.test( parts[ 0 ] ) ) {
			return null;
		}
		return parts[ 0 ].toLowerCase();
	} catch ( error ) {
		// URL を解釈できない場合も、推測による本人判定を行わない。
		return null;
	}
}

/**
 * ログイン中の利用者を、本人専用の管理メニューから特定する。
 * 異なるアカウントが複数見つかった場合は本人を特定できないものとして扱う。
 * @return {?string} 確定した本人のアカウント名、または null。
 */
function wpgpt_my_suggestion_current_user() {
	// 翻訳一覧の投稿者をログイン中の本人と取り違えないよう、管理メニューだけを参照する。
	const menu = document.querySelector( '#wp-admin-bar-my-account' );
	// 本人確認の根拠がない画面では、個人の翻訳として表示しない。
	if ( ! menu ) {
		return null;
	}
	// 管理メニューにあるプロフィール候補をすべて照合し、有効な本人情報だけを残す。
	const identities = Array.from( menu.querySelectorAll( 'a[href]' ) )
		.map( ( link ) => wpgpt_my_suggestion_profile( link.href ) )
		.filter( Boolean );
	const unique = new Set( identities );
	return 1 === unique.size ? identities[ 0 ] : null;
}

/**
 * 対応する翻訳編集行の「Translated by」から投稿者を特定する。
 * 承認者など別の役割は投稿者とみなさず、候補が一意でない場合は判定しない。
 * @param {?Element} editor 対象の翻訳に対応する編集行。
 * @return {?string} 確定した投稿者のアカウント名、または null。
 */
function wpgpt_my_suggestion_author( editor ) {
	// 対応する編集行が存在しない翻訳の投稿者は推測しない。
	if ( ! editor ) {
		return null;
	}
	// 投稿者欄だけを対象にし、承認者・更新者や別の翻訳の情報を混同しない。
	// 編集行に複数の属性欄があっても、投稿者という責務を持つ欄だけを抽出する。
	const fields = Array.from( editor.querySelectorAll( '.meta dl' ) ).filter( ( field ) => {
		const title = field.querySelector( 'dt' );
		return title && 'translated by' === title.textContent.trim().replace( /:$/u, '' ).toLowerCase();
	} );
	// 投稿者欄が存在しない場合や複数ある場合は、確定した投稿者とは扱わない。
	if ( 1 !== fields.length ) {
		return null;
	}
	// 投稿者欄に候補が複数あれば、任意の一人を選ばず判定不能とする。
	const links = fields[ 0 ].querySelectorAll( 'dd a[href]' );
	return 1 === links.length ? wpgpt_my_suggestion_profile( links[ 0 ].href ) : null;
}

/**
 * 翻訳一覧の各行について、本人の承認待ち翻訳である場合に限り印を同期する。
 * 状態や投稿者が変化した後は古い印を消し、再評価を繰り返しても印は一つに保つ。
 * @return {void}
 */
function wpgpt_my_suggestion_sync() {
	const user = wpgpt_my_suggestion_current_user();
	// 一覧の各翻訳を独立して判定し、別行の投稿者や状態が表示に影響しないようにする。
	document.querySelectorAll( 'table.translations tr.preview[id^="preview-"]' ).forEach( ( preview ) => {
		const rowId = preview.id.slice( 'preview-'.length );
		const editor = document.getElementById( 'editor-' + rowId );
		const cell = preview.querySelector( 'td.translation' );
		// 印を表示できる翻訳セルがない場合は、その行を変更しない。
		if ( ! cell ) {
			return;
		}
		const existing = cell.querySelectorAll( '.wpgpt-my-suggestion' );
		// プレビューと対応する編集行の両方が承認待ちである場合だけ、投稿者の照合に進む。
		const author = preview.classList.contains( 'waiting' ) &&
			editor && editor.classList.contains( 'waiting' ) ?
			wpgpt_my_suggestion_author( editor ) : null;
		const show = Boolean( user && author && user === author );
		// 本人と確定しない翻訳には印を残さず、以前の判定結果も破棄する。
		if ( ! show ) {
			// 判定結果が変わった行に残る印をすべて取り除く。
			existing.forEach( ( label ) => label.remove() );
			return;
		}
		// 同じ翻訳の表示を何度更新しても、印は一つだけに保つ。
		// 既存の印が複数ある場合は先頭だけを残し、重複表示を解消する。
		Array.from( existing ).slice( 1 ).forEach( ( label ) => label.remove() );
		// 本人の承認待ち翻訳にまだ印がないときだけ新たに表示する。
		if ( 0 === existing.length ) {
			const label = document.createElement( 'span' );
			label.className = 'wpgpt-my-suggestion';
			label.textContent = 'My suggestion';
			cell.appendChild( label );
		}
	} );
}

/**
 * 翻訳一覧が存在する画面で表示を開始し、行の差し替えや状態変更にも追随する。
 * 同時期に発生した複数の変更はまとめて再判定し、不要な同期を抑える。
 * @return {void}
 */
function wpgpt_my_suggestion_init() {
	// 翻訳一覧がない画面には監視や表示処理を持ち込まない。
	if ( ! document.querySelector( 'table.translations' ) ) {
		return;
	}
	let scheduled = false;
	const observer = new MutationObserver( () => {
		// 再判定待ちの変更がある間は、新たな変更を同じ一回の再判定にまとめる。
		if ( scheduled ) {
			return;
		}
		scheduled = true;
		// 画面更新が一段落した時点で、一覧全体の表示整合性を回復する。
		Promise.resolve().then( () => {
			scheduled = false;
			wpgpt_my_suggestion_sync();
		} );
	} );
	// 行の追加・削除や本人／投稿者の属性変更を検知して、表示の鮮度を保つ。
	observer.observe( document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [ 'class', 'href' ],
	} );
	wpgpt_my_suggestion_sync();
}

// 初期表示前は画面構築の完了を待ち、構築済みなら直ちに表示を開始する。
if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', wpgpt_my_suggestion_init, { once: true } );
} else {
	wpgpt_my_suggestion_init();
}
