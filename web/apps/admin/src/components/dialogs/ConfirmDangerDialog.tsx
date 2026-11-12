import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    TextField,
    Box,
    CircularProgress,
    alpha,
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

export interface ConfirmDangerDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmTextKeyword?: string;
    onConfirm: () => void;
    onClose: () => void;
    loading?: boolean;
}

const DANGER_COLOR = "#EA3F3F";

export const ConfirmDangerDialog: React.FC<ConfirmDangerDialogProps> = ({
    open,
    title,
    description,
    confirmTextKeyword,
    onConfirm,
    onClose,
    loading = false,
}) => {
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        if (open) {
            setInputValue("");
        }
    }, [open]);

    const isKeywordRequired = Boolean(confirmTextKeyword);
    const isKeywordMatching = isKeywordRequired
        ? inputValue.trim() === confirmTextKeyword?.trim()
        : true;
    const isConfirmDisabled = !isKeywordMatching || loading;

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Enter") {
            return;
        }
        if (isConfirmDisabled) {
            return;
        }
        event.preventDefault();
        onConfirm();
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: 2.5,
                        p: 1,
                        border: "1px solid",
                        borderColor: alpha(DANGER_COLOR, 0.3),
                    },
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            bgcolor: alpha(DANGER_COLOR, 0.12),
                            color: DANGER_COLOR,
                            flexShrink: 0,
                        }}
                    >
                        <WarningAmberRoundedIcon fontSize="small" />
                    </Box>
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 700 }}
                    >
                        {title}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
                <Typography
                    variant="body"
                    sx={{ mb: 2, display: "block", color: "text.muted", lineHeight: 1.6 }}
                >
                    {description}
                </Typography>

                {isKeywordRequired && (
                    <Box sx={{ mt: 1 }}>
                        <Typography
                            variant="small"
                            sx={{
                                display: "block",
                                mb: 1,
                                fontWeight: 500,
                                color: "text.base",
                            }}
                        >
                            Ketik{" "}
                            <Typography
                                component="span"
                                variant="small"
                                sx={{
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                    bgcolor: alpha(DANGER_COLOR, 0.08),
                                    color: DANGER_COLOR,
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: 1,
                                }}
                            >
                                {confirmTextKeyword}
                            </Typography>{" "}
                            untuk mengonfirmasi tindakan ini:
                        </Typography>

                        <TextField
                            fullWidth
                            size="small"
                            autoFocus
                            placeholder={confirmTextKeyword}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            slotProps={{
                                htmlInput: {
                                    sx: {
                                        fontFamily: "monospace",
                                        fontSize: "0.875rem",
                                    },
                                },
                            }}
                        />
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 2, pt: 1, pb: 1.5 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
                    variant="outlined"
                    color="inherit"
                    size="small"
                    sx={{ borderRadius: 1.5, textTransform: "none" }}
                >
                    Batal
                </Button>

                <Button
                    onClick={onConfirm}
                    disabled={isConfirmDisabled}
                    variant="contained"
                    color="critical"
                    size="small"
                    sx={{
                        borderRadius: 1.5,
                        textTransform: "none",
                        fontWeight: 600,
                    }}
                >
                    {loading ? (
                        <CircularProgress size={18} color="accent" />
                    ) : (
                        "Konfirmasi Bahaya"
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
