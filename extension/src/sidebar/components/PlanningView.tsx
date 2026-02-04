import React from 'react';
import type { PlanningDocument } from '../../types/actions';

interface PlanningViewProps {
  plan: PlanningDocument;
  onApprove: () => void;
  onEdit: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ plan, onApprove, onEdit }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-onshape-text">Review plan</h2>
        <span className="text-[11px] px-2 py-0.5 bg-onshape-bg-elevated border border-onshape-border rounded text-onshape-text-muted">
          Ready to generate
        </span>
      </div>

      {/* Design Intent */}
      <section className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
        <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-1.5">Design intent</h3>
        <p className="text-onshape-text text-sm">{plan.designIntent}</p>
      </section>

      {/* Overall Form */}
      <section className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
        <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-1.5">Overall form</h3>
        <p className="text-onshape-text text-sm">{plan.overallForm}</p>
      </section>

      {/* Key Dimensions (Variable Studio) */}
      <section className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
        <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-2">
          Variable Studio parameters
        </h3>
        <div className="space-y-1.5">
          {plan.keyDimensions.map((dim, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-2.5 bg-onshape-bg border border-onshape-border rounded"
            >
              <div>
                <span className="text-onshape-accent font-mono text-xs">#{dim.name}</span>
                <p className="text-onshape-text-muted text-[11px] mt-0.5">{dim.purpose}</p>
              </div>
              <span className="text-onshape-text text-sm font-medium">
                {dim.value} {dim.unit}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Major Features */}
      {plan.majorFeatures.length > 0 && (
        <section className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
          <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-2">Features</h3>
          <div className="space-y-1.5">
            {plan.majorFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2.5 py-2 px-2.5 bg-onshape-bg border border-onshape-border rounded"
              >
                <div className="w-6 h-6 rounded bg-onshape-bg-input flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-onshape-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-onshape-text text-xs">{feature.type}</span>
                  {feature.quantity != null && <span className="text-onshape-text-muted text-xs"> ×{feature.quantity}</span>}
                  <p className="text-onshape-text-muted text-[11px] truncate">{feature.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Materials & Tolerances */}
      {(plan.materials ?? plan.tolerances) && (
        <section className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
          <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-1.5">Additional info</h3>
          {plan.materials && (
            <p className="text-onshape-text text-xs">
              <span className="text-onshape-text-muted">Material:</span> {plan.materials}
            </p>
          )}
          {plan.tolerances && (
            <p className="text-onshape-text text-xs mt-1">
              <span className="text-onshape-text-muted">Tolerances:</span> {plan.tolerances}
            </p>
          )}
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 bg-onshape-bg-elevated hover:bg-onshape-hover border border-onshape-border text-onshape-text text-sm rounded transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-2 bg-onshape-accent hover:bg-onshape-accent-hover text-white text-sm rounded border-0 transition-colors font-medium"
        >
          Generate in Onshape
        </button>
      </div>
    </div>
  );
};
