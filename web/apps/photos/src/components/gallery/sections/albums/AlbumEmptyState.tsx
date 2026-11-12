import { ImageAdd02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Box, Stack, Typography } from "@mui/material";
import { FocusVisibleButton } from "ente-base/components/mui/FocusVisibleButton";
import { t } from "i18next";

export function AlbumEmptyState({ onAddPhotos }: { onAddPhotos?: () => void }) {
    return (
        <Stack
            sx={{
                alignItems: "center",
                gap: "30.31px",
                width: "100%",
                minWidth: 0,
                px: { xs: 0, sm: 3 },
                py: 3,
            }}
        >
            <Box
                aria-hidden
                sx={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 220,
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Box
                    component="img"
                    src="/images/biyen/gani_transparent_default.svg"
                    alt=""
                    sx={{
                        width: "100%",
                        height: "auto",
                        maxHeight: 200,
                        objectFit: "contain",
                    }}
                />
            </Box>
            <Stack sx={{ alignItems: "center", gap: 1.5 }}>
                <Typography
                    sx={{
                        fontFamily: "'Outfit Variable', sans-serif",
                        fontWeight: 600,
                        fontSize: { xs: 28, sm: "36.372px" },
                        lineHeight: "1.333333",
                        color: "text.base",
                        textAlign: "center",
                    }}
                >
                    {t("nothing_to_see_here")}
                </Typography>
                {onAddPhotos && (
                    <FocusVisibleButton
                        color="secondary"
                        onClick={onAddPhotos}
                        startIcon={
                            <HugeiconsIcon
                                icon={ImageAdd02Icon}
                                size={20}
                                strokeWidth={1.8}
                            />
                        }
                        sx={{
                            minWidth: 140,
                            height: 52,
                            px: 3,
                            borderRadius: "20px",
                            border: 0,
                            fontSize: "14px",
                            fontWeight: 600,
                            lineHeight: "20px",
                            gap: 1,
                            "& .MuiButton-startIcon": { m: 0 },
                        }}
                    >
                        {t("add_photos")}
                    </FocusVisibleButton>
                )}
            </Stack>
        </Stack>
    );
}
