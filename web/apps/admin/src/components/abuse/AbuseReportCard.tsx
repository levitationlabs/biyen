import React, { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    Button,
    CircularProgress,
    alpha,
} from "@mui/material";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";

import type { AbuseReport } from "@/types/admin";
import { adminClient } from "@/services/adminClient";
import { formatReportDate } from "./abuseUtils";
import { AbuseReportUrlBar } from "./AbuseReportUrlBar";
import { AbuseReportDetailsAccordion } from "./AbuseReportDetailsAccordion";

export interface AbuseReportCardProps {
    report: AbuseReport;
    onTakedown?: (report: AbuseReport) => Promise<void>;
    onReportUpdated?: (updatedReport: AbuseReport) => void;
}

const CRITICAL_RED = "#EA3F3F";
const RESOLVED_COLOR = "#757575";

export const AbuseReportCard: React.FC<AbuseReportCardProps> = ({
    report,
    onTakedown,
    onReportUpdated,
}) => {
    const [isTakedownInProgress, setIsTakedownInProgress] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const isTakedown = Boolean(report.isDisabled);

    const handleTakedownAction = async () => {
        if (isTakedown || isTakedownInProgress) {
            return;
        }

        setIsTakedownInProgress(true);
        setActionError(null);

        try {
            if (onTakedown) {
                await onTakedown(report);
            } else {
                await adminClient.disableSharedCollection(report.shareID);
            }
            onReportUpdated?.({ ...report, isDisabled: true });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Gagal menonaktifkan tautan";
            setActionError(message);
        } finally {
            setIsTakedownInProgress(false);
        }
    };

    return (
        <Card
            sx={{
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: isTakedown ? "divider" : alpha(CRITICAL_RED, 0.25),
                bgcolor: "background.paper",
                boxShadow: "none",
                transition: "border-color 0.2s ease",
                opacity: isTakedown ? 0.85 : 1,
            }}
        >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                {/* Header: ID, Status Badge & Report Date */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1.5,
                        mb: 2,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip
                            label={`Laporan #${report.id}`}
                            size="small"
                            sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.75rem" }}
                        />
                        <Chip
                            label={`Share #${report.shareID}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                        />
                        <Chip
                            icon={
                                isTakedown ? (
                                    <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                ) : (
                                    <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
                                )
                            }
                            label={isTakedown ? "Dinonaktifkan / Takedown" : "Aktif / Terbuka"}
                            size="small"
                            sx={{
                                bgcolor: alpha(isTakedown ? RESOLVED_COLOR : CRITICAL_RED, 0.12),
                                color: isTakedown ? RESOLVED_COLOR : CRITICAL_RED,
                                borderColor: alpha(isTakedown ? RESOLVED_COLOR : CRITICAL_RED, 0.3),
                                fontWeight: 700,
                                fontSize: "0.75rem",
                            }}
                        />
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.muted" }}>
                        <CalendarTodayRoundedIcon sx={{ fontSize: 15 }} />
                        <Typography variant="small" sx={{ fontSize: "0.75rem" }}>
                            {formatReportDate(report.createdAt)}
                        </Typography>
                    </Box>
                </Box>

                {/* Report Reason */}
                <Box sx={{ mb: 2 }}>
                    <Typography
                        variant="mini"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "text.muted",
                            display: "block",
                            mb: 0.5,
                        }}
                    >
                        Alasan Pelanggaran
                    </Typography>
                    <Typography
                        variant="body"
                        sx={{ fontWeight: 600, color: isTakedown ? "text.base" : CRITICAL_RED }}
                    >
                        {report.reason || "Tidak ada alasan spesifik yang dilaporkan"}
                    </Typography>
                </Box>

                {/* Public Reported URL Bar */}
                <AbuseReportUrlBar url={report.url} shareID={report.shareID} />

                {/* Details Accordion & Reporter IP/UA */}
                <AbuseReportDetailsAccordion
                    ip={report.ip}
                    userAgent={report.userAgent}
                    details={report.details}
                />

                {/* Action Error if any */}
                {actionError && (
                    <Typography
                        variant="small"
                        sx={{ color: "error.main", display: "block", mb: 1.5, fontWeight: 500 }}
                    >
                        {actionError}
                    </Typography>
                )}

                {/* 1-Click Takedown Action Button */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                    {isTakedown ? (
                        <Button
                            variant="outlined"
                            disabled
                            size="small"
                            startIcon={<CheckRoundedIcon />}
                            sx={{ borderRadius: 1.5, textTransform: "none" }}
                        >
                            Tautan Telah Dinonaktifkan
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            color="critical"
                            size="small"
                            disabled={isTakedownInProgress}
                            startIcon={
                                isTakedownInProgress ? (
                                    <CircularProgress size={16} color="inherit" />
                                ) : (
                                    <BlockRoundedIcon />
                                )
                            }
                            onClick={handleTakedownAction}
                            sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
                        >
                            {isTakedownInProgress
                                ? "Memproses Takedown..."
                                : "Takedown / Nonaktifkan Tautan"}
                        </Button>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};
