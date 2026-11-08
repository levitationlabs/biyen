import "package:ente_components/ente_components.dart";
import "package:ente_strings/ente_strings.dart";
import "package:ente_ui/components/settings/about_settings_section.dart";
import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";
import "package:package_info_plus/package_info_plus.dart";
import "package:photos/service_locator.dart";
import "package:photos/ui/notification/toast.dart";
import "package:photos/ui/notification/update/change_log_page.dart";
import "package:photos/ui/settings/about/double_encryption_diagram.dart";
import "package:photos/ui/settings/app_update_sheet.dart";
import "package:url_launcher/url_launcher_string.dart";

class AboutUsPage extends StatelessWidget {
  const AboutUsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.strings;
    final isId = Localizations.localeOf(context).languageCode == "id";

    return SettingsPageScaffold(
      title: l10n.about,
      children: [
        SettingsItem(
          title: l10n.whatsNew,
          icon: HugeIcons.strokeRoundedParty,
          showOnlyLoadingState: true,
          onTap: () => showChangeLogSheet(context),
        ),
        const SizedBox(height: Spacing.sm),
        AboutSettingsSection(
          onCheckForUpdates: updateService.isIndependent()
              ? () => _checkForUpdates(context)
              : null,
        ),
        const SizedBox(height: Spacing.sm),
        SettingsItem(
          title: isId
              ? "Lisensi Sumber Terbuka"
              : "Open Source Licenses",
          icon: HugeIcons.strokeRoundedCertificate01,
          showOnlyLoadingState: true,
          onTap: () async {
            final packageInfo = await PackageInfo.fromPlatform();
            if (!context.mounted) return;
            showLicensePage(
              context: context,
              applicationName: "Biyen Photos",
              applicationVersion: packageInfo.version,
              applicationLegalese:
                  "GNU Affero General Public License v3 (AGPLv3)\n\n"
                  "Biyen Photos is an independent fork of and powered by "
                  "the open-source architecture of Ente Photos.\n"
                  "Copyright (c) Levitation & Ente Technologies, Inc.",
            );
          },
        ),
        const DoubleEncryptionDiagram(),
        _buildCenteredFooter(context, isId: isId),
      ],
    );
  }

  Widget _buildCenteredFooter(BuildContext context, {required bool isId}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor =
        isDark ? const Color(0xFFC0B8B2) : const Color(0xFF6E645E);
    final mutedTextColor =
        isDark ? const Color(0xFF7A706A) : const Color(0xFF9E928A);

    return Padding(
      padding: const EdgeInsets.only(
        top: Spacing.xl,
        bottom: Spacing.xxl,
        left: 16,
        right: 16,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.asset(
              "assets/qr_logo.png",
              width: 24,
              height: 24,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            "Biyen Photos",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: "Outfit",
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF2C2523),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isId
                ? "Biyen Photos adalah proyek independen berbasis fork dari Ente Photos yang dilisensikan di bawah GNU Affero General Public License v3 (AGPLv3).\n\nDitenagai oleh arsitektur open-source Ente Technologies, Inc. Dikembangkan oleh Levitation tanpa afiliasi resmi dengan Ente Technologies, Inc."
                : "Biyen Photos is an independent fork of Ente Photos licensed under the GNU Affero General Public License v3 (AGPLv3).\n\nPowered by the open-source architecture of Ente Technologies, Inc. Developed by Levitation and not affiliated with or endorsed by Ente Technologies, Inc.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              height: 1.5,
              color: primaryTextColor,
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => launchUrlString(
              "https://github.com/levitation-id/biyen",
              mode: LaunchMode.externalApplication,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isId ? "Repositori Kode Sumber" : "Source Code Repository",
                  style: const TextStyle(
                    fontFamily: "Outfit",
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFC8502E),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.open_in_new_rounded,
                  size: 12,
                  color: Color(0xFFC8502E),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            "Hak Cipta © 2026 Levitation & Ente Technologies, Inc.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              color: mutedTextColor,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _checkForUpdates(BuildContext context) async {
    final shouldUpdate = await updateService.shouldUpdate();
    final latestVersion = updateService.getLatestVersionInfo();
    if (!context.mounted) return;
    if (latestVersion == null) {
      showShortToast(context, context.strings.unableToCheckForUpdatesRightNow);
      return;
    }
    if (!shouldUpdate) {
      showShortToast(context, context.strings.youAreOnTheLatestVersion);
      return;
    }
    await showAppUpdateSheet(context, latestVersionInfo: latestVersion);
  }
}
