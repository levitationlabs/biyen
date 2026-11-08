import { AuthShell } from "@/components/AuthShell";
import { WebMaintenanceView } from "@/components/WebMaintenanceView";
import SignUpFromAccounts from "ente-accounts/pages/signup";
import { isDevBuild } from "ente-base/env";
import React, { useEffect, useState } from "react";

const SignUpPage: React.FC = () => {
    const [isDev, setIsDev] = useState(isDevBuild);

    useEffect(() => {
        if (
            isDevBuild ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            new URLSearchParams(window.location.search).get("dev") === "true" ||
            window.localStorage?.getItem("biyen_dev_mode") === "true"
        ) {
            setIsDev(true);
        }
    }, []);

    if (isDev) {
        return <SignUpFromAccounts />;
    }

    return (
        <AuthShell>
            <WebMaintenanceView onBypass={() => setIsDev(true)} />
        </AuthShell>
    );
};

export default SignUpPage;
