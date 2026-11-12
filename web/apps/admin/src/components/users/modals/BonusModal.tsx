import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Chip,
    MenuItem,
    Alert,
    CircularProgress,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import RedeemRoundedIcon from "@mui/icons-material/RedeemRounded";
import { adminClient } from "@/services/adminClient";
import type { StorageBonusPayload } from "@/types/admin";

const DEFAULT_BONUS_TYPE = "STORAGE_BONUS";
const DEFAULT_CAPACITY_GB = 10;
const CAPACITY_PRESETS = [10, 20, 50, 100];

const BONUS_TYPES = [
    { value: "STORAGE_BONUS", label: "Storage Bonus (Standar)" },
    { value: "PROMOTIONAL", label: "Bonus Promosi / Event" },
    { value: "COMMUNITY_CONTRIBUTOR", label: "Kontributor Komunitas" },
    { value: "REFERRAL", label: "Bonus Undangan / Referral" },
];

export interface BonusModalProps {
    open: boolean;
    user: { id: number; email: string } | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const BonusModal: React.FC<BonusModalProps> = ({
    open,
    user,
    onClose,
    onSuccess,
}) => {
    const currentYear = new Date().getFullYear();
    const [action, setAction] = useState<StorageBonusPayload["action"]>("ADD");
    const [bonusType, setBonusType] = useState<string>(DEFAULT_BONUS_TYPE);
    const [storageInGB, setStorageInGB] = useState<number>(DEFAULT_CAPACITY_GB);
    const [year, setYear] = useState<number>(currentYear);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        setAction("ADD");
        setBonusType(DEFAULT_BONUS_TYPE);
        setStorageInGB(DEFAULT_CAPACITY_GB);
        setYear(new Date().getFullYear());
        setErrorMessage(null);
    }, [open]);

    const handleActionChange = (
        _: React.MouseEvent<HTMLElement>,
        newAction: StorageBonusPayload["action"] | null
    ) => {
        if (newAction) {
            setAction(newAction);
        }
    };

    const handleSave = async () => {
        if (!user) {
            return;
        }
        if (action !== "REMOVE" && (storageInGB <= 0 || Number.isNaN(storageInGB))) {
            setErrorMessage("Kapasitas bonus harus lebih besar dari 0 GB");
            return;
        }
        if (year < 2020 || Number.isNaN(year)) {
            setErrorMessage("Tahun alokasi bonus tidak valid");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            await adminClient.updateBonus({
                userID: user.id,
                bonusType,
                storageInGB: action === "REMOVE" ? 0 : storageInGB,
                year,
                action,
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Gagal mengelola kuota bonus pengguna";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={isLoading ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            bgcolor: "rgba(46, 125, 50, 0.12)",
                            color: "#2E7D32",
                        }}
                    >
                        <RedeemRoundedIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Kelola Bonus Penyimpanan
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted" }}>
                            {user?.email}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5 }}>
                {errorMessage && (
                    <Alert severity="error" sx={{ mb: 2.5 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Tindakan Bonus:
                </Typography>
                <ToggleButtonGroup
                    value={action}
                    exclusive
                    onChange={handleActionChange}
                    fullWidth
                    size="small"
                    sx={{ mb: 2.5 }}
                >
                    <ToggleButton value="ADD" sx={{ fontWeight: 600 }}>
                        Tambah (ADD)
                    </ToggleButton>
                    <ToggleButton value="UPDATE" sx={{ fontWeight: 600 }}>
                        Perbarui (UPDATE)
                    </ToggleButton>
                    <ToggleButton value="REMOVE" sx={{ fontWeight: 600, color: "error.main" }}>
                        Hapus (REMOVE)
                    </ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Jenis Bonus:
                </Typography>
                <TextField
                    select
                    size="small"
                    fullWidth
                    value={bonusType}
                    onChange={(e) => setBonusType(e.target.value)}
                    disabled={isLoading}
                    sx={{ mb: 2.5 }}
                >
                    {BONUS_TYPES.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </TextField>

                {action !== "REMOVE" && (
                    <>
                        <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                            Preset Kapasitas Bonus:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
                            {CAPACITY_PRESETS.map((preset) => {
                                const isSelected = storageInGB === preset;
                                return (
                                    <Chip
                                        key={preset}
                                        label={`${preset} GB`}
                                        clickable
                                        color={isSelected ? "primary" : "default"}
                                        variant={isSelected ? "filled" : "outlined"}
                                        onClick={() => setStorageInGB(preset)}
                                        sx={{
                                            fontWeight: 600,
                                            ...(isSelected && {
                                                bgcolor: "rgba(46, 125, 50, 0.12)",
                                                color: "#2E7D32",
                                                borderColor: "#2E7D32",
                                            }),
                                        }}
                                    />
                                );
                            })}
                        </Stack>

                        <TextField
                            type="number"
                            label="Kapasitas Tambahan (GB)"
                            size="small"
                            fullWidth
                            value={storageInGB}
                            onChange={(e) => setStorageInGB(Number(e.target.value))}
                            disabled={isLoading}
                            slotProps={{ htmlInput: { min: 1 } }}
                            sx={{ mb: 2.5 }}
                        />
                    </>
                )}

                <TextField
                    type="number"
                    label="Tahun Alokasi / Durasi (Tahun)"
                    size="small"
                    fullWidth
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    disabled={isLoading}
                    helperText="Tahun berlakunya alokasi bonus kuota ini."
                />
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isLoading} color="inherit">
                    Batal
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    variant="contained"
                    color={action === "REMOVE" ? "critical" : "accent"}
                    sx={{ minWidth: 140, fontWeight: 600 }}
                >
                    {isLoading ? (
                        <CircularProgress size={20} color="inherit" />
                    ) : action === "REMOVE" ? (
                        "Hapus Bonus"
                    ) : (
                        "Simpan Bonus"
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
