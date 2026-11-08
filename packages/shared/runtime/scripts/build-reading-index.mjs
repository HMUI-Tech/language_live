import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const context={};vm.runInNewContext(readFileSync('public/reading-data.js','utf8'),context);
const index=context.DLReadingStories.map(s=>({id:s.id,questions:Array(s.questions.length).fill(null)}));
writeFileSync('public/reading-index.js','/* Generated metadata for progress validation; full stories load on demand. */\nglobalThis.DLReadingIndex='+JSON.stringify(index)+';\n');
