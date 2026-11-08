/* Bounded account metadata: best score and most recent completion date only. */
(function(root){
 const sanitize=(raw,stories)=>{const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;for(const s of stories){const r=raw[s.id];if(r&&Number.isInteger(r.best)&&r.best>=0&&r.best<=s.questions.length&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date))out[s.id]={best:r.best,date:r.date};}return out;};
 const complete=(raw,story,score,date,stories)=>{if(!Number.isInteger(score)||score<0||score>story.questions.length)throw Error('Invalid reading score');const next=sanitize(raw,stories);next[story.id]={best:Math.max(next[story.id]?.best||0,score),date};return next;};
 root.DLReadingCore={sanitize,complete};
})(globalThis);
