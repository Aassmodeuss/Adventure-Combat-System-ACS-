/*
Estimate token lengths of standing prompts emitted by ACS in the context hook.
Approach: load ACS from src/library.js, run context once (actionCount>=1),
extract the Inventory Tagging and Injury Tagging sections, then estimate tokens.

Run: node Tests/util/estimate-prompts.js
*/

const fs = require('fs');
const path = require('path');

// Minimal globals for ACS
const storyCards = [];
const state = {};
const info = { actionCount: 1 };
global.storyCards = storyCards;
global.state = state;
global.info = info;

// Minimal AutoCards API mock
const API = {
	getBannedTitles: () => [],
	setBannedTitles: () => ({}),
	getCard: (pred) => storyCards.find(pred) || null,
	buildCard: (tmpl) => { const card = { ...tmpl }; storyCards.unshift(card); return card; },
	setCardAsAuto: () => true,
	addCardMemory: () => true,
};
global.AutoCards = () => ({ API });

function loadACS() {
	const libPath = path.resolve(__dirname, '..', '..', 'src', 'library.js');
	const code = fs.readFileSync(libPath, 'utf8');
	const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
	if (!m) throw new Error('ACS function not found');
	const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
	return new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);
}

function estimateTokens(str) {
	const s = String(str || '');
	const chars = s.length;
	const words = s.trim().split(/\s+/).filter(Boolean).length;
	// Rough heuristics: ~4 chars/token; ~0.75 tokens/word; report both
	const charBased = Math.round(chars / 4);
	const wordBased = Math.round(words * 0.75);
	return { chars, words, charBased, wordBased };
}

function extractSections(contextText) {
	const text = String(contextText || '');
	const invRe = /Inventory\s+Tagging[\s\S]*?(?=(Injury\s+Tagging|<SYSTEM>|\n-----\n|$))/i;
	const injRe = /Injury\s+Tagging[\s\S]*?(?=(Inventory\s+Tagging|<SYSTEM>|\n-----\n|$))/i;
	const invMatch = text.match(invRe);
	const injMatch = text.match(injRe);
	return {
		inventory: invMatch ? invMatch[0].trim() : '',
		injury: injMatch ? injMatch[0].trim() : ''
	};
}

(function main(){
	try {
		const ACS = loadACS();
		// Get context; we just need the prompt blocks; suppress extraneous variation
		const [ctx] = ACS('context', 'Continue.', false);
		const sections = extractSections(ctx);
		const invEst = estimateTokens(sections.inventory);
		const injEst = estimateTokens(sections.injury);
		const totals = {
			chars: invEst.chars + injEst.chars,
			words: invEst.words + injEst.words,
			charBased: invEst.charBased + injEst.charBased,
			wordBased: invEst.wordBased + injEst.wordBased,
		};
		console.log('Inventory standing prompt:');
		console.log('  chars:', invEst.chars, 'words:', invEst.words, '≈tokens(char/word):', invEst.charBased, '/', invEst.wordBased);
		console.log();
		console.log('Injury standing prompt:');
		console.log('  chars:', injEst.chars, 'words:', injEst.words, '≈tokens(char/word):', injEst.charBased, '/', injEst.wordBased);
		console.log();
		console.log('Totals:');
		console.log('  chars:', totals.chars, 'words:', totals.words, '≈tokens(char/word):', totals.charBased, '/', totals.wordBased);
	} catch (e) {
		console.error('Failed to evaluate prompts.');
		console.error(e && e.stack || e);
		process.exit(1);
	}
})();

