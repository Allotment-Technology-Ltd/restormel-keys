import React from "react";

/** Full navigation — avoids client router eating `/oauth/login`. */
export function SignInButton(props: { children?: React.ReactNode }) {
  const { children = "Sign in with GitHub" } = props;
  return (
    <button
      type="button"
      onClick={() => {
        window.location.assign(`${window.location.origin}/oauth/login`);
      }}
      style={{
        border: "1px solid var(--z-border)",
        borderRadius: 10,
        padding: "10px 16px",
        background: "var(--z-primary, #2563eb)",
        color: "var(--z-primary-foreground, #fff)",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}
