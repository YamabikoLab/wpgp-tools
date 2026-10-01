const presets = [
	{ label: '1-1 Japanese punctuation', original: 'Settings', translated: '設定，保存' },
	{ label: '1-2 Half-width characters', original: 'Name', translated: 'Ａです' },
	{ label: '1-4 Half/full-width spacing', original: 'WordPress setting', translated: 'WordPress設定' },
	{ label: '1-5 Parentheses', original: 'Settings (advanced)', translated: '設定（詳細）' },
	{ label: '1-6 Inner parentheses spacing', original: 'Settings (advanced)', translated: '設定 ( 詳細 )' },
	{ label: '1-7 Period inside parentheses', original: 'Settings (advanced). Continue.', translated: '設定 (詳細。) を続行します。' },
	{ label: '1-8 Sentence-ending parentheses', original: 'Settings (advanced).', translated: '設定 (詳細。)' },
	{ label: '1-9 Number spacing', original: '3 items', translated: '3 件' },
	{ label: '3-2 View expression', original: 'View posts', translated: '投稿を閲覧' },
	{ label: '3-3 Not allowed expression', original: 'Users are not allowed to edit this.', translated: 'ユーザーは編集できません。' },
	{ label: '3-4 Sorry prefix', original: 'Sorry, you cannot continue.', translated: '申し訳ありません。続行できません。' },
	{ label: '3-6 Recommended expressions', original: 'Save all', translated: '全て既に確認して下さい' },
	{ label: '5 Middle dot', original: 'Reorder rows and columns', translated: '行・列を並び替える' },
	{ label: 'Protected URL / email / code / path', original: 'Technical text', translated: 'https://example.com user@example.com `全て` /tmp/foo を確認' },
	{ label: 'Duplicate text: warning without unsafe highlight', original: 'Save all', translated: '全て保存し、全て確認' },
];

const preset = document.getElementById( 'preset' );
const original = document.getElementById( 'original' );
const translated = document.getElementById( 'translated' );
const results_container = document.getElementById( 'results' );

presets.forEach( ( item, index ) => {
	const option = document.createElement( 'option' );
	option.value = String( index );
	option.textContent = item.label;
	preset.appendChild( option );
} );

function load_preset() {
	const item = presets[ Number( preset.value ) ];
	original.value = item.original;
	translated.value = item.translated;
}

document.getElementById( 'load-preset' ).addEventListener( 'click', load_preset );
load_preset();

function append_result_group( title, items ) {
	const heading = document.createElement( 'h2' );
	heading.textContent = title;
	results_container.appendChild( heading );
	if ( 0 === items.length ) {
		const passed = document.createElement( 'p' );
		passed.textContent = 'None';
		results_container.appendChild( passed );
		return;
	}
	const list = document.createElement( 'ul' );
	items.forEach( ( item ) => {
		const li = document.createElement( 'li' );
		li.textContent = item.textContent;
		list.appendChild( li );
	} );
	results_container.appendChild( list );
}

function build_preview( text, highlights ) {
	const preview = document.createElement( 'div' );
	preview.className = 'preview';
	let cursor = 0;
	const ranges = [];
	highlights.forEach( ( value ) => {
		const start = text.indexOf( value );
		if ( -1 !== start ) ranges.push( { start, end: start + value.length } );
	} );
	ranges.sort( ( a, b ) => a.start - b.start );
	ranges.forEach( ( range ) => {
		if ( range.start < cursor ) return;
		preview.append( document.createTextNode( text.slice( cursor, range.start ) ) );
		const mark = document.createElement( 'span' );
		mark.className = 'highlight';
		mark.textContent = text.slice( range.start, range.end );
		preview.appendChild( mark );
		cursor = range.end;
	} );
	preview.append( document.createTextNode( text.slice( cursor ) ) );
	return preview;
}

document.getElementById( 'run-checks' ).addEventListener( 'click', () => {
	const results = { warning: [], notice: [], highlight_me: [] };
	wpgpt_run_japanese_checks( results, original.value, translated.value );

	results_container.replaceChildren();
	append_result_group( 'Warnings', results.warning );
	append_result_group( 'Notices', results.notice );

	const heading = document.createElement( 'h2' );
	heading.textContent = 'Preview';
	results_container.appendChild( heading );
	results_container.appendChild( build_preview( translated.value, results.highlight_me ) );
} );
