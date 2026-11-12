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
    Chip,
    alpha,
} from "@mui/material";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";

import { adminClient } from "@/services/adminClient";

const QUEUE_COLOR = "#0288D1";
const SUGGESTED_QUEUES = ["file-cleanup", "email-queue", "thumbnail-generator"];

export const QueueRequeuePanel: React.FC = () => {
    const [queueName, setQueueName] = useState("");
    const [itemId, setItemId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const cleanQueue = queueName.trim();
        const parsedItemId = Number(itemId.trim());

        if (!cleanQueue) {
            setFeedback({
                type: "error",
                message: "Nama antrean (Queue Name) tidak boleh kosong.",
            });
            return;
        }

        if (!itemId.trim() || isNaN(parsedItemId) || parsedItemId <= 0) {
            setFeedback({
                type: "error",
                message: "Item ID harus berupa angka positif yang valid.",
            });
            return;
        }

        setIsLoading(true);
        setFeedback(null);

        try {
            await adminClient.requeueItem({
                queueName: cleanQueue,
                id: parsedItemId,
            });
            setFeedback({
                type: "success",
                message: `Job #${parsedItemId} berhasil dimasukkan kembali ke antrean "${cleanQueue}".`,
            });
            setItemId("");
        } catch (err) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Gagal me-requeue item antrean";
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
                            bgcolor: alpha(QUEUE_COLOR, 0.1),
                            color: QUEUE_COLOR,
                            flexShrink: 0,
                        }}
                    >
                        <TerminalRoundedIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                            Manajemen Antrean Sistem
                        </Typography>
                        <Typography variant="mini" sx={{ color: "text.muted" }}>
                            Job Queue Re-queue
                        </Typography>
                    </Box>
                </Box>

                {/* Explanation */}
                <Typography
                    variant="small"
                    sx={{
                        color: "text.muted",
                        lineHeight: 1.6,
                        mb: 2,
                        display: "block",
                    }}
                >
                    Masukkan kembali job antrean yang macet atau gagal ke antrean aktif untuk diproses ulang secara otomatis oleh worker daemon.
                </Typography>

                {/* Suggested Queue Presets */}
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 2 }}>
                    <Typography variant="mini" sx={{ color: "text.muted", mr: 0.5 }}>
                        Pilihan Cepat:
                    </Typography>
                    {SUGGESTED_QUEUES.map((q) => (
                        <Chip
                            key={q}
                            label={q}
                            size="small"
                            variant={queueName === q ? "filled" : "outlined"}
                            onClick={() => setQueueName(q)}
                            sx={{
                                fontSize: "0.7rem",
                                fontFamily: "monospace",
                                cursor: "pointer",
                                bgcolor: queueName === q ? alpha(QUEUE_COLOR, 0.15) : undefined,
                                color: queueName === q ? QUEUE_COLOR : undefined,
                                borderColor: queueName === q ? QUEUE_COLOR : undefined,
                            }}
                        />
                    ))}
                </Box>

                {/* Feedback Alert */}
                {feedback && (
                    <Alert
                        severity={feedback.type}
                        onClose={() => setFeedback(null)}
                        sx={{ mb: 2, borderRadius: 1.5, fontSize: "0.8125rem" }}
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
                        label="Queue Name"
                        placeholder="file-cleanup, email-queue, dll."
                        value={queueName}
                        onChange={(e) => setQueueName(e.target.value)}
                        disabled={isLoading}
                    />

                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Item ID"
                        placeholder="Contoh: 84920"
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value)}
                        disabled={isLoading}
                        slotProps={{
                            htmlInput: { min: 1, step: 1 },
                        }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading || !queueName.trim() || !itemId.trim()}
                        startIcon={
                            isLoading ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <ReplayRoundedIcon />
                            )
                        }
                        sx={{
                            borderRadius: 1.5,
                            textTransform: "none",
                            fontWeight: 600,
                            bgcolor: QUEUE_COLOR,
                            "&:hover": {
                                bgcolor: alpha(QUEUE_COLOR, 0.88),
                            },
                        }}
                    >
                        {isLoading ? "Memproses..." : "Re-Queue Item"}
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};
