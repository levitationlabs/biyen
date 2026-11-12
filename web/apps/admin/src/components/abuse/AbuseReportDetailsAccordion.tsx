import React from "react";
import {
    Box,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";

export interface AbuseReportDetailsProps {
    ip: string;
    userAgent: string;
    details?: Record<string, unknown>;
}

export const AbuseReportDetailsAccordion: React.FC<AbuseReportDetailsProps> = ({
    ip,
    userAgent,
    details,
}) => {
    const hasDetails = Boolean(details && Object.keys(details).length > 0);

    return (
        <Box sx={{ mb: 2 }}>
            {hasDetails && (
                <Accordion
                    disableGutters
                    elevation={0}
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "8px !important",
                        mb: 1.5,
                        "&:before": { display: "none" },
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreRoundedIcon fontSize="small" />}
                        sx={{ minHeight: 40, px: 1.5, py: 0 }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CodeRoundedIcon sx={{ fontSize: 16, color: "text.muted" }} />
                            <Typography variant="small" sx={{ fontWeight: 600 }}>
                                Rincian Tambahan (Metadata / Komentar)
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                        <Box
                            component="pre"
                            sx={{
                                m: 0,
                                p: 1.25,
                                borderRadius: 1,
                                bgcolor: (theme) =>
                                    theme.palette.mode === "dark"
                                        ? "rgba(0,0,0,0.4)"
                                        : "rgba(0,0,0,0.04)",
                                fontSize: "0.75rem",
                                fontFamily: "monospace",
                                overflowX: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}
                        >
                            {JSON.stringify(details, null, 2)}
                        </Box>
                    </AccordionDetails>
                </Accordion>
            )}

            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 2,
                    color: "text.muted",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <PublicRoundedIcon sx={{ fontSize: 15 }} />
                    <Typography variant="mini" sx={{ fontFamily: "monospace" }}>
                        IP: {ip || "N/A"}
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        maxWidth: "100%",
                    }}
                >
                    <DevicesRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                    <Typography
                        variant="mini"
                        sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: { xs: 200, sm: 400 },
                        }}
                        title={userAgent}
                    >
                        UA: {userAgent || "N/A"}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};
