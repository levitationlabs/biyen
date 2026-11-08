import 'package:ente_components/theme/text_styles.dart';
import 'package:ente_pure_utils/ente_pure_utils.dart';
import "package:ente_strings/ente_strings.dart";
import "package:ente_ui/components/loading_widget.dart";
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:logging/logging.dart';
import 'package:photos/core/constants.dart';
import "package:photos/core/errors.dart";
import 'package:photos/models/user_details.dart';
import 'package:photos/service_locator.dart';
import 'package:photos/states/user_details_state.dart';
import 'package:photos/theme/colors.dart';
import 'package:photos/ui/payment/subscription.dart';
import 'package:photos/ui/settings/storage_progress_widget.dart';

class StorageCardWidget extends StatefulWidget {
  const StorageCardWidget({super.key});

  @override
  State<StorageCardWidget> createState() => _StorageCardWidgetState();
}

class _DotsPainter extends CustomPainter {
  static const double _dotRadius = 1.45;
  static const double _horizontalSpacing = 15.65;
  static const double _verticalSpacing = 15.65;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.024)
      ..style = PaintingStyle.fill;

    final horizontalCount = (size.width / _horizontalSpacing).ceil() + 1;
    final verticalCount = (size.height / _verticalSpacing).ceil() + 1;

    for (int row = 0; row < verticalCount; row++) {
      for (int col = 0; col < horizontalCount; col++) {
        final x = col * _horizontalSpacing + (_horizontalSpacing / 2);
        final y = row * _verticalSpacing + (_verticalSpacing / 2);

        if (x <= size.width + _dotRadius && y <= size.height + _dotRadius) {
          canvas.drawCircle(Offset(x, y), _dotRadius, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _StorageCardWidgetState extends State<StorageCardWidget> {
  final _logger = Logger((_StorageCardWidgetState).toString());
  int? familyMemberStorageLimit;
  bool showFamilyBreakup = false;

  @override
  Widget build(BuildContext context) {
    final inheritedUserDetails = InheritedUserDetails.of(context);
    if (inheritedUserDetails == null) {
      final msg = (InheritedUserDetails).toString() + 'is null';
      _logger.severe(msg);
      throw InvalidStateError(msg);
    }
    final userDetails = inheritedUserDetails.userDetails;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () async {
        final isFamilyMember =
            (userDetails?.isPartOfFamily() ?? false) &&
            !((userDetails?.currentFamilyMember()?.isAdmin) ?? false);
        if (isFamilyMember) {
          await billingService.launchFamilyPortal(
            context,
            userDetails!,
            refreshOnOpen: false,
          );
          return;
        }
        // ignore: unawaited_futures
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (BuildContext context) {
              return getSubscriptionPage();
            },
          ),
        );
      },
      child: containerForUserDetails(userDetails),
    );
  }

  Widget containerForUserDetails(UserDetails? userDetails) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: userDetails != null
          ? _userDetails(userDetails)
          : const SizedBox(
              height: 48,
              child: Center(
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Color(0xFFC8502E)),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _userDetails(UserDetails userDetails) {
    const hundredMBinBytes = 107374182;
    const oneTBinBytes = 1073741824000;
    showFamilyBreakup = userDetails.isPartOfFamily();
    if (showFamilyBreakup) {
      familyMemberStorageLimit = userDetails.familyMemberStorageLimit();
      showFamilyBreakup = familyMemberStorageLimit == null;
    }

    final usedStorageInBytes = familyMemberStorageLimit != null
        ? userDetails.usage
        : userDetails.getFamilyOrPersonalUsage();
    final totalStorageInBytes = familyMemberStorageLimit != null
        ? familyMemberStorageLimit!
        : userDetails.getTotalStorage();
    final freeStorageInBytes = totalStorageInBytes - usedStorageInBytes;

    final shouldShowUsedStorageInTBs = usedStorageInBytes >= oneTBinBytes;
    final shouldShowTotalStorageInTBs = totalStorageInBytes >= oneTBinBytes;
    final shouldShowUsedStorageInMBs = usedStorageInBytes < hundredMBinBytes;

    final usedStorageInGB = roundBytesUsedToGBs(
      usedStorageInBytes,
      freeStorageInBytes,
    );
    final totalStorageInGB = convertBytesToGBs(totalStorageInBytes).truncate();

    final usedStorageInTB = roundGBsToTBs(usedStorageInGB);
    final totalStorageInTB = roundGBsToTBs(totalStorageInGB);

    late num currentUsage, totalStorage;
    late String currentUsageUnit, totalStorageUnit;

    if (shouldShowUsedStorageInTBs) {
      currentUsage = usedStorageInTB;
      currentUsageUnit = "TB";
    } else if (shouldShowUsedStorageInMBs) {
      currentUsage = convertBytesToMBs(usedStorageInBytes);
      currentUsageUnit = "MB";
    } else {
      currentUsage = usedStorageInGB;
      currentUsageUnit = "GB";
    }

    if (shouldShowTotalStorageInTBs) {
      totalStorage = totalStorageInTB;
      totalStorageUnit = "TB";
    } else {
      totalStorage = totalStorageInGB;
      totalStorageUnit = "GB";
    }

    final fraction = totalStorageInBytes > 0
        ? (usedStorageInBytes / totalStorageInBytes).clamp(0.0, 1.0)
        : 0.0;

    final isId = Localizations.localeOf(context).languageCode == 'id';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isFree = userDetails.subscription.isFreePlan();
    final String planName;
    if (isFree) {
      planName = isId ? "Paket Gratis" : "Free Plan";
    } else {
      if (totalStorageInGB >= 1024) {
        final tb = (totalStorageInGB / 1024).toStringAsFixed(0);
        planName = isId ? "Paket $tb TB" : "$tb TB Plan";
      } else {
        planName = isId ? "Paket $totalStorageInGB GB" : "$totalStorageInGB GB Plan";
      }
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.strings.storage,
                  style: TextStyle(
                    fontFamily: "Outfit",
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : const Color(0xFF2C2523),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: isFree
                        ? (isDark ? const Color(0xFF262626) : const Color(0xFFF3EEEA))
                        : (isDark ? const Color(0xFF4A2518) : const Color(0xFFFDE8E1)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    planName,
                    style: TextStyle(
                      fontFamily: "Outfit",
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: isFree
                          ? (isDark ? const Color(0xFFAAAAAA) : const Color(0xFF756860))
                          : const Color(0xFFC8502E),
                    ),
                  ),
                ),
              ],
            ),
            Text(
              "$currentUsage $currentUsageUnit / $totalStorage $totalStorageUnit",
              style: TextStyle(
                fontFamily: "Outfit",
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? const Color(0xFFAAAAAA) : const Color(0xFF756860),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: SizedBox(
            height: 4.5,
            width: double.infinity,
            child: Stack(
              children: [
                Container(
                  color: isDark ? const Color(0xFF262626) : const Color(0xFFE8E4DF),
                ),
                FractionallySizedBox(
                  widthFactor: fraction > 0 ? (fraction < 0.02 ? 0.02 : fraction) : 0.0,
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFC8502E),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              context.strings.memoryCount(
                count: userDetails.fileCount,
                formattedCount: NumberFormat().format(userDetails.fileCount),
              ),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isDark ? const Color(0xFF888888) : const Color(0xFF8C7D73),
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isId ? "Kelola" : "Manage",
                  style: const TextStyle(
                    fontFamily: "Outfit",
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFC8502E),
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 9,
                  color: Color(0xFFC8502E),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  List<TextSpan> _usedStorageDetails({
    required bool isMobileScreenSmall,
    required bool shouldShowUsedStorageInTBs,
    required bool shouldShowTotalStorageInTBs,
    required bool shouldShowUsedStorageInMBs,
    required int usedStorageInBytes,
    required num usedStorageInGB,
    required int totalStorageInGB,
    required num usedStorageInTB,
    required num totalStorageInTB,
  }) {
    if (isMobileScreenSmall) {
      return [TextSpan(text: '$usedStorageInGB/$totalStorageInGB GB')];
    }
    late num currentUsage, totalStorage;
    late String currentUsageUnit, totalStorageUnit;

    if (shouldShowUsedStorageInTBs) {
      currentUsage = usedStorageInTB;
      currentUsageUnit = "TB";
    } else if (shouldShowUsedStorageInMBs) {
      currentUsage = convertBytesToMBs(usedStorageInBytes);
      currentUsageUnit = "MB";
    } else {
      currentUsage = usedStorageInGB;
      currentUsageUnit = "GB";
    }

    if (shouldShowTotalStorageInTBs) {
      totalStorage = totalStorageInTB;
      totalStorageUnit = "TB";
    } else {
      totalStorage = totalStorageInGB;
      totalStorageUnit = "GB";
    }

    return [
      TextSpan(text: '$currentUsage $currentUsageUnit  '),
      const TextSpan(
        text: 'of',
        style: TextStyle(color: textMutedDark),
      ),
      TextSpan(text: '  $totalStorage $totalStorageUnit used'),
    ];
  }
}
