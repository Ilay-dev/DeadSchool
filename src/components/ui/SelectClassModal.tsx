import { useGameStore } from '../../store/useGameStore';
import { WEAPON_LIST, type WeaponId } from '../../game/rules';

function WeaponCardIllustration({ weaponId }: { weaponId: WeaponId }) {
  if (weaponId === 'lidl_scanner') {
    // Iconic Lidl Handheld Barcode Scanner (Blue #0050aa, Yellow #fff000, Red #e60014)
    return (
      <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
        <g transform="rotate(-8 110 65)">
          {/* Scanner Head */}
          <rect
            x="55"
            y="26"
            width="88"
            height="32"
            rx="6"
            fill="#0050aa"
            stroke="#fff000"
            strokeWidth="2.5"
          />
          {/* Lidl Yellow & Red Stripe */}
          <rect x="68" y="37" width="58" height="9" rx="2" fill="#fff000" />
          <circle cx="82" cy="41.5" r="3.5" fill="#e60014" />
          {/* Red Front Bumper & Laser Window */}
          <rect x="140" y="28" width="10" height="28" rx="2" fill="#e60014" />
          {/* Laser Scan Beam */}
          <polygon points="150,35 205,18 205,66 150,49" fill="rgba(255, 30, 30, 0.35)" />
          <line x1="150" y1="42" x2="205" y2="42" stroke="#ff1e1e" strokeWidth="3" />
          {/* Yellow Trigger */}
          <rect x="102" y="58" width="14" height="16" rx="2" fill="#fff000" />
          {/* Ergonomic Pistol Handle */}
          <polygon
            points="78,58 104,58 92,110 66,110"
            fill="#0050aa"
            stroke="#1e3a8a"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    );
  }

  if (weaponId === 'smg') {
    return (
      <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
        <g transform="rotate(-12 110 65)">
          <rect x="18" y="46" width="28" height="7" fill="#1e2229" />
          <polygon
            points="44,38 145,38 145,58 95,58 88,82 62,82 55,56 44,56"
            fill="#e8e6e1"
            stroke="#222"
            strokeWidth="1.5"
          />
          <polygon points="62,62 84,62 78,108 60,108" fill="#1c1f24" />
          <polygon points="108,58 126,58 120,88 104,88" fill="#22252a" />
          <rect x="82" y="26" width="24" height="12" rx="2" fill="#141619" />
          <polygon
            points="145,42 192,45 192,78 178,78 178,55 145,53"
            fill="#e8e6e1"
            stroke="#222"
            strokeWidth="1.5"
          />
          <rect x="184" y="44" width="10" height="36" fill="#1c1f24" />
        </g>
      </svg>
    );
  }

  if (weaponId === 'assault') {
    return (
      <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
        <g transform="rotate(10 110 65)">
          <rect x="12" y="50" width="46" height="5" fill="#1f2328" />
          <polygon points="36,50 42,35 46,35 44,50" fill="#181b20" />
          <rect
            x="52"
            y="45"
            width="42"
            height="14"
            rx="2"
            fill="#15171b"
            stroke="#2f343d"
            strokeWidth="1"
          />
          <rect x="92" y="44" width="48" height="18" fill="#20242b" />
          <rect x="115" y="35" width="16" height="9" fill="#171a1f" />
          <polygon
            points="96,62 114,62 108,102 89,99"
            fill="#16191e"
            stroke="#2d323b"
            strokeWidth="1"
          />
          <polygon points="126,62 138,62 133,86 121,86" fill="#141619" />
          <polygon points="140,46 196,46 196,76 182,76 168,58 140,58" fill="#181b20" />
        </g>
      </svg>
    );
  }

  if (weaponId === 'sniper') {
    return (
      <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
        <g transform="rotate(12 110 65)">
          <rect x="6" y="49" width="75" height="5" fill="#1d2024" />
          <rect x="68" y="33" width="66" height="8" fill="#171a1e" />
          <polygon points="62,30 72,33 72,41 62,44" fill="#111316" />
          <polygon points="134,33 142,31 142,43 134,41" fill="#111316" />
          <rect x="85" y="41" width="6" height="7" fill="#171a1e" />
          <rect x="115" y="41" width="6" height="7" fill="#171a1e" />
          <polygon
            points="56,48 152,48 198,52 198,78 164,74 145,62 56,60"
            fill="#4f6835"
            stroke="#2c3b1d"
            strokeWidth="1.5"
          />
          <rect x="96" y="60" width="22" height="18" fill="#1b1e22" />
        </g>
      </svg>
    );
  }

  if (weaponId === 'shotgun') {
    return (
      <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
        <g transform="rotate(14 110 65)">
          <rect x="14" y="46" width="106" height="6" rx="2" fill="#3b4450" />
          <rect x="14" y="51" width="106" height="5" rx="2" fill="#2a313a" />
          <polygon points="68,54 116,54 112,63 72,61" fill="#7c4d2b" />
          <rect x="118" y="47" width="24" height="14" fill="#47515e" />
          <polygon
            points="142,50 202,60 198,86 154,68 142,61"
            fill="#7c4d2b"
            stroke="#4a2c17"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 130" className="w-40 h-26 drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]">
      <g transform="rotate(12 110 65)">
        <rect x="16" y="49" width="44" height="5" fill="#1b1e22" />
        <rect
          x="56"
          y="45"
          width="44"
          height="13"
          fill="#9e7f34"
          stroke="#5e4a1c"
          strokeWidth="1"
        />
        <rect x="92" y="32" width="44" height="9" rx="2" fill="#181b20" />
        <rect x="104" y="41" width="18" height="5" fill="#181b20" />
        <rect
          x="100"
          y="45"
          width="46"
          height="17"
          fill="#b89644"
          stroke="#6b5522"
          strokeWidth="1"
        />
        <polygon points="102,62 120,62 114,98 96,95" fill="#181a1e" />
        <polygon points="132,62 142,62 138,85 128,85" fill="#8c6f2d" />
        <polygon points="146,47 196,47 196,74 182,74 170,58 146,58" fill="#b89644" />
      </g>
    </svg>
  );
}

export function SelectClassModal() {
  const selectedClass = useGameStore((s) => s.selectedClass);
  const selectClassAndDeploy = useGameStore((s) => s.selectClassAndDeploy);

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-black/35 pointer-events-auto select-none px-4">
      <h1 className="text-[60px] font-extrabold tracking-wide text-white/55 uppercase mb-8 select-none">
        SELECT CLASS
      </h1>

      {/* 6 Translucent Weapon Cards Row (including the new Lidl Barcode Scanner!) */}
      <div className="grid grid-cols-6 gap-4 max-w-[1360px] w-full">
        {WEAPON_LIST.map((weapon) => {
          const isSelected = selectedClass === weapon.id;
          const isLidl = weapon.id === 'lidl_scanner';
          return (
            <button
              key={weapon.id}
              type="button"
              data-testid={`select-class-${weapon.id}`}
              onClick={() => selectClassAndDeploy(weapon.id)}
              className={`group flex flex-col items-center justify-between px-3 py-6 transition-all duration-150 cursor-pointer relative ${
                isSelected
                  ? 'bg-white/24 ring-2 ring-white/65 scale-[1.02]'
                  : isLidl
                    ? 'bg-[#0050aa]/35 hover:bg-[#0050aa]/55 border border-[#fff000]/45'
                    : 'bg-white/12 hover:bg-white/20'
              }`}
            >
              {isLidl && (
                <span className="absolute -top-2.5 right-2 bg-[#fff000] text-[#0050aa] text-[10px] font-black px-2 py-0.5 uppercase shadow">
                  10s STUN (4m)
                </span>
              )}

              <div className="my-3 transform group-hover:scale-105 transition-transform">
                <WeaponCardIllustration weaponId={weapon.id} />
              </div>

              <div className="text-center space-y-0.5 mt-1">
                <div className="text-[20px] font-extrabold text-white/85 group-hover:text-white tracking-tight mb-1.5">
                  {weapon.name}
                </div>
                <div className="text-[13px] font-extrabold text-white/55 leading-snug">
                  Range: {weapon.rangeLabel}
                </div>
                <div className="text-[13px] font-extrabold text-white/55 leading-snug font-mono-num">
                  Ammo: {weapon.ammo}
                </div>
                <div className="text-[13px] font-extrabold text-white/55 leading-snug font-mono-num">
                  Health: {weapon.health}
                </div>
                <div className="text-[13px] font-extrabold text-white/55 leading-snug font-mono-num">
                  Reload Time: {weapon.reloadTime}s
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
