import React from 'react';
import type { PlanningDocument } from '../../types/actions';

interface PlanningViewProps {
  plan: PlanningDocument;
  onApprove: () => void;
  onEdit: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ plan, onApprove, onEdit }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium text-white">Review Plan</h2>
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
          Ready to generate
        </span>
      </div>

      {/* Design Intent */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Design Intent</h3>
        <p className="text-white">{plan.designIntent}</p>
      </section>

      {/* Overall Form */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Overall Form</h3>
        <p className="text-white">{plan.overallForm}</p>
      </section>

      {/* Key Dimensions (Variable Studio) */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Variable Studio Parameters
        </h3>
        <div className="space-y-2">
          {plan.keyDimensions.map((dim, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 bg-gray-900 rounded-lg"
            >
              <div>
                <span className="text-blue-400 font-mono text-sm">#{dim.name}</span>
                <p className="text-gray-500 text-xs mt-0.5">{dim.purpose}</p>
              </div>
              <span className="text-white font-medium">
                {dim.value} {dim.unit}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Major Features */}
      {plan.majorFeatures.length > 0 && (
        <section className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Features</h3>
          <div className="space-y-2">
            {plan.majorFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 py-2 px-3 bg-gray-900 rounded-lg"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-white text-sm">{feature.type}</span>
                  {feature.quantity && (
                    <span className="text-gray-500 text-sm"> x{feature.quantity}</span>
                  )}
                  <p className="text-gray-500 text-xs">{feature.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Materials & Tolerances */}
      {(plan.materials || plan.tolerances) && (
        <section className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Additional Info</h3>
          {plan.materials && (
            <p className="text-gray-300 text-sm">
              <span className="text-gray-500">Material:</span> {plan.materials}
            </p>
          )}
          {plan.tolerances && (
            <p className="text-gray-300 text-sm mt-1">
              <span className="text-gray-500">Tolerances:</span> {plan.tolerances}
            </p>
          )}
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onEdit}
          className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onApprove}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Generate in Onshape
        </button>
      </div>
    </div>
  );
};
