import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    styled,
    useMediaQuery,
} from "@mui/material";
import type { ButtonishProps } from "ente-base/components/mui";
import { bytesInGB, formattedStorageByteSize } from "ente-gallery/utils/units";
import { UnstyledButton } from "ente-new/photos/components/UnstyledButton";
import type { UserDetails } from "ente-new/photos/services/user-details";
import {
    familyMemberStorageLimit,
    familyUsage,
    isPartOfFamilyWithOtherMembers,
} from "ente-new/photos/services/user-details";
import { t } from "i18next";
import type React from "react";

interface SubscriptionCardProps {
    userDetails: UserDetails | undefined;
    onClick: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
    userDetails,
    onClick,
}) =>
    !userDetails ? (
        <Skeleton
            animation="wave"
            variant="rectangular"
            height={130}
            sx={{ borderRadius: "15px" }}
        />
    ) : (
        <Box
            sx={{
                position: "relative",
                color: "white",
                minHeight: 130,
                borderRadius: "15px",
                fontFamily: "'Outfit Variable', sans-serif",
                backgroundImage:
                    "radial-gradient(circle, rgba(255, 255, 255, 0.024) 1.45px, transparent 1.45px), linear-gradient(to top, #212121, #434343)",
                backgroundSize: "15.65px 15.65px, 100% 100%",
                "& .MuiTypography-root": { fontFamily: "inherit" },
            }}
        >
            <SubscriptionCardContentOverlay userDetails={userDetails} />
            <ClickOverlay onClick={onClick} />
        </Box>
    );

const ClickOverlay: React.FC<ButtonishProps> = ({ onClick }) => (
    <ClickOverlayButton onClick={onClick}>
        <ChevronRightIcon />
    </ClickOverlayButton>
);

const ClickOverlayButton = styled(UnstyledButton)(
    ({ theme }) => `
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;

    display: flex;
    justify-content: flex-end;
    align-items: center;

    color: inherit;
    border-radius: 15px;

    & > svg {
        margin-inline-end: 8px;
    }

    &:focus-visible {
        outline: 1.5px solid ${theme.vars.palette.stroke.base};
        outline-offset: 2px;
        border-radius: 15px;
    }
    &:active {
        outline: 2px solid ${theme.vars.palette.stroke.faint};
        outline-offset: 1px;
        border-radius: 15px;
    }
`,
);

interface SubscriptionCardContentOverlayProps {
    userDetails: UserDetails;
}

const SubscriptionCardContentOverlay: React.FC<
    SubscriptionCardContentOverlayProps
> = ({ userDetails }) => {
    const inFamily = isPartOfFamilyWithOtherMembers(userDetails);
    const storageLimit = inFamily
        ? familyMemberStorageLimit(userDetails)
        : undefined;

    return (
        <Stack sx={{ gap: "16px", padding: "20px 16px 16px" }}>
            {inFamily ? (
                storageLimit !== undefined ? (
                    <UserSubscriptionCardContents
                        userDetails={userDetails}
                        totalStorage={storageLimit}
                    />
                ) : (
                    <FamilySubscriptionCardContents userDetails={userDetails} />
                )
            ) : (
                <UserSubscriptionCardContents
                    userDetails={userDetails}
                    totalStorage={
                        userDetails.subscription.storage +
                        userDetails.storageBonus
                    }
                />
            )}
        </Stack>
    );
};

type UserSubscriptionCardContentsProps = SubscriptionCardContentOverlayProps & {
    totalStorage: number;
};

const UserSubscriptionCardContents: React.FC<
    UserSubscriptionCardContentsProps
> = ({ userDetails, totalStorage }) => (
    <>
        <StorageSection storage={totalStorage} usage={userDetails.usage} />
        <IndividualUsageSection
            usage={userDetails.usage}
            fileCount={userDetails.fileCount}
            storage={totalStorage}
        />
    </>
);

interface StorageSectionProps {
    usage: number;
    storage: number;
}

const StorageSection: React.FC<StorageSectionProps> = ({ usage, storage }) => {
    const isExtraSmallWidth = useMediaQuery("(width < 360px)");
    const isUnsubscribed = storage <= 0;
    const label = isUnsubscribed ? (
        t("no_active_plan", "Belum Berlangganan")
    ) : isExtraSmallWidth ? (
        `${bytesInGB(usage)} /  ${bytesInGB(storage)} ${t("storage_unit.gb")} ${t("used")}`
    ) : (
        <>
            {formattedStorageByteSize(usage, { round: true })}
            <Box component="span" sx={{ opacity: 0.7, whiteSpace: "pre" }}>
                {`  ${t("of")}  `}
            </Box>
            {`${formattedStorageByteSize(storage)} ${t("used")}`}
        </>
    );

    return (
        <Box>
            <Stack
                direction="row"
                sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: "2px",
                }}
            >
                <Typography variant="tiny" sx={{ opacity: 0.7 }}>
                    {t("storage")}
                </Typography>
                {isUnsubscribed && (
                    <Box
                        sx={{
                            fontSize: "10px",
                            fontWeight: 700,
                            px: 1,
                            py: 0.25,
                            borderRadius: "10px",
                            backgroundColor: "rgba(200, 80, 46, 0.2)",
                            color: "#FF8A65",
                            letterSpacing: "0.02em",
                        }}
                    >
                        {t("no_plan", "No Plan")}
                    </Box>
                )}
            </Stack>
            <Typography
                variant="h3"
                noWrap
                sx={{
                    fontSize: isUnsubscribed ? "20px" : "24px",
                    lineHeight: "32px",
                    fontWeight: 700,
                    letterSpacing: "-1px",
                    paddingInlineEnd: "24px",
                }}
            >
                {label}
            </Typography>
        </Box>
    );
};

interface UsageStorage {
    usage: number;
    storage: number;
}

type IndividualUsageSectionProps = UsageStorage & { fileCount: number };

const IndividualUsageSection: React.FC<IndividualUsageSectionProps> = ({
    usage,
    storage,
    fileCount,
}) => {
    const isUnsubscribed = storage <= 0;
    return (
        // Use the unsuffixed key as the fallback for languages with more plural forms.
        <Stack sx={{ gap: 1.5 }}>
            <UsageBar>
                <UsageBarSegment {...{ usage, storage }} fillColor="#C8502E" />
            </UsageBar>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="tiny">
                    {isUnsubscribed
                        ? t("choose_plan_cta", "Pilih paket untuk mengunggah")
                        : `${formattedStorageByteSize(Math.max(0, storage - usage))} ${t("free")}`}
                </Typography>
                <Typography
                    variant="tiny"
                    sx={{ fontWeight: 600, color: "rgba(165, 165, 165, 0.79)" }}
                >
                    {t("photos_count", { count: fileCount })}
                </Typography>
            </Stack>
        </Stack>
    );
};

const UsageBar = styled("div")`
    position: relative;
    height: 4px;
    border-radius: 2px;
    background-color: rgba(193, 193, 193, 0.11);
`;

type UsageBarSegmentProps = UsageStorage & { fillColor: string };

const UsageBarSegment: React.FC<UsageBarSegmentProps> = ({
    usage,
    storage,
    fillColor,
}) => (
    <Box
        sx={{
            position: "absolute",
            left: 0,
            top: 0,
            width: storage > 0 ? "max(var(--et-width), 2px)" : "0px",
            height: "4px",
            borderRadius: "2px",
            backgroundColor: "var(--et-background-color)",
        }}
        style={
            {
                "--et-width": `${storage > 0 ? Math.min(usage / storage, 1) * 100 : 0}%`,
                "--et-background-color": fillColor,
            } as React.CSSProperties
        }
    />
);

const FamilySubscriptionCardContents: React.FC<
    SubscriptionCardContentOverlayProps
> = ({ userDetails }) => {
    const usage = familyUsage(userDetails);
    const storage =
        (userDetails.familyData?.storage ?? 0) + userDetails.storageBonus;

    return (
        <>
            <StorageSection {...{ storage, usage }} />
            <FamilyUsageSection
                userUsage={userDetails.usage}
                fileCount={userDetails.fileCount}
                {...{ storage, usage }}
            />
        </>
    );
};

type FamilyUsageSectionProps = UsageStorage & {
    userUsage: number;
    fileCount: number;
};

const FamilyUsageSection: React.FC<FamilyUsageSectionProps> = ({
    usage,
    storage,
    userUsage,
    fileCount,
}) => (
    <Stack sx={{ gap: 1.5 }}>
        <UsageBar>
            <UsageBarSegment {...{ usage, storage }} fillColor="#F4D93B" />
            <UsageBarSegment
                {...{ storage }}
                usage={userUsage}
                fillColor="#C8502E"
            />
        </UsageBar>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Stack direction="row" sx={{ gap: 1.5 }}>
                <Legend label={t("you")} color="#C8502E" />
                <Legend label={t("family")} color="#F4D93B" />
            </Stack>
            <Typography
                variant="tiny"
                sx={{ fontWeight: 600, color: "rgba(165, 165, 165, 0.79)" }}
            >
                {t("photos_count", { count: fileCount })}
            </Typography>
        </Stack>
    </Stack>
);

interface LegendProps {
    label: string;
    color: string;
}

const Legend: React.FC<LegendProps> = ({ label, color }) => (
    <Stack direction="row" sx={{ alignItems: "center" }}>
        <LegendDot sx={{ color }} />
        <Typography variant="tiny" sx={{ fontWeight: 600 }}>
            {label}
        </Typography>
    </Stack>
);

const LegendDot = styled("span")`
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    margin-inline-end: 4px;
    border-radius: 50%;
    background-color: currentColor;
`;
