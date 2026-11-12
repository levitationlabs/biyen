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
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";

import { adminClient } from "@/services/adminClient";

const MAILER_COLOR = "#2E7D32";

export const SystemMailerPanel: React.FC = () => {
    const [recipientEmails, setRecipientEmails] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const recipients = recipientEmails
            .split(",")
            .map((email) => email.trim())
            .filter((email) => email.length > 0);

        if (recipients.length === 0) {
            setFeedback({
                type: "error",
                message: "Masukkan setidaknya satu alamat email tujuan.",
            });
            return;
        }

        const cleanSubject = subject.trim();
        const cleanBody = body.trim();

        if (!cleanSubject) {
            setFeedback({
                type: "error",
                message: "Subjek email tidak boleh kosong.",
            });
            return;
        }

        if (!cleanBody) {
            setFeedback({
                type: "error",
                message: "Isi pesan email tidak boleh kosong.",
            });
            return;
        }

        setIsLoading(true);
        setFeedback(null);

        try {
            await adminClient.sendTestMail({
                to: recipients,
                subject: cleanSubject,
                body: cleanBody,
            });
            setFeedback({
                type: "success",
                message: `Email uji coba berhasil dikirim ke: ${recipients.join(", ")}`,
            });
            setSubject("");
            setBody("");
        } catch (err) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Gagal mengirimkan email uji coba";
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
                            bgcolor: alpha(MAILER_COLOR, 0.1),
                            color: MAILER_COLOR,
                            flexShrink: 0,
                        }}
                    >
                        <EmailRoundedIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                            Pengujian Pengiriman Email
                        </Typography>
                        <Typography variant="mini" sx={{ color: "text.muted" }}>
                            System Mailer
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
                    Form uji coba kirim email operasional melalui Museum Server API untuk memverifikasi fungsionalitas dan konfigurasi SMTP/SES.
                </Typography>

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
                        type="email"
                        label="Email Tujuan"
                        placeholder="admin@biyen.id, team@biyen.id"
                        value={recipientEmails}
                        onChange={(e) => setRecipientEmails(e.target.value)}
                        disabled={isLoading}
                        helperText="Pisahkan koma jika lebih dari satu alamat email"
                    />

                    <TextField
                        fullWidth
                        size="small"
                        label="Subjek Email"
                        placeholder="Uji Coba Pengiriman Sistem Biyen"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={isLoading}
                    />

                    <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        label="Isi Pesan"
                        placeholder="Halo, ini adalah pengujian transmisi mailer dari Biyen Admin WebUI..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={isLoading}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={
                            isLoading ||
                            !recipientEmails.trim() ||
                            !subject.trim() ||
                            !body.trim()
                        }
                        startIcon={
                            isLoading ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <SendRoundedIcon />
                            )
                        }
                        sx={{
                            borderRadius: 1.5,
                            textTransform: "none",
                            fontWeight: 600,
                            bgcolor: MAILER_COLOR,
                            "&:hover": {
                                bgcolor: alpha(MAILER_COLOR, 0.88),
                            },
                        }}
                    >
                        {isLoading ? "Mengirim..." : "Kirim Email Uji Coba"}
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};
