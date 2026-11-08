import { Box, Button, Typography } from "@mui/material";
import React from "react";

export interface WebMaintenanceViewProps {
    onBypass?: () => void;
}

export const WebMaintenanceView: React.FC<WebMaintenanceViewProps> = ({
    onBypass,
}) => {
    const handleBypass = () => {
        try {
            window.localStorage?.setItem("biyen_dev_mode", "true");
        } catch {
            // ignore
        }
        onBypass?.();
    };

    return (
        <Box
            sx={{
                py: 6,
                px: { xs: 2.5, sm: 4 },
                textAlign: "center",
                maxWidth: 420,
                mx: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            <Typography
                sx={{
                    fontWeight: 700,
                    fontSize: "1.375rem",
                    letterSpacing: "-0.02em",
                    mb: 1.5,
                    color: "text.primary",
                }}
            >
                Akses Web Dalam Pengembangan
            </Typography>
            <Typography
                sx={{
                    color: "text.secondary",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    mb: 3,
                }}
            >
                Layanan web login Biyen Photos saat ini ditutup sementara untuk proses pemeliharaan dan penyempurnaan infrastruktur.
            </Typography>
            <Box
                sx={{
                    bgcolor: "action.hover",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "12px",
                    p: 2,
                    mb: 3.5,
                    width: "100%",
                }}
            >
                <Typography
                    sx={{
                        color: "text.primary",
                        fontSize: "0.8125rem",
                        lineHeight: 1.5,
                        fontWeight: 500,
                    }}
                >
                    Fitur berbagi tautan publik (sharing) tetap aktif dan dapat diakses seperti biasa tanpa perlu login.
                </Typography>
            </Box>
            <Button
                variant="outlined"
                href="https://biyen.levitation.web.id"
                sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    px: 3,
                    fontSize: "0.875rem",
                    color: "text.primary",
                    borderColor: "divider",
                    "&:hover": {
                        borderColor: "text.secondary",
                    },
                }}
            >
                Kunjungi Situs Utama
            </Button>

            {onBypass && (
                <Button
                    variant="text"
                    size="small"
                    onClick={handleBypass}
                    sx={{
                        mt: 3,
                        textTransform: "none",
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        opacity: 0.6,
                        "&:hover": {
                            opacity: 1,
                            backgroundColor: "transparent",
                            textDecoration: "underline",
                        },
                    }}
                >
                    Buka Mode Pengembang
                </Button>
            )}
        </Box>
    );
};
