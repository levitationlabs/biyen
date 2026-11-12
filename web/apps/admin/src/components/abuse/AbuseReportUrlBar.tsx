import React, { useState } from "react";
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

export interface AbuseReportUrlBarProps {
    url: string;
    shareID: number;
}

export const AbuseReportUrlBar: React.FC<AbuseReportUrlBarProps> = ({
    url,
    shareID,
}) => {
    const [copied, setCopied] = useState(false);
    const displayUrl = url || `https://photos.biyen.id/s/${shareID}`;

    const handleCopy = async () => {
        if (!displayUrl) return;
        try {
            await navigator.clipboard.writeText(displayUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
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
                Tautan Publik yang Dilaporkan
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.04)"
                            : "rgba(0, 0, 0, 0.03)",
                    border: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Typography
                    variant="small"
                    sx={{
                        flex: 1,
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={displayUrl}
                >
                    {displayUrl}
                </Typography>

                <Tooltip title={copied ? "Tersalin!" : "Salin Tautan"}>
                    <IconButton size="small" onClick={handleCopy} aria-label="salin tautan">
                        {copied ? (
                            <CheckRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
                        ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                        )}
                    </IconButton>
                </Tooltip>

                {url && (
                    <Tooltip title="Buka preview publik (tab baru)">
                        <IconButton
                            size="small"
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="preview aman"
                        >
                            <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};
