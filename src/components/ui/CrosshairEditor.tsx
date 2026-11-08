import { useGameStore } from '../../store/useGameStore';
import { hexToRgba } from '../../game/rules';

export function DynamicCrosshairSvg({
  isPreview = false,
}: {
  isPreview?: boolean;
}) {
  const crosshair = useGameStore((s) => s.settings.crosshair);
  const movementSpeedRatio = useGameStore((s) => s.movementSpeedRatio);
  const recoilBloom = useGameStore((s) => s.recoilBloom);
  const hitmarkerActive = useGameStore((s) => s.hitmarkerActive);
  const hitmarkerHeadshot = useGameStore((s) => s.hitmarkerHeadshot);

  const dynamicOffset =
    !isPreview && !crosshair.staticCrosshair
      ? movementSpeedRatio * 8 + recoilBloom * 12
      : 0;

  const baseGap = 4 + crosshair.spacing * 20 + dynamicOffset;
  const lineLen = Math.max(1, crosshair.length);
  const thick = Math.max(1, crosshair.thickness);
  const outThick = Math.max(0, crosshair.outlineThickness);

  const fillColor = hexToRgba(crosshair.color, crosshair.alpha);
  const outlineColor = hexToRgba('#000000', crosshair.outlineAlpha);

  const size = 140;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none select-none overflow-visible"
      aria-label="Dynamic Tactical Crosshair"
    >
      {/* Top Bar */}
      <g>
        {outThick > 0 && (
          <rect
            x={center - thick / 2 - outThick}
            y={center - baseGap - lineLen - outThick}
            width={thick + outThick * 2}
            height={lineLen + outThick * 2}
            fill={outlineColor}
          />
        )}
        <rect
          x={center - thick / 2}
          y={center - baseGap - lineLen}
          width={thick}
          height={lineLen}
          fill={fillColor}
        />
      </g>

      {/* Bottom Bar */}
      <g>
        {outThick > 0 && (
          <rect
            x={center - thick / 2 - outThick}
            y={center + baseGap - outThick}
            width={thick + outThick * 2}
            height={lineLen + outThick * 2}
            fill={outlineColor}
          />
        )}
        <rect
          x={center - thick / 2}
          y={center + baseGap}
          width={thick}
          height={lineLen}
          fill={fillColor}
        />
      </g>

      {/* Left Bar */}
      <g>
        {outThick > 0 && (
          <rect
            x={center - baseGap - lineLen - outThick}
            y={center - thick / 2 - outThick}
            width={lineLen + outThick * 2}
            height={thick + outThick * 2}
            fill={outlineColor}
          />
        )}
        <rect
          x={center - baseGap - lineLen}
          y={center - thick / 2}
          width={lineLen}
          height={thick}
          fill={fillColor}
        />
      </g>

      {/* Right Bar */}
      <g>
        {outThick > 0 && (
          <rect
            x={center + baseGap - outThick}
            y={center - thick / 2 - outThick}
            width={lineLen + outThick * 2}
            height={thick + outThick * 2}
            fill={outlineColor}
          />
        )}
        <rect
          x={center + baseGap}
          y={center - thick / 2}
          width={lineLen}
          height={thick}
          fill={fillColor}
        />
      </g>

      {/* Optional Center Dot */}
      {crosshair.centerDot && (
        <g>
          {outThick > 0 && (
            <rect
              x={center - thick / 2 - outThick}
              y={center - thick / 2 - outThick}
              width={thick + outThick * 2}
              height={thick + outThick * 2}
              fill={outlineColor}
            />
          )}
          <rect
            x={center - thick / 2}
            y={center - thick / 2}
            width={thick}
            height={thick}
            fill={fillColor}
          />
        </g>
      )}

      {/* Hitmarker X Flash when damaging enemy in-game */}
      {!isPreview && hitmarkerActive && (
        <g
          stroke={hitmarkerHeadshot ? '#ef4444' : '#ffffff'}
          strokeWidth={2.5}
          strokeLinecap="square"
        >
          <line x1={center - 11} y1={center - 11} x2={center - 4} y2={center - 4} />
          <line x1={center + 11} y1={center - 11} x2={center + 4} y2={center - 4} />
          <line x1={center - 11} y1={center + 11} x2={center - 4} y2={center + 4} />
          <line x1={center + 11} y1={center + 11} x2={center + 4} y2={center + 4} />
        </g>
      )}
    </svg>
  );
}

export function CrosshairEditor() {
  const crosshair = useGameStore((s) => s.settings.crosshair);
  const updateCrosshair = useGameStore((s) => s.updateCrosshair);

  return (
    <div className="w-full space-y-4">
      {/* Live Crosshair Preview Grid Box (exact match to Screenshot 8) */}
      <div
        className="relative w-full h-36 bg-[#171a1e]/95 border border-white/15 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      >
        <DynamicCrosshairSvg isPreview={true} />
      </div>

      {/* BEHAVIOR Section */}
      <div className="space-y-1">
        <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
          BEHAVIOR
        </div>

        {/* Static Crosshair Toggle */}
        <div className="flex items-center justify-between bg-black/45 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Static Crosshair:</span>
          <button
            type="button"
            role="switch"
            aria-checked={crosshair.staticCrosshair}
            aria-label="Static Crosshair"
            onClick={() => updateCrosshair('staticCrosshair', !crosshair.staticCrosshair)}
            className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
              crosshair.staticCrosshair ? 'bg-white/45 justify-end' : 'bg-white/25 justify-start'
            }`}
          >
            <span className="w-5 h-5 bg-white block shadow-sm" />
          </button>
        </div>

        {/* Center Dot Toggle */}
        <div className="flex items-center justify-between bg-black/25 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Center Dot:</span>
          <button
            type="button"
            role="switch"
            aria-checked={crosshair.centerDot}
            aria-label="Center Dot"
            onClick={() => updateCrosshair('centerDot', !crosshair.centerDot)}
            className={`w-14 h-7 p-1 transition-colors flex items-center cursor-pointer ${
              crosshair.centerDot ? 'bg-white/45 justify-end' : 'bg-white/25 justify-start'
            }`}
          >
            <span className="w-5 h-5 bg-white block shadow-sm" />
          </button>
        </div>
      </div>

      {/* COLOR Section */}
      <div className="space-y-1">
        <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
          COLOR
        </div>

        <div className="flex items-center justify-between bg-black/45 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Color:</span>
          <div className="flex items-center gap-3">
            <label className="relative w-11 h-7 border border-white/40 p-0.5 cursor-pointer bg-black/40">
              <input
                type="color"
                aria-label="Crosshair Color Hex"
                value={crosshair.color}
                onChange={(e) => updateCrosshair('color', e.target.value.toUpperCase())}
                className="sr-only"
              />
              <span
                className="block w-full h-full"
                style={{ backgroundColor: crosshair.color }}
              />
            </label>
            <span className="text-[16px] font-extrabold font-mono-num text-white tracking-wide w-20 text-right">
              {crosshair.color.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/25 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Alpha:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Crosshair Alpha"
              min={0}
              max={255}
              step={1}
              value={crosshair.alpha}
              onChange={(e) => updateCrosshair('alpha', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.alpha}
            </div>
          </div>
        </div>
      </div>

      {/* SHAPE Section */}
      <div className="space-y-1">
        <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
          SHAPE
        </div>

        <div className="flex items-center justify-between bg-black/45 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Thickness:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Crosshair Thickness"
              min={1}
              max={16}
              step={1}
              value={crosshair.thickness}
              onChange={(e) => updateCrosshair('thickness', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.thickness}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/25 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Length:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Crosshair Length"
              min={1}
              max={40}
              step={1}
              value={crosshair.length}
              onChange={(e) => updateCrosshair('length', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.length}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/45 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Spacing:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Crosshair Spacing"
              min={0}
              max={2}
              step={0.05}
              value={crosshair.spacing}
              onChange={(e) => updateCrosshair('spacing', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.spacing.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>
      </div>

      {/* OUTLINE Section */}
      <div className="space-y-1">
        <div className="text-[12px] font-extrabold tracking-wider text-white/55 uppercase pb-1">
          OUTLINE
        </div>

        <div className="flex items-center justify-between bg-black/45 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Outline Thickness:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Outline Thickness"
              min={0}
              max={6}
              step={1}
              value={crosshair.outlineThickness}
              onChange={(e) => updateCrosshair('outlineThickness', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.outlineThickness}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/25 px-5 py-3">
          <span className="text-[18px] font-bold text-white/85">Outline Alpha:</span>
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label="Outline Alpha"
              min={0}
              max={255}
              step={1}
              value={crosshair.outlineAlpha}
              onChange={(e) => updateCrosshair('outlineAlpha', Number(e.target.value))}
              className="deadshot-slider w-44"
            />
            <div className="w-16 h-9 border border-white/35 bg-black/60 flex items-center justify-end px-2.5 text-[16px] font-extrabold font-mono-num text-white">
              {crosshair.outlineAlpha}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
