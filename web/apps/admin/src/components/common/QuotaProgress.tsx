import React from "react";
import {
    Box,
    LinearProgress,
    Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

const HIGH_USAGE_THRESHOLD_PERCENT = 90;
const BYTES_PER_KIB = 1024;
const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const TERRACOTTA_COLOR = "#C8502E";
const DANGER_COLOR = "#EA3F3F";

export const formatBytes = (bytes: number, decimals: number = 1): string => {
    if (bytes <= 0) {
        return "0 B";
    }

    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KIB)),
        SIZE_UNITS.length - 1
    );

    const calculatedValue = bytes / Math.pow(BYTES_PER_KIB, unitIndex);
    const formattedNumber = calculatedValue
        .toFixed(decimals)
        .replace(/\.0$/, "");

    return `${formattedNumber} ${SIZE_UNITS[unitIndex]}`;
};

export interface QuotaProgressProps {
    usedBytes: number;
    totalBytes: number;
    label?: string;
    showSummaryText?: boolean;
    sx?: SxProps<Theme>;
}

export const QuotaProgress: React.FC<QuotaProgressProps> = ({
    usedBytes,
    totalBytes,
    label = "Penggunaan Kuota",
    showSummaryText = true,
    sx,
}) => {
    const safeUsed = Math.max(0, usedBytes);
    const safeTotal = Math.max(0, totalBytes);
    const rawPercentage = safeTotal > 0 ? (safeUsed / safeTotal) * 100 : 0;
    const progressValue = Math.min(100, Math.max(0, rawPercentage));
    const isHighUsage = rawPercentage >= HIGH_USAGE_THRESHOLD_PERCENT;

    const barColor = isHighUsage ? DANGER_COLOR : TERRACOTTA_COLOR;
    const summaryText = `${formatBytes(safeUsed)} dari ${formatBytes(
        safeTotal
    )} digunakan (${rawPercentage.toFixed(1)}%)`;

    return (
        <Box sx={{ width: "100%", ...sx }}>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 0.75,
                }}
            >
                <Typography variant="body" sx={{ fontWeight: 600 }}>
                    {label}
                </Typography>
                <Typography
                    variant="small"
                    sx={{
                        fontWeight: 700,
                        color: isHighUsage ? DANGER_COLOR : "text.muted",
                    }}
                >
                    {rawPercentage.toFixed(1)}%
                </Typography>
            </Box>

            <LinearProgress
                variant="determinate"
                value={progressValue}
                sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.06)",
                    "& .MuiLinearProgress-bar": {
                        borderRadius: 4,
                        bgcolor: barColor,
                    },
                }}
            />

            {showSummaryText && (
                <Typography
                    variant="small"
                    sx={{
                        display: "block",
                        mt: 0.75,
                        color: isHighUsage ? DANGER_COLOR : "text.muted",
                    }}
                >
                    {summaryText}
                </Typography>
            )}
        </Box>
    );
};
