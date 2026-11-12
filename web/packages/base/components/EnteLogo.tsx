// Biyen Photos — Brand Logo & Wordmark Component
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { styled } from "@mui/material";
import React from "react";
import { biyenWordmarkViewBox } from "./ente-wordmark";

export interface EnteLogoProps extends React.SVGProps<SVGSVGElement> {
    height?: number | string;
}

export const EnteLogo: React.FC<EnteLogoProps> = ({
    height = 20,
    style,
    ...props
}) => (
    <svg
        height={height}
        viewBox={biyenWordmarkViewBox}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        aria-label="biyen"
        role="img"
        style={{
            display: "inline-block",
            overflow: "visible",
            verticalAlign: "middle",
            ...style,
        }}
        {...props}
    >
        {/* Clean Bold Text "biyen" matching mobile asset */}
        <text
            x="10"
            y="70"
            fontFamily="'Outfit Variable', 'Outfit', 'Figtree', system-ui, -apple-system, sans-serif"
            fontSize="80"
            fontWeight="900"
            letterSpacing="-3.5"
            fill="currentColor"
        >
            biyen
        </text>
        {/* Warm Amber Glow Accent Dot on 'i' */}
        <circle cx="79" cy="18" r="8" fill="#D98226" />
    </svg>
);

export const BiyenLogo = EnteLogo;

// Remove the inline SVG's baseline gap.
export const EnteLogoBox = styled("div")`
    line-height: 0;
    display: inline-flex;
    align-items: center;
`;

export const BiyenLogoBox = EnteLogoBox;
