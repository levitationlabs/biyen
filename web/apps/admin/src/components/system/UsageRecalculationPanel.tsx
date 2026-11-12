import React, { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    alpha,
} from "@mui/material";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";

import { adminClient } from "@/services/adminClient";

const TERRACOTTA_COLOR = "#C8502E";

export const UsageRecalculationPanel: React.FC = () => {
    const [userId, setUserId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const trimmed = userId.trim();
        const parsedId = Number(trimmed);

        if (!trimmed || isNaN(parsedId) || parsedId <= 0) {
            setFeedback({
                type: "error",
                message: "User ID harus berupa angka positif yang valid.",
            });
            return;
        }

        setIsLoading(true);
        setFeedback(null);

        try {
            const res = await adminClient.initFileCounts(parsedId);
            const reasonText = res.reason ? ` (${res.reason})` : "";
            const statusText = res.initialized
                ? "Berhasil diinisialisasi"
                : "Sudah terhitung / tidak ada perubahan";

            setFeedback({
                type: "success",
                message: `Kalkulasi file count User ID #${parsedId}: ${statusText}${reasonText}`,
            });
            setUserId("");
        } catch (err) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Gagal menginisialisasi kalkulasi file count";
            setFeedback({ type: "error", message: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card
            sx={{
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: "none",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <CardContent sx={{ p: { xs: 2.5, sm: 3 }, flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Header with Icon */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: alpha(TERRACOTTA_COLOR, 0.1),
                            color: TERRACOTTA_COLOR,
                            flexShrink: 0,
                        }}
                    >
                        <StorageRoundedIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                            Kalkulasi Ulang Penyimpanan
                        </Typography>
                        <Typography variant="mini" sx={{ color: "text.muted" }}>
                            Usage Recalculation
                        </Typography>
                    </Box>
                </Box>

                {/* Explanation */}
                <Typography
                    variant="small"
                    sx={{
                        color: "text.muted",
                        lineHeight: 1.6,
                        mb: 2.5,
                        display: "block",
                    }}
                >
                    Menghitung ulang pemakaian kuota aktual dari database files. Jalankan fungsi ini jika terjadi ketidaksesuaian antara kuota yang tercatat di akun dengan total file fisik tersimpan.
                </Typography>

                {/* Feedback Alert */}
                {feedback && (
                    <Alert
                        severity={feedback.type}
                        onClose={() => setFeedback(null)}
                        sx={{ mb: 2.5, borderRadius: 1.5, fontSize: "0.8125rem" }}
                    >
                        {feedback.message}
                    </Alert>
                )}

                {/* Form */}
                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 2 }}
                >
                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="User ID"
                        placeholder="Contoh: 1042"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        disabled={isLoading}
                        slotProps={{
                            htmlInput: { min: 1, step: 1 },
                        }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading || !userId.trim()}
                        startIcon={
                            isLoading ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <SyncRoundedIcon />
                            )
                        }
                        sx={{
                            borderRadius: 1.5,
                            textTransform: "none",
                            fontWeight: 600,
                            bgcolor: TERRACOTTA_COLOR,
                            "&:hover": {
                                bgcolor: alpha(TERRACOTTA_COLOR, 0.88),
                            },
                        }}
                    >
                        {isLoading ? "Menghitung..." : "Hitung Ulang File Count"}
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};
