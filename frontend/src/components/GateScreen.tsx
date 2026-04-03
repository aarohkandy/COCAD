import { useState } from "react";

import type { GateFormValues } from "../types";

interface GateScreenProps {
  onSubmit: (values: GateFormValues) => Promise<void>;
  disabled: boolean;
  error: string | null;
}

export function GateScreen({ onSubmit, disabled, error }: GateScreenProps) {
  const [values, setValues] = useState<GateFormValues>({
    email: "",
    inviteCode: "PHASE0",
  });

  return (
    <main className="gate-shell">
      <section className="gate-card">
        <p className="eyebrow">PHASE 0</p>
        <h1>COCAD</h1>
        <p className="gate-copy">
          This prototype already proves the live chat loop and the in-app GLB viewer.
          Invite validation is still a placeholder, but the session shape matches the
          future product flow from day one.
        </p>
        <form
          className="gate-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(values);
          }}
        >
          <label>
            Email
            <input
              type="email"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="designer@example.com"
              required
            />
          </label>
          <label>
            Invite code
            <input
              type="text"
              value={values.inviteCode}
              onChange={(event) =>
                setValues((current) => ({ ...current, inviteCode: event.target.value }))
              }
              placeholder="PHASE0"
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={disabled}>
            {disabled ? "Starting session..." : "Enter workspace"}
          </button>
        </form>
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
    </main>
  );
}
