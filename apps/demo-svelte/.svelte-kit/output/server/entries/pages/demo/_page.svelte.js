import { a2 as ensure_array_like, a3 as attr, e as escape_html } from "../../../chunks/index.js";
import { c as createKeys, o as openaiProvider, a as anthropicProvider } from "../../../chunks/anthropic.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const providers = [openaiProvider, anthropicProvider];
    createKeys({ keys: [], routing: { defaultProvider: "openai" } }, { providers });
    let messages = [];
    let input = "";
    $$renderer2.push(`<main class="rm-demo svelte-1du1zi4"><h1 class="rm-page-title svelte-1du1zi4">Demo chat</h1> <p class="rm-muted svelte-1du1zi4">Uses resolved provider (mock responses only). Add keys in <a href="/settings">Settings</a>.</p> <div class="rm-chat svelte-1du1zi4"><div class="rm-messages svelte-1du1zi4">`);
    const each_array = ensure_array_like(messages);
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let msg = each_array[$$index];
        $$renderer2.push(`<div class="rm-msg svelte-1du1zi4"${attr("data-role", msg.role)}><span class="rm-msg-role svelte-1du1zi4">${escape_html(msg.role)}</span> <span class="rm-msg-text">${escape_html(msg.text)}</span></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="rm-muted svelte-1du1zi4">No messages yet. Type below and send.</p>`);
    }
    $$renderer2.push(`<!--]--></div> <form class="rm-form svelte-1du1zi4"><input type="text" class="rm-input svelte-1du1zi4"${attr("value", input)} placeholder="Type a message…" aria-label="Chat message"/> <button type="submit" class="rm-btn svelte-1du1zi4">Send</button></form></div></main>`);
  });
}
export {
  _page as default
};
