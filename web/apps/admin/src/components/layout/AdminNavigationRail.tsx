import React from "react";
import { useRouter } from "next/router";
import { Box, Tooltip } from "@mui/material";
import {
    DashboardSquare01Icon,
    UserMultiple02Icon,
    Shield01Icon,
    Settings01Icon,
    Key01Icon,
    Image01Icon,
    Logout01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FocusVisibleButton } from "ente-base/components/mui/FocusVisibleButton";

export interface NavRailItem {
    label: string;
    href: string;
    icon: typeof DashboardSquare01Icon;
}

export const ADMIN_RAIL_ITEMS: NavRailItem[] = [
    {
        label: "Dashboard",
        href: "/",
        icon: DashboardSquare01Icon,
    },
    {
        label: "Pengguna & Kuota",
        href: "/users",
        icon: UserMultiple02Icon,
    },
    {
        label: "Abuse Center",
        href: "/abuse",
        icon: Shield01Icon,
    },
    {
        label: "Pemeliharaan Sistem",
        href: "/system",
        icon: Settings01Icon,
    },
];

export interface AdminNavigationRailProps {
    onOpenSudoModal?: () => void;
    onLogout?: () => void;
}

export const AdminNavigationRail: React.FC<AdminNavigationRailProps> = ({
    onOpenSudoModal,
    onLogout,
}) => {
    const router = useRouter();
    const currentPath = router.pathname;

    const isItemActive = (href: string): boolean => {
        if (href === "/") {
            return currentPath === "/";
        }
        return currentPath.startsWith(href);
    };

    const handleNavigate = (href: string) => {
        router.push(href);
    };

    return (
        <Box
            component="nav"
            aria-label="Admin Navigation Rail"
            sx={{
                width: 72,
                minWidth: 72,
                maxWidth: 72,
                height: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                py: 2,
                gap: "12px",
                borderRight: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
            }}
        >
            {/* Primary Navigation Items */}
            {ADMIN_RAIL_ITEMS.map((item) => {
                const active = isItemActive(item.href);
                return (
                    <Tooltip key={item.href} title={item.label} placement="right" arrow>
                        <FocusVisibleButton
                            color="secondary"
                            aria-label={item.label}
                            aria-pressed={active}
                            onClick={() => handleNavigate(item.href)}
                            sx={{
                                minWidth: 0,
                                width: 42,
                                height: 42,
                                flexShrink: 0,
                                p: 0,
                                borderRadius: "12px",
                                color: active ? "#FFFFFF" : "text.base",
                                bgcolor: active ? "accent.main" : "transparent",
                                transition: "all 0.15s ease",
                                "&:hover": {
                                    bgcolor: active ? "accent.main" : "fill.faint",
                                },
                            }}
                        >
                            <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.8} />
                            {/* Accessible label for screen readers & text-content matching */}
                            <Box
                                component="span"
                                sx={{
                                    position: "absolute",
                                    width: 1,
                                    height: 1,
                                    p: 0,
                                    m: -1,
                                    overflow: "hidden",
                                    clip: "rect(0, 0, 0, 0)",
                                    whiteSpace: "nowrap",
                                    border: 0,
                                }}
                            >
                                {item.label}
                            </Box>
                        </FocusVisibleButton>
                    </Tooltip>
                );
            })}

            {/* Separator Line */}
            <Box
                aria-hidden
                sx={(theme) => ({
                    width: 38,
                    height: "2px",
                    flexShrink: 0,
                    opacity: 0.5,
                    bgcolor: "#E0E0E0",
                    ...theme.applyStyles("dark", { bgcolor: "#3E3E3E" }),
                })}
            />

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Sudo Token Renewal Button */}
            {onOpenSudoModal && (
                <Tooltip title="Ubah Token Sudo Admin" placement="right" arrow>
                    <FocusVisibleButton
                        color="secondary"
                        aria-label="Ubah Token Sudo Admin"
                        onClick={onOpenSudoModal}
                        sx={{
                            minWidth: 0,
                            width: 42,
                            height: 42,
                            flexShrink: 0,
                            p: 0,
                            borderRadius: "12px",
                            color: "text.base",
                            "&:hover": { bgcolor: "fill.faint" },
                        }}
                    >
                        <HugeiconsIcon icon={Key01Icon} size={20} strokeWidth={1.8} />
                    </FocusVisibleButton>
                </Tooltip>
            )}

            {/* Link to Photos Web App */}
            <Tooltip title="Buka Galeri Foto Biyen" placement="right" arrow>
                <FocusVisibleButton
                    color="secondary"
                    aria-label="Buka Galeri Foto Biyen"
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.open("https://app-biyen.levitation.web.id", "_blank", "noopener,noreferrer");
                        }
                    }}
                    sx={{
                        minWidth: 0,
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        p: 0,
                        borderRadius: "12px",
                        color: "text.base",
                        "&:hover": { bgcolor: "fill.faint" },
                    }}
                >
                    <HugeiconsIcon icon={Image01Icon} size={20} strokeWidth={1.8} />
                </FocusVisibleButton>
            </Tooltip>

            {/* Logout Button */}
            {onLogout && (
                <Tooltip title="Keluar dari Admin" placement="right" arrow>
                    <FocusVisibleButton
                        color="secondary"
                        aria-label="Keluar dari Admin"
                        onClick={onLogout}
                        sx={{
                            minWidth: 0,
                            width: 42,
                            height: 42,
                            flexShrink: 0,
                            p: 0,
                            borderRadius: "12px",
                            color: "text.muted",
                            mb: 1,
                            "&:hover": { color: "error.main", bgcolor: "fill.faint" },
                        }}
                    >
                        <HugeiconsIcon icon={Logout01Icon} size={20} strokeWidth={1.8} />
                    </FocusVisibleButton>
                </Tooltip>
            )}
        </Box>
    );
};
