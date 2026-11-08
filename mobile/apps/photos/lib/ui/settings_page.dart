import "dart:async";

import "package:ente_components/ente_components.dart";
import "package:ente_lock_screen/local_authentication_service.dart";
import "package:ente_pure_utils/ente_pure_utils.dart";
import "package:ente_strings/ente_strings.dart";
import "package:ente_ui/components/settings/app_version_widget.dart";
import "package:ente_ui/pages/settings_search_page.dart";
import "package:flutter/foundation.dart";
import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";
import "package:photos/core/configuration.dart";
import "package:photos/emergency/emergency_page.dart";
import "package:photos/models/user_details.dart";
import "package:photos/service_locator.dart";
import "package:photos/services/account/user_service.dart";
import "package:photos/ui/account/email_entry_page.dart";
import "package:photos/ui/account/login_page.dart";
import "package:photos/ui/components/banners/offline_settings_banner.dart";
import "package:photos/ui/growth/referral_screen.dart";
import "package:photos/ui/notification/toast.dart";
import "package:photos/ui/notification/update/change_log_page.dart";
import "package:photos/ui/settings/about/about_us_page.dart";
import "package:photos/ui/settings/account/account_settings_page.dart";
import "package:photos/ui/settings/appearance/appearance_settings_page.dart";
import "package:photos/ui/settings/backup/backup_settings_page.dart";
import "package:photos/ui/settings/backup/free_space_options.dart";
import "package:photos/ui/settings/cast/cast_settings_page.dart";
import "package:photos/ui/settings/debug/debug_settings_page.dart";
import "package:photos/ui/settings/debug/ml_debug_settings_page.dart";
import "package:photos/ui/settings/inherited_settings_state.dart";
import "package:photos/ui/settings/memories_settings_screen.dart";
import "package:photos/ui/settings/ml/machine_learning_settings_page.dart";
import "package:photos/ui/settings/notification_settings_screen.dart";
import "package:photos/ui/settings/search/settings_search_registry.dart";
import "package:photos/ui/settings/security/security_settings_page.dart";
import "package:photos/ui/settings/storage_card_widget.dart";
import "package:photos/ui/settings/streaming/video_streaming_settings_page.dart";
import "package:photos/ui/settings/support/help_support_page.dart";
import "package:photos/ui/settings/widget_settings_screen.dart";
import "package:photos/ui/sharing/verify_identity_dialog.dart";
import "package:photos/utils/dialog_util.dart";

class SettingsPage extends StatelessWidget {
  final ValueNotifier<String?> emailNotifier;

  const SettingsPage({super.key, required this.emailNotifier});

  @override
  Widget build(BuildContext context) {
    return SettingsStateContainer(
      child: _SettingsBody(emailNotifier: emailNotifier),
    );
  }
}

class _SettingsBody extends StatelessWidget {
  final ValueNotifier<String?> emailNotifier;

  const _SettingsBody({required this.emailNotifier});

  @override
  Widget build(BuildContext context) {
    final colors = context.componentColors;
    final hasLoggedIn = Configuration.instance.isLoggedIn();
    final hasConfiguredAccount = Configuration.instance.hasConfiguredAccount();
    final showLoginEntry = isLocalGalleryMode && !hasConfiguredAccount;

    return AnimatedBuilder(
      animation: emailNotifier,
      builder: (context, _) {
        final email = hasLoggedIn ? emailNotifier.value ?? "" : "";

        return SettingsPageScaffold(
          title: context.strings.settings,
          backButton: IconButtonComponent(
            variant: IconButtonComponentVariant.primary,
            shouldSurfaceExecutionStates: false,
            icon: const HugeIcon(icon: HugeIcons.strokeRoundedCancel01),
            onTap: () => Navigator.of(context).pop(),
          ),
          actions: _buildHeaderActions(context),
          children: [
            if (hasLoggedIn && email.isNotEmpty)
              _buildMinimalistProfileHeader(context, email, colors),
            if (showLoginEntry) ...[
              OfflineSettingsBanner(
                onGetStarted: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const EmailEntryPage(
                        showReferralSourceField: false,
                        referralSource: "Offline",
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              _buildOfflineLoginCard(context, colors),
              const SizedBox(height: 8),
            ],
            if (hasLoggedIn && !isLocalGalleryMode) ...[
              const StorageCardWidget(),
              const SizedBox(height: 8),
              _buildSectionHeader("Penyimpanan & Cadangan", colors),
              MenuGroupComponent(
                showDividers: true,
                items: [
                  _buildMenuItem(
                    title: context.strings.account,
                    icon: HugeIcons.strokeRoundedUser,
                    onTap: () async {
                      await routeToPage(context, const AccountSettingsPage());
                    },
                  ),
                  _buildMenuItem(
                    title: context.strings.backup,
                    icon: HugeIcons.strokeRoundedCloudUpload,
                    onTap: () async {
                      await routeToPage(context, const BackupSettingsPage());
                    },
                  ),
                  _buildMenuItem(
                    title: context.strings.freeUpSpace,
                    icon: HugeIcons.strokeRoundedRocket01,
                    showOnlyLoadingState: true,
                    onTap: () async {
                      await routeToPage(
                        context,
                        const FreeUpSpaceOptionsScreen(),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            _buildSectionHeader("Keamanan & Akses", colors),
            MenuGroupComponent(
              showDividers: true,
              items: [
                _buildMenuItem(
                  title: context.strings.security,
                  icon: HugeIcons.strokeRoundedSecurityCheck,
                  onTap: () async {
                    await routeToPage(context, const SecuritySettingsPage());
                  },
                ),
                if (hasLoggedIn && !isLocalGalleryMode) ...[
                  _buildLegacyMenuItem(context),
                  _buildFamilyMenuItem(context),
                  _buildReferralsMenuItem(context),
                ],
              ],
            ),
            const SizedBox(height: 8),
            _buildSectionHeader("Preferensi & Fitur", colors),
            MenuGroupComponent(
              showDividers: true,
              items: [
                _buildMenuItem(
                  title: context.strings.appearance,
                  icon: HugeIcons.strokeRoundedPaintBoard,
                  onTap: () async {
                    await routeToPage(context, const AppearanceSettingsPage());
                  },
                ),
                _buildMenuItem(
                  title: context.strings.machineLearning,
                  icon: HugeIcons.strokeRoundedMagicWand01,
                  onTap: () async {
                    await routeToPage(
                      context,
                      const MachineLearningSettingsPage(),
                    );
                  },
                ),
                _buildMenuItem(
                  title: context.strings.memories,
                  icon: HugeIcons.strokeRoundedSparkles,
                  onTap: () async {
                    await routeToPage(context, const MemoriesSettingsScreen());
                  },
                ),
                _buildMenuItem(
                  title: context.strings.notifications,
                  icon: HugeIcons.strokeRoundedNotification01,
                  onTap: () async {
                    await routeToPage(
                      context,
                      const NotificationSettingsScreen(),
                    );
                  },
                ),
                _buildMenuItem(
                  title: context.strings.widgets,
                  icon: HugeIcons.strokeRoundedAlignBoxBottomRight,
                  onTap: () async {
                    await routeToPage(context, const WidgetSettingsScreen());
                  },
                ),
                if (hasLoggedIn && !isLocalGalleryMode) ...[
                  _buildMenuItem(
                    title: context.strings.videoStreaming,
                    icon: HugeIcons.strokeRoundedVideoCameraAi,
                    onTap: () async {
                      await routeToPage(
                        context,
                        const VideoStreamingSettingsPage(),
                      );
                    },
                  ),
                  if (flagService.enableMultiCast)
                    _buildMenuItem(
                      title: context.strings.castSessions,
                      icon: HugeIcons.strokeRoundedTvSmart,
                      showOnlyLoadingState: true,
                      onTap: () async {
                        await openCastSettingsPage(context);
                      },
                    ),
                ],
                _buildMapsMenuItem(context),
              ],
            ),
            const SizedBox(height: 8),
            _buildSectionHeader("Bantuan & Informasi", colors),
            MenuGroupComponent(
              showDividers: true,
              items: [
                _buildMenuItem(
                  title: context.strings.helpAndSupport,
                  icon: HugeIcons.strokeRoundedHelpCircle,
                  onTap: () async {
                    await routeToPage(context, const HelpSupportPage());
                  },
                ),
                _buildMenuItem(
                  title: context.strings.about,
                  icon: HugeIcons.strokeRoundedInformationCircle,
                  onTap: () async {
                    await routeToPage(context, const AboutUsPage());
                  },
                ),
              ],
            ),
            if (hasLoggedIn &&
                !isLocalGalleryMode &&
                (flagService.flags.internalUser || kDebugMode)) ...[
              const SizedBox(height: 8),
              _buildSectionHeader("Pengembang", colors),
              MenuGroupComponent(
                showDividers: true,
                items: [
                  _buildMenuItem(
                    title: "Debug",
                    icon: HugeIcons.strokeRoundedBug02,
                    onTap: () async {
                      await routeToPage(context, const DebugSettingsPage());
                    },
                  ),
                  _buildMenuItem(
                    title: "ML Debug",
                    icon: HugeIcons.strokeRoundedAiBrain01,
                    onTap: () async {
                      await routeToPage(context, const MLDebugSettingsPage());
                    },
                  ),
                ],
              ),
            ],
            if (hasLoggedIn && !isLocalGalleryMode) ...[
              const SizedBox(height: 16),
              _buildLogoutCard(context),
            ],
            _buildBiyenFooter(context, colors),
          ],
        );
      },
    );
  }

  Widget _buildMinimalistProfileHeader(
    BuildContext context,
    String email,
    ColorTokens colors,
  ) {
    final initial = email.isNotEmpty ? email[0].toUpperCase() : "B";
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => _showVerifyIdentityDialog(context),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0xFFC8502E),
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(0xFFD98226).withValues(alpha: 0.35),
                  width: 1.5,
                ),
              ),
              child: Center(
                child: Text(
                  initial,
                  style: const TextStyle(
                    fontFamily: "Outfit",
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    email,
                    style: TextStyle(
                      fontFamily: "Outfit",
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: colors.textBase,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    "Penyimpanan Privat & Terenkripsi",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: colors.textLight,
                      letterSpacing: 0.1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, ColorTokens colors) {
    return Padding(
      padding: const EdgeInsets.only(left: 6, top: 14, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontFamily: "Outfit",
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
          color: colors.textLight,
        ),
      ),
    );
  }

  Widget _buildBiyenFooter(BuildContext context, ColorTokens colors) {
    return Padding(
      padding: const EdgeInsets.only(top: 28, bottom: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "Biyen Photos",
            style: TextStyle(
              fontFamily: "Outfit",
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: colors.textLight,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            "oleh Levitation",
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: colors.textLighter,
            ),
          ),
          const SizedBox(height: 8),
          AppVersionWidget(onTap: () => showChangeLogSheet(context)),
        ],
      ),
    );
  }

  List<Widget> _buildHeaderActions(BuildContext context) {
    return [
      IconButtonComponent(
        variant: IconButtonComponentVariant.primary,
        shouldSurfaceExecutionStates: false,
        icon: const HugeIcon(icon: HugeIcons.strokeRoundedSearch01),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => SettingsSearchPage(
                items: SettingsSearchRegistry.getSearchableItems(context),
                suggestions: SettingsSearchRegistry.getSuggestions(context),
                onNavigate: (context, routeBuilder) {
                  Navigator.of(context).pop();
                  routeToPage(context, routeBuilder(context));
                },
              ),
            ),
          );
        },
      ),
    ];
  }

  SettingsItem _buildMenuItem({
    required String title,
    required List<List<dynamic>> icon,
    String? subtitle,
    Widget? trailing,
    Future<void> Function()? onTap,
    bool showOnlyLoadingState = false,
    bool isDestructive = false,
  }) {
    return SettingsItem(
      title: title,
      subtitle: subtitle,
      icon: icon,
      trailing: trailing,
      showOnlyLoadingState: showOnlyLoadingState,
      isDestructive: isDestructive,
      onTap: onTap,
    );
  }

  SettingsItem _buildLegacyMenuItem(BuildContext context) {
    return _buildMenuItem(
      title: context.strings.legacy,
      icon: HugeIcons.strokeRoundedFavourite,
      showOnlyLoadingState: true,
      onTap: () async {
        final hasAuthenticated =
            kDebugMode ||
            await LocalAuthenticationService.instance
                .requestLocalAuthentication(
                  context,
                  context.strings.authToManageLegacy,
                );
        if (hasAuthenticated) {
          if (!context.mounted) return;
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (BuildContext context) {
                return const EmergencyPage();
              },
            ),
          );
        }
      },
    );
  }

  SettingsItem _buildFamilyMenuItem(BuildContext context) {
    return _buildMenuItem(
      title: context.strings.family,
      icon: HugeIcons.strokeRoundedUserMultiple,
      showOnlyLoadingState: true,
      onTap: () async {
        late final UserDetails userDetails;
        try {
          userDetails = await UserService.instance.getUserDetailsV2(
            memoryCount: false,
          );
        } catch (error) {
          if (!context.mounted) return;
          await showGenericErrorDialog(context: context, error: error);
          return;
        }
        if (!context.mounted) return;
        await billingService.launchFamilyPortal(
          context,
          userDetails,
          refreshOnOpen: false,
        );
      },
    );
  }

  SettingsItem _buildReferralsMenuItem(BuildContext context) {
    return _buildMenuItem(
      title: context.strings.referrals,
      icon: HugeIcons.strokeRoundedTicketStar,
      showOnlyLoadingState: true,
      onTap: () async {
        await openReferralScreen(context);
      },
    );
  }

  Widget _buildOfflineLoginCard(BuildContext context, ColorTokens colors) {
    return _buildMenuItem(
      title: context.strings.alreadyHaveAnAccount,
      icon: HugeIcons.strokeRoundedLogin01,
      subtitle: context.strings.loginToEnte,
      trailing: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: const Color(0xFFC8502E),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          Icons.arrow_forward_rounded,
          color: colors.specialWhite,
          size: 18,
        ),
      ),
      onTap: () async {
        await routeToPage(context, const LoginPage());
      },
    );
  }

  SettingsItem _buildMapsMenuItem(BuildContext context) {
    return _buildMenuItem(
      title: context.strings.maps,
      icon: HugeIcons.strokeRoundedMaping,
      trailing: ToggleSwitchComponent.async(
        value: () => mapEnabled,
        onChanged: () async {
          final isEnabled = mapEnabled;
          try {
            await setMapEnabled(!isEnabled);
          } catch (e) {
            if (context.mounted) {
              showShortToast(context, context.strings.somethingWentWrong);
            }
            rethrow;
          }
        },
      ),
    );
  }

  Widget _buildLogoutCard(BuildContext context) {
    return _buildMenuItem(
      title: context.strings.logout,
      icon: HugeIcons.strokeRoundedLogout05,
      isDestructive: true,
      onTap: () async {
        _onLogoutTapped(context);
      },
    );
  }

  void _onLogoutTapped(BuildContext context) {
    showChoiceActionSheet(
      context,
      title: context.strings.warning,
      body: context.strings.areYouSureYouWantToLogout,
      illustration: Image.asset("assets/warning-grey.png"),
      firstButtonLabel: context.strings.yes,
      isCritical: true,
      firstButtonOnTap: () async {
        await UserService.instance.logout(context);
      },
    );
  }

  Future<void> _showVerifyIdentityDialog(BuildContext context) async {
    await showVerifyIdentitySheet(
      context,
      self: true,
      title: context.strings.verifyIDLabel,
    );
  }
}
