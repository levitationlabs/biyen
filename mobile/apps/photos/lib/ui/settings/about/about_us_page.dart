import "package:ente_components/ente_components.dart";
import "package:ente_strings/ente_strings.dart";
import "package:ente_ui/components/settings/about_settings_section.dart";
import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";
import "package:package_info_plus/package_info_plus.dart";
import "package:photos/service_locator.dart";
import "package:photos/ui/notification/toast.dart";
import "package:photos/ui/notification/update/change_log_page.dart";
import "package:photos/ui/settings/app_update_sheet.dart";
import "package:url_launcher/url_launcher_string.dart";

class AboutUsPage extends StatelessWidget {
  const AboutUsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.strings;
    final isId = Localizations.localeOf(context).languageCode == 'id';

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
        _buildLegalNotice(context, isId: isId),
      ],
    );
  }

  Widget _buildLegalNotice(BuildContext context, {required bool isId}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.only(top: Spacing.xl, bottom: Spacing.xxl),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF202020) : const Color(0xFFF9F7F5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? const Color(0xFF2E2E2E) : const Color(0xFFEFEBE6),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.gavel_rounded,
                size: 16,
                color: isDark ? const Color(0xFFAAAAAA) : const Color(0xFF756860),
              ),
              const SizedBox(width: 8),
              Text(
                isId ? "Kepatuhan Lisensi & Atribusi" : "License & Attribution",
                style: TextStyle(
                  fontFamily: "Outfit",
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF2C2523),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            isId
                ? "Biyen Photos adalah proyek independen berbasis fork dari Ente Photos, ditenagai oleh arsitektur open-source Ente Technologies, Inc., dan dilisensikan di bawah GNU Affero General Public License v3 (AGPLv3)."
                : "Biyen Photos is an independent fork of Ente Photos, powered by the open-source architecture of Ente Technologies, Inc., and licensed under the GNU Affero General Public License v3 (AGPLv3).",
            style: TextStyle(
              fontSize: 11,
              height: 1.5,
              color: isDark ? const Color(0xFFB0A8A0) : const Color(0xFF6B5E56),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isId
                ? "Biyen dikembangkan oleh Levitation dan tidak berafiliasi, disponsori, atau didukung secara resmi oleh Ente Technologies, Inc."
                : "Biyen is developed by Levitation and is not affiliated with, endorsed by, or sponsored by Ente Technologies, Inc.",
            style: TextStyle(
              fontSize: 11,
              height: 1.5,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF888888) : const Color(0xFF8C7D73),
            ),
          ),
          const SizedBox(height: 10),
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
