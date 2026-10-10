/**
 * Mark only Waiting translations whose author matches the signed-in WordPress.org
 * account. No requests are made; unidentifiable accounts are never guessed.
 */
function wpgpt_my_suggestion_profile( href ) {
	try {
		const url = new URL( href, window.location.href );
		const parts = url.pathname.split( '/' ).filter( Boolean );
		if ( 'https:' !== url.protocol || 'profiles.wordpress.org' !== url.hostname ||
			1 !== parts.length || ! /^[a-z0-9_.-]+$/iu.test( parts[ 0 ] ) ) {
			return null;
		}
		return parts[ 0 ].toLowerCase();
	} catch ( error ) {
		return null;
	}
}

function wpgpt_my_suggestion_current_user() {
	// Restrict the search to the authenticated user's menu. An author link in
	// the translation list must never be mistaken for the signed-in user.
	const menu = document.querySelector( '#wp-admin-bar-my-account' );
	if ( ! menu ) {
		return null;
	}
	const identities = Array.from( menu.querySelectorAll( 'a[href]' ) )
		.map( ( link ) => wpgpt_my_suggestion_profile( link.href ) )
		.filter( Boolean );
	const unique = new Set( identities );
	return 1 === unique.size ? identities[ 0 ] : null;
}

function wpgpt_my_suggestion_author( editor ) {
	if ( ! editor ) {
		return null;
	}
	// Use only the matching editor's "Translated by" field, never an
	// "Approved by" or "Last updated by" link or another translation row.
	const fields = Array.from( editor.querySelectorAll( '.meta dl' ) ).filter( ( field ) => {
		const title = field.querySelector( 'dt' );
		return title && 'translated by' === title.textContent.trim().replace( /:$/u, '' ).toLowerCase();
	} );
	if ( 1 !== fields.length ) {
		return null;
	}
	const links = fields[ 0 ].querySelectorAll( 'dd a[href]' );
	return 1 === links.length ? wpgpt_my_suggestion_profile( links[ 0 ].href ) : null;
}

function wpgpt_my_suggestion_sync() {
	const user = wpgpt_my_suggestion_current_user();
	document.querySelectorAll( 'table.translations tr.preview[id^="preview-"]' ).forEach( ( preview ) => {
		const rowId = preview.id.slice( 'preview-'.length );
		const editor = document.getElementById( 'editor-' + rowId );
		const cell = preview.querySelector( 'td.translation' );
		if ( ! cell ) {
			return;
		}
		const existing = cell.querySelectorAll( '.wpgpt-my-suggestion' );
		const author = preview.classList.contains( 'waiting' ) &&
			editor && editor.classList.contains( 'waiting' ) ?
			wpgpt_my_suggestion_author( editor ) : null;
		const show = Boolean( user && author && user === author );
		if ( ! show ) {
			existing.forEach( ( label ) => label.remove() );
			return;
		}
		// Preserve exactly one label even after repeated DOM updates.
		Array.from( existing ).slice( 1 ).forEach( ( label ) => label.remove() );
		if ( 0 === existing.length ) {
			const label = document.createElement( 'span' );
			label.className = 'wpgpt-my-suggestion';
			label.textContent = 'My suggestion';
			cell.appendChild( label );
		}
	} );
}

function wpgpt_my_suggestion_init() {
	if ( ! document.querySelector( 'table.translations' ) ) {
		return;
	}
	let scheduled = false;
	const observer = new MutationObserver( () => {
		if ( scheduled ) {
			return;
		}
		scheduled = true;
		Promise.resolve().then( () => {
			scheduled = false;
			wpgpt_my_suggestion_sync();
		} );
	} );
	observer.observe( document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [ 'class', 'href' ],
	} );
	wpgpt_my_suggestion_sync();
}

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', wpgpt_my_suggestion_init, { once: true } );
} else {
	wpgpt_my_suggestion_init();
}
