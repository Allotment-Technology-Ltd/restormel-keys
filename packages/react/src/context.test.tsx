import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeysProvider, useKeysContext } from "./context";
import { openaiProvider } from "@restormel/keys";

function Consumer() {
  const { keys } = useKeysContext();
  return <span data-testid="has-keys">{keys ? "yes" : "no"}</span>;
}

describe("KeysProvider", () => {
  it("provides keys instance to children", () => {
    const config = { keys: [], routing: { defaultProvider: "openai" } };
    render(
      <KeysProvider config={config} options={{ providers: [openaiProvider] }}>
        <Consumer />
      </KeysProvider>
    );
    expect(screen.getByTestId("has-keys")).toHaveTextContent("yes");
  });

  it("useKeysContext throws when used outside provider", () => {
    function BadConsumer() {
      useKeysContext();
      return null;
    }
    expect(() => {
      render(<BadConsumer />);
    }).toThrow("useKeysContext must be used within a KeysProvider");
  });
});
