import React from 'react';

export type UserSettings = {
  units: 'mm' | 'in';
  speed: 'slow' | 'normal' | 'fast';
  showTooltips: boolean;
};

interface SettingsProps {
  settings: UserSettings;
  onChange: (next: UserSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-onshape-text-muted uppercase tracking-wide mb-2">
          Default Units
        </label>
        <select
          value={settings.units}
          onChange={(e) => onChange({ ...settings, units: e.target.value as UserSettings['units'] })}
          className="w-full px-3 py-2 bg-onshape-bg-input border border-onshape-border rounded text-onshape-text text-sm focus:outline-none focus:border-onshape-accent"
        >
          <option value="mm">Millimeters (mm)</option>
          <option value="in">Inches (in)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-onshape-text-muted uppercase tracking-wide mb-2">
          Automation Speed
        </label>
        <select
          value={settings.speed}
          onChange={(e) => onChange({ ...settings, speed: e.target.value as UserSettings['speed'] })}
          className="w-full px-3 py-2 bg-onshape-bg-input border border-onshape-border rounded text-onshape-text text-sm focus:outline-none focus:border-onshape-accent"
        >
          <option value="slow">Slow (visual)</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold text-onshape-text-muted uppercase tracking-wide">
            Tooltips
          </label>
          <p className="text-xs text-onshape-text-muted">Show action tooltips during automation</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...settings, showTooltips: !settings.showTooltips })}
          className={`w-10 h-6 rounded-full transition-colors ${
            settings.showTooltips ? 'bg-onshape-accent' : 'bg-onshape-bg-input'
          }`}
          aria-pressed={settings.showTooltips}
        >
          <span
            className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${
              settings.showTooltips ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
