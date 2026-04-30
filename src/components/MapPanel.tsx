

import { useState } from 'react';
import { DISTRICTS } from '@/data/navigation';
import VILLAGE_DATA from '@/data/villages.json';
import { DISTRICT_PATHS } from '@/data/mapData';

interface MapPanelProps {
  pageId: string;
  activeDistrict: string | null;
  activeDistrictName: string | null;
  selectedVillage: string;
  onPickDistrict: (id: string, name: string) => void;
  onPickVillage: (pageId: string, village: string) => void;
}

export default function MapPanel({
  pageId, activeDistrict, activeDistrictName, selectedVillage,
  onPickDistrict, onPickVillage,
}: MapPanelProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const villageMap = VILLAGE_DATA as Record<string, string[]>;
  const villages = activeDistrictName ? (villageMap[activeDistrictName] ?? []) : [];

  const handleDistrictSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) return;
    const path = DISTRICT_PATHS.find(p => p.name === name);
    if (path) onPickDistrict(path.id, name);
  };

  return (
    <div className="mp">
      {/* Header */}
      <div className="mp-head">
        <div className="mp-head-left">
          <div className="mp-dot" />
          <h3>Burdur İlçe Haritası</h3>
        </div>
        {activeDistrictName ? (
          <div className="mp-pill">
            <span className="mp-pill-ilce">{activeDistrictName}</span>
            {selectedVillage && (
              <>
                <span className="mp-pill-sep">›</span>
                <span className="mp-pill-koy">{selectedVillage}</span>
              </>
            )}
          </div>
        ) : (
          <div className="mp-pill mp-pill-empty">İlçe seçilmedi</div>
        )}
      </div>

      {/* SVG Map */}
      <div className="mp-map-area">
        <svg viewBox="0 0 850 567" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id={`sf-${pageId}`}>
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,.15)" />
            </filter>
            <filter id={`sf-sel-${pageId}`}>
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(14,45,30,.4)" />
            </filter>
          </defs>
          <g filter={`url(#sf-${pageId})`}>
            {DISTRICT_PATHS.map(dp => (
              <path
                key={dp.id}
                className={`dist${activeDistrict === dp.id ? ' sel' : ''}`}
                d={dp.d}
                transform="matrix(0.85,0,0,0.85,63.75,42.52)"
                onMouseEnter={e => setTooltip({ x: (e as unknown as MouseEvent).clientX + 14, y: (e as unknown as MouseEvent).clientY - 10, text: dp.name })}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onPickDistrict(dp.id, dp.name)}
              />
            ))}
            {DISTRICT_PATHS.map(dp => (
              <text
                key={`l-${dp.id}`}
                className="dlbl"
                x={dp.labelX * 0.85 + 63.75}
                y={dp.labelY * 0.85 + 42.52}
                style={{ fontSize: activeDistrict === dp.id ? '13px' : '11.5px' }}
              >
                {dp.name}
              </text>
            ))}
          </g>
        </svg>
        {tooltip && (
          <div className="map-tt" style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mp-controls">
        <div className="mp-sel-block">
          <label className="sel-lbl">📍 İlçe</label>
          <select
            className="map-select"
            value={activeDistrictName ?? ''}
            onChange={handleDistrictSelect}
          >
            <option value="">— Tüm İlçeler —</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="mp-sel-block">
          <label className="sel-lbl">🏘️ Köy / Belde</label>
          <select
            className="map-select"
            value={selectedVillage}
            onChange={e => onPickVillage(pageId, e.target.value)}
            disabled={!activeDistrictName}
          >
            <option value="">{activeDistrictName ? '— Tüm Köyler —' : '— Önce İlçe —'}</option>
            {villages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {(activeDistrictName || selectedVillage) && (
          <button
            onClick={() => { onPickDistrict('', ''); onPickVillage(pageId, ''); }}
            className="mp-clear-btn"
          >
            ✕ Temizle
          </button>
        )}
      </div>

      {/* Info bar */}
      {activeDistrictName && (
        <div className="mp-info">
          <span className="mp-info-name">🏛️ {activeDistrictName}</span>
          <span className="mp-info-badge">{villages.length} köy/belde</span>
          {selectedVillage && <span className="mp-info-village">📍 {selectedVillage}</span>}
        </div>
      )}
    </div>
  );
}
