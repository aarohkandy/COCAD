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
    inviteCode: "PHASE1",
  });

  return (
    <main className="gate-shell">
      <section className="gate-card">
        <p className="eyebrow">WORKSPACE ACCESS</p>
        <h1>COCAD</h1>
        <p className="gate-copy">
          Claim an invite, open a live design session, and start shaping a 3D object with
          the AI chat and viewer pair.
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
              placeholder="PHASE1"
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
