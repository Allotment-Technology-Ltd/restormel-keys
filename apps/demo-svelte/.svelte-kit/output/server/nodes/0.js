

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.B48uGVu_.js","_app/immutable/chunks/CJxlgk-m.js","_app/immutable/chunks/DmQhzI5v.js","_app/immutable/chunks/Di30xGJo.js"];
export const stylesheets = ["_app/immutable/assets/0.CZnrdjMy.css"];
export const fonts = [];
