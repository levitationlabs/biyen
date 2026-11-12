// Biyen Admin — Sudo Freshness Indicator Bar
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useEffect, useState } from "react";
import { Chip, Tooltip, Box } from "@mui/material";
import ShieldIcon from "@mui/icons-material/Shield";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LockResetIcon from "@mui/icons-material/LockReset";
import {
    authStore,
    SUDO_WARNING_THRESHOLD_SECONDS,
} from "@/services/authStore";

export const OPEN_SUDO_MODAL_EVENT = "biyen:admin:open-sudo-modal";

export interface SudoFreshnessBarProps {
    onOpenModal?: () => void;
}

export const SudoFreshnessBar: React.FC<SudoFreshnessBarProps> = ({ onOpenModal }) => {
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
    const [hasToken, setHasToken] = useState<boolean>(false);

    const updateTimer = () => {
        const token = authStore.getToken();
        setHasToken(Boolean(token));
        setRemainingSeconds(authStore.getRemainingFreshnessSeconds());
    };

    useEffect(() => {
        updateTimer();
        const intervalId = window.setInterval(updateTimer, 1000);
        const unsubscribeAuth = authStore.onAuthChange(updateTimer);

        return () => {
            window.clearInterval(intervalId);
            unsubscribeAuth();
        };
    }, []);

    const handleClick = () => {
        if (onOpenModal) {
            onOpenModal();
            return;
        }
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(OPEN_SUDO_MODAL_EVENT));
        }
    };

    const statusConfig = getStatusConfig(hasToken, remainingSeconds);

    return (
        <Tooltip title="Klik untuk re-autentikasi atau perbarui masa berlaku sesi sudo">
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                <Chip
                    icon={statusConfig.icon}
                    label={statusConfig.label}
                    color={statusConfig.color}
                    variant={statusConfig.variant}
                    onClick={handleClick}
                    clickable
                    size="small"
                    sx={{
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            opacity: 0.9,
                            transform: "scale(1.02)",
                        },
                    }}
                />
            </Box>
        </Tooltip>
    );
};

interface StatusConfig {
    label: string;
    color: "success" | "warning" | "error";
    variant: "filled" | "outlined";
    icon: React.ReactElement;
}

function getStatusConfig(hasToken: boolean, remainingSeconds: number): StatusConfig {
    if (!hasToken || remainingSeconds <= 0) {
        return {
            label: "Sudo Kedaluwarsa - Perlu Re-Auth",
            color: "error",
            variant: "filled",
            icon: <LockResetIcon fontSize="small" />,
        };
    }

    if (remainingSeconds <= SUDO_WARNING_THRESHOLD_SECONDS) {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return {
            label: `Sudo Segera Berakhir (${timeStr})`,
            color: "warning",
            variant: "filled",
            icon: <WarningAmberIcon fontSize="small" />,
        };
    }

    const minsLeft = Math.ceil(remainingSeconds / 60);
    return {
        label: `Sudo Aktif (${minsLeft}m tersisa)`,
        color: "success",
        variant: "filled",
        icon: <ShieldIcon fontSize="small" />,
    };
}
