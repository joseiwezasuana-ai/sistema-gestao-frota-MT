import React from 'react';

interface SuperTaxiLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textColor?: string;
}

export const SuperTaxiLogo: React.FC<SuperTaxiLogoProps> = ({
  className = '',
  size = 64,
  showText = true,
  textColor = '#FBBF24',
}) => {
  return (
    <div 
      className={`inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: typeof size === 'number' ? `${size}px` : size }}
    >
      <svg
        viewBox="0 0 600 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-md"
      >
        <defs>
          {/* Gradients for modern sleek metallic & glass look */}
          <linearGradient id="stCarBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="35%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          <linearGradient id="stRoofSignGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="25%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <linearGradient id="stGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#BAE6FD" />
          </linearGradient>

          <linearGradient id="stRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id="stSpeedGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
            <stop offset="70%" stopColor="#FDE047" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="stSpeedGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
            <stop offset="60%" stopColor="#FDE047" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
          </linearGradient>

          <filter id="stGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Aerodynamic Speed Streaks (Motion trails behind car) */}
        <g id="st-speed-streaks">
          {/* Upper fast swoosh */}
          <path
            d="M 50 145 C 95 138, 145 132, 210 134 C 160 143, 115 152, 70 156 Z"
            fill="url(#stSpeedGrad1)"
          />
          {/* Middle dynamic streak */}
          <path
            d="M 85 168 C 130 162, 180 158, 235 160 C 185 170, 140 177, 100 180 Z"
            fill="url(#stSpeedGrad2)"
          />
          {/* Lower speed blade */}
          <path
            d="M 95 198 C 140 193, 185 190, 225 191 C 180 200, 145 206, 110 208 Z"
            fill="url(#stSpeedGrad1)"
          />
        </g>

        {/* 2. Sleek Roof Light Box (SUPER TAXI) */}
        <g id="st-taxi-roof-sign">
          {/* Base Stand */}
          <path
            d="M 225 186 L 235 152 C 236 148, 240 145, 245 145 L 340 145 C 345 145, 349 148, 350 152 L 360 186 Z"
            fill="url(#stRoofSignGrad)"
            stroke="#0F172A"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* Inner Highlight Border */}
          <path
            d="M 240 182 L 247 154 C 248 152, 250 150, 253 150 L 332 150 C 335 150, 337 152, 338 154 L 345 182 Z"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.5"
          />
          {/* SUPER Text */}
          <text
            x="292"
            y="163"
            fill="#0F172A"
            fontSize="16"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="2"
          >
            SUPER
          </text>
          {/* TAXI Text */}
          <text
            x="292"
            y="180"
            fill="#0F172A"
            fontSize="16"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="3"
          >
            TAXI
          </text>
        </g>

        {/* 3. Modern Aerodynamic Sedan Silhouette */}
        <g id="st-car-body">
          {/* Underbody Shadow Line */}
          <ellipse cx="305" cy="336" rx="230" ry="12" fill="#0F172A" fillOpacity="0.45" />

          {/* Main Car Body - Sleek, Low-drag Streamlined Curves */}
          <path
            d="M 90 295 
               C 85 272, 92 258, 115 252 
               L 155 246
               L 190 196 
               C 202 182, 222 180, 248 180 
               L 362 180 
               C 388 180, 402 192, 415 208 
               L 448 248 
               L 508 262 
               C 532 268, 542 284, 540 306 
               C 538 322, 524 330, 498 330 
               L 476 330 
               C 470 290, 412 290, 406 330 
               L 230 330 
               C 224 290, 166 290, 160 330 
               L 115 330 
               C 96 330, 90 318, 90 295 Z"
            fill="url(#stCarBodyGrad)"
            stroke="#0F172A"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Sleek Aerodynamic Character Line along side */}
          <path
            d="M 120 258 C 170 252, 280 252, 515 272"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Lower Door Crease */}
          <path
            d="M 235 308 L 400 308"
            fill="none"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Aerodynamic Glass Cabin (Tinted Modern Windows) */}
          {/* Rear Passenger Window */}
          <path
            d="M 196 242 
               L 214 196 
               C 218 190, 226 190, 236 190 
               L 292 190 
               L 292 242 
               L 198 242 Z"
            fill="url(#stGlassGrad)"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Front Driver Window */}
          <path
            d="M 304 190 
               L 360 190 
               C 370 190, 378 195, 385 204 
               L 412 242 
               L 304 242 Z"
            fill="url(#stGlassGrad)"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Window Pillar Reflection Accent */}
          <path
            d="M 226 198 L 218 236"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 320 196 L 350 238"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Sleek Chrome Door Handles */}
          <rect x="312" y="258" width="26" height="7" rx="3.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
          <rect x="238" y="258" width="22" height="7" rx="3.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />

          {/* High-Tech LED Front Headlight */}
          <path
            d="M 505 274 L 536 283 C 538 293, 530 302, 514 302 L 498 298 Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="3"
          />
          <path d="M 515 284 L 532 288" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />

          {/* LED Rear Taillight */}
          <path
            d="M 92 268 L 112 268 L 109 288 L 91 285 Z"
            fill="#EF4444"
            stroke="#0F172A"
            strokeWidth="2.5"
          />
          <path d="M 94 274 L 108 274" stroke="#FCA5A5" strokeWidth="1.5" />
        </g>

        {/* 4. High-Performance Sport Alloy Wheels */}
        <g id="st-wheels">
          {/* REAR WHEEL */}
          <g id="rear-wheel" transform="translate(195, 330)">
            {/* Outer Tire */}
            <circle cx="0" cy="0" r="38" fill="#0F172A" stroke="#334155" strokeWidth="3" />
            <circle cx="0" cy="0" r="32" fill="#1E293B" />
            {/* Alloy Rim */}
            <circle cx="0" cy="0" r="24" fill="url(#stRimGrad)" stroke="#0F172A" strokeWidth="2.5" />
            {/* 5-Spoke Sport Design */}
            <path d="M 0 -22 L 0 22 M -21 -7 L 21 7 M -13 18 L 13 -18 M 13 18 L -13 -18 M -21 7 L 21 -7" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
            {/* Center Cap with Gold Accent */}
            <circle cx="0" cy="0" r="8" fill="#FBBF24" stroke="#0F172A" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#0F172A" />
          </g>

          {/* FRONT WHEEL */}
          <g id="front-wheel" transform="translate(440, 330)">
            {/* Outer Tire */}
            <circle cx="0" cy="0" r="38" fill="#0F172A" stroke="#334155" strokeWidth="3" />
            <circle cx="0" cy="0" r="32" fill="#1E293B" />
            {/* Alloy Rim */}
            <circle cx="0" cy="0" r="24" fill="url(#stRimGrad)" stroke="#0F172A" strokeWidth="2.5" />
            {/* 5-Spoke Sport Design */}
            <path d="M 0 -22 L 0 22 M -21 -7 L 21 7 M -13 18 L 13 -18 M 13 18 L -13 -18 M -21 7 L 21 -7" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
            {/* Center Cap with Gold Accent */}
            <circle cx="0" cy="0" r="8" fill="#FBBF24" stroke="#0F172A" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#0F172A" />
          </g>
        </g>

        {/* 5. Google Maps Style Location Pin Marker (Glossy 3D Finish) */}
        <g id="st-map-pin" transform="translate(385, 75) scale(1.18)">
          {/* Drop Shadow */}
          <ellipse cx="60" cy="154" rx="20" ry="7" fill="#0F172A" fillOpacity="0.4" />

          {/* Pin Outer Stroke & Shape */}
          <path
            d="M 60 148 C 60 148, 118 78, 118 56 C 118 25, 92 0, 60 0 C 28 0, 2 25, 2 56 C 2 78, 60 148, 60 148 Z"
            fill="#0F172A"
          />

          {/* Red Top Arc */}
          <path
            d="M 60 6 C 79 6, 96 15, 107 30 L 60 58 Z"
            fill="#EA4335"
          />
          <path
            d="M 13 30 C 24 15, 41 6, 60 6 L 60 58 Z"
            fill="#EA4335"
          />

          {/* Yellow Left Arc */}
          <path
            d="M 8 54 C 8 45, 10 37, 13 30 L 60 58 L 33 110 C 20 90, 8 70, 8 54 Z"
            fill="#FBBC04"
          />

          {/* Green Bottom Section */}
          <path
            d="M 33 110 L 60 58 L 60 144 C 57 141, 44 125, 33 110 Z"
            fill="#34A853"
          />

          {/* Blue Right Section */}
          <path
            d="M 60 58 L 107 30 C 110 37, 112 45, 112 54 C 112 73, 90 106, 60 144 L 60 58 Z"
            fill="#4285F4"
          />

          {/* Center Clean White Dot with Crisp Depth */}
          <circle cx="60" cy="52" r="25" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
        </g>

        {/* 6. Text: LUENA-MOXICO (Ultra Bold, High Contrast Typography) */}
        {showText && (
          <g id="st-bottom-text">
            {/* Black Outline / Shadow Effect for readability on any background */}
            <text
              x="300"
              y="428"
              fill="#0F172A"
              stroke="#0F172A"
              strokeWidth="10"
              strokeLinejoin="round"
              fontSize="48"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              textAnchor="middle"
              letterSpacing="5"
            >
              LUENA-MOXICO
            </text>
            {/* Vibrant Gold Foreground Text */}
            <text
              x="300"
              y="428"
              fill={textColor}
              fontSize="48"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              textAnchor="middle"
              letterSpacing="5"
            >
              LUENA-MOXICO
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default SuperTaxiLogo;
