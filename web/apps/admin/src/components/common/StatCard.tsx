import React from "react";
import { Card, Box, Typography, alpha } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

export interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    color?: string;
    sx?: SxProps<Theme>;
}

const DEFAULT_TERRACOTTA = "#C8502E";

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color = DEFAULT_TERRACOTTA,
    sx,
}) => {
    return (
        <Card
            sx={{
                p: 2.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                        ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                        : "0 1px 3px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                    borderColor: alpha(color, 0.4),
                    boxShadow: (theme) =>
                        theme.palette.mode === "dark"
                            ? "0 4px 14px rgba(0, 0, 0, 0.4)"
                            : "0 4px 12px rgba(0, 0, 0, 0.08)",
                },
                ...sx,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        minWidth: 0,
                        flex: 1,
                    }}
                >
                    <Typography
                        variant="small"
                        sx={{
                            color: "text.muted",
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                        }}
                        noWrap
                    >
                        {title}
                    </Typography>

                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            color: "text.base",
                            lineHeight: 1.2,
                            my: 0.5,
                        }}
                    >
                        {value}
                    </Typography>

                    {subtitle && (
                        <Typography
                            variant="mini"
                            sx={{
                                color: "text.muted",
                                display: "block",
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>

                {icon && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: alpha(color, 0.1),
                            color: color,
                            flexShrink: 0,
                            "& svg": {
                                fontSize: 24,
                            },
                        }}
                    >
                        {icon}
                    </Box>
                )}
            </Box>
        </Card>
    );
};
