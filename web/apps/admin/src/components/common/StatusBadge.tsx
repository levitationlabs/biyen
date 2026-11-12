import React from "react";
import { Chip } from "@mui/material";
import type { ChipProps, SxProps, Theme } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

export type AccountStatus =
    | "active"
    | "suspended"
    | "mfa_active"
    | "2fa_disabled"
    | "mfa_disabled"
    | "Aktif"
    | "Ditangguhkan"
    | "MFA Aktif"
    | "2FA Nonaktif";

export interface StatusBadgeProps {
    status: AccountStatus;
    customLabel?: string;
    size?: "small" | "medium";
    variant?: "filled" | "outlined";
    sx?: SxProps<Theme>;
}

interface BadgeConfig {
    defaultLabel: string;
    chipColor?: ChipProps["color"];
    icon: React.ReactElement;
    colorSx: SxProps<Theme>;
}

const getBadgeConfig = (status: AccountStatus): BadgeConfig => {
    switch (status) {
        case "active":
        case "Aktif":
            return {
                defaultLabel: "Aktif",
                chipColor: "default",
                icon: <CheckCircleRoundedIcon fontSize="small" />,
                colorSx: {
                    bgcolor: "rgba(46, 125, 50, 0.1)",
                    color: "#2e7d32",
                    borderColor: "rgba(46, 125, 50, 0.3)",
                    fontWeight: 600,
                    "& .MuiChip-icon": { color: "#2e7d32" },
                },
            };
        case "suspended":
        case "Ditangguhkan":
            return {
                defaultLabel: "Ditangguhkan",
                chipColor: "default",
                icon: <BlockRoundedIcon fontSize="small" />,
                colorSx: {
                    bgcolor: "rgba(211, 47, 47, 0.1)",
                    color: "#d32f2f",
                    borderColor: "rgba(211, 47, 47, 0.3)",
                    fontWeight: 600,
                    "& .MuiChip-icon": { color: "#d32f2f" },
                },
            };
        case "mfa_active":
        case "MFA Aktif":
            return {
                defaultLabel: "MFA Aktif",
                chipColor: "default",
                icon: <VerifiedUserRoundedIcon fontSize="small" />,
                colorSx: {
                    bgcolor: "rgba(2, 136, 209, 0.1)",
                    color: "#0288d1",
                    borderColor: "rgba(2, 136, 209, 0.3)",
                    fontWeight: 600,
                    "& .MuiChip-icon": { color: "#0288d1" },
                },
            };
        case "2fa_disabled":
        case "mfa_disabled":
        case "2FA Nonaktif":
        default:
            return {
                defaultLabel: "2FA Nonaktif",
                chipColor: "default",
                icon: <ShieldOutlinedIcon fontSize="small" />,
                colorSx: {
                    bgcolor: "rgba(117, 117, 117, 0.1)",
                    color: "#757575",
                    borderColor: "rgba(117, 117, 117, 0.3)",
                    fontWeight: 500,
                    "& .MuiChip-icon": { color: "#757575" },
                },
            };
    }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    customLabel,
    size = "small",
    variant = "outlined",
    sx,
}) => {
    const config = getBadgeConfig(status);
    const label = customLabel ?? config.defaultLabel;

    return (
        <Chip
            size={size}
            variant={variant}
            color={config.chipColor}
            icon={config.icon}
            label={label}
            sx={[
                {
                    borderRadius: 1.5,
                    fontSize: "0.75rem",
                },
                ...(Array.isArray(config.colorSx) ? config.colorSx : [config.colorSx]),
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        />
    );
};
