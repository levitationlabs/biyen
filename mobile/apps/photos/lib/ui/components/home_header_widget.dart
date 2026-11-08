import 'package:flutter/material.dart';
import "package:hugeicons/hugeicons.dart";
import "package:photos/core/event_bus.dart";
import "package:photos/events/tab_changed_event.dart";
import "package:photos/models/home_tab.dart";
import "package:photos/service_locator.dart";
import "package:photos/ui/common/backup_flow_helper.dart";
import 'package:photos/ui/components/buttons/icon_button_widget.dart';
import "package:photos/ui/settings/ml/ml_consent_sheet.dart";

class HomeHeaderWidget extends StatefulWidget {
  final Widget centerWidget;
  const HomeHeaderWidget({required this.centerWidget, super.key});

  @override
  State<HomeHeaderWidget> createState() => _HomeHeaderWidgetState();
}

class _HomeHeaderWidgetState extends State<HomeHeaderWidget> {
  @override
  Widget build(BuildContext context) {
    final showAddAlbumAction =
        !isLocalGalleryMode || permissionService.hasGrantedLimitedPermissions();
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButtonWidget(
              iconButtonType: IconButtonType.primary,
              iconWidget: const HugeIcon(icon: HugeIcons.strokeRoundedMenu01),
              onTap: () {
                Scaffold.of(context).openDrawer();
              },
            ),
            const SizedBox(width: 8),
            Text(
              "biyen",
              style: TextStyle(
                fontFamily: 'Outfit',
                fontWeight: FontWeight.w900,
                fontSize: 26,
                letterSpacing: -1.0,
                color: Theme.of(context).brightness == Brightness.light
                    ? const Color(0xFF1A1513)
                    : Colors.white,
              ),
            ),
          ],
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: widget.centerWidget,
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButtonWidget(
              iconWidget: const HugeIcon(
                icon: HugeIcons.strokeRoundedAiBrain01,
              ),
              iconButtonType: IconButtonType.primary,
              onTap: () async {
                if (await showMLConsentSheet(context)) {
                  Bus.instance.fire(
                    TabChangedEvent(
                      searchTabIndex,
                      TabChangedEventSource.mlConsent,
                    ),
                  );
                }
              },
            ),
            if (showAddAlbumAction)
              IconButtonWidget(
                iconWidget: const HugeIcon(
                  icon: HugeIcons.strokeRoundedUpload01,
                ),
                iconButtonType: IconButtonType.primary,
                onTap: () async => handleFullPermissionBackupFlow(context),
              ),
          ],
        ),
      ],
    );
  }
}
