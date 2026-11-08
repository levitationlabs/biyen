import 'dart:async';

import 'package:ente_components/theme/theme.dart';
import 'package:flutter/material.dart';
import "package:hugeicons/hugeicons.dart";
import 'package:photos/core/event_bus.dart';
import 'package:photos/events/tab_changed_event.dart';
import 'package:photos/models/home_tab.dart';
import "package:photos/models/selected_albums.dart";
import 'package:photos/models/selected_files.dart';
import 'package:photos/theme/ente_theme.dart';

const double homeBottomNavigationBarHeight = 70;

class HomeBottomNavigationBar extends StatefulWidget {
  const HomeBottomNavigationBar(
    this.selectedFiles,
    this.selectedAlbums, {
    required this.selectedTabIndex,
    required this.showFeed,
    super.key,
  });

  final SelectedFiles selectedFiles;
  final SelectedAlbums selectedAlbums;
  final int selectedTabIndex;
  final bool showFeed;

  @override
  State<HomeBottomNavigationBar> createState() =>
      _HomeBottomNavigationBarState();
}

class _HomeBottomNavigationBarState extends State<HomeBottomNavigationBar> {
  static const Duration _doubleTapWindow = Duration(milliseconds: 350);
  late StreamSubscription<TabChangedEvent> _tabChangedEventSubscription;
  int currentTabIndex = 0;
  int? _lastTapIndex;
  DateTime? _lastTapAt;

  @override
  void initState() {
    super.initState();
    currentTabIndex = widget.selectedTabIndex;
    widget.selectedFiles.addListener(_selectedFilesListener);
    widget.selectedAlbums.addListener(_selectedAlbumsListener);
    _tabChangedEventSubscription = Bus.instance.on<TabChangedEvent>().listen((
      event,
    ) {
      if (event.source != TabChangedEventSource.tabBar) {
        debugPrint(
          '${(TabChangedEvent).toString()} index changed  from '
          '$currentTabIndex to ${event.selectedIndex} via ${event.source}',
        );
        if (mounted) {
          setState(() {
            currentTabIndex = event.selectedIndex;
          });
        }
      } else if (event.source == TabChangedEventSource.tabBar &&
          currentTabIndex == event.selectedIndex) {
        Bus.instance.fire(TabDoubleTapEvent(currentTabIndex));
      }
    });
  }

  @override
  void dispose() {
    _tabChangedEventSubscription.cancel();
    widget.selectedFiles.removeListener(_selectedFilesListener);
    widget.selectedAlbums.removeListener(_selectedAlbumsListener);
    super.dispose();
  }

  void _selectedFilesListener() {
    if (mounted) {
      setState(() {});
    }
  }

  void _selectedAlbumsListener() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onTabChange(int index, {String mode = 'tabChanged'}) {
    if (mode == "OnPressed") {
      _handleSearchTabDoubleTap(index);
    }
    debugPrint("_TabChanged called via method $mode");
    Bus.instance.fire(TabChangedEvent(index, TabChangedEventSource.tabBar));
  }

  void _handleSearchTabDoubleTap(int index) {
    final now = DateTime.now();
    final isRepeatTap =
        _lastTapIndex == index &&
        _lastTapAt != null &&
        now.difference(_lastTapAt!) <= _doubleTapWindow;
    _lastTapIndex = index;
    _lastTapAt = now;
    if (index != searchTabIndex || !isRepeatTap) {
      return;
    }
    if (currentTabIndex != searchTabIndex) {
      Bus.instance.fire(TabDoubleTapEvent(index));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool filesAreSelected = widget.selectedFiles.files.isNotEmpty;
    final bool albumsAreSelected = widget.selectedAlbums.albums.isNotEmpty;

    return SafeArea(
      top: false,
      child: RepaintBoundary(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          height: filesAreSelected || albumsAreSelected
              ? 0
              : homeBottomNavigationBarHeight,
          child: IgnorePointer(
            ignoring: filesAreSelected || albumsAreSelected,
            child: _HomeNavBar(
              selectedIndex: currentTabIndex,
              showFeed: widget.showFeed,
              onTabChange: (index) {
                _onTabChange(index, mode: "OnPressed");
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeNavBar extends StatelessWidget {
  const _HomeNavBar({
    required this.selectedIndex,
    required this.showFeed,
    required this.onTabChange,
  });

  static const _tabs = [
    _HomeNavTab(
      semanticLabel: 'Galeri',
      semanticIdentifier: 'biyen.photos.tab.home',
      icon: HugeIcons.strokeRoundedImage01,
    ),
    _HomeNavTab(
      semanticLabel: 'Album',
      semanticIdentifier: 'biyen.photos.tab.albums',
      icon: HugeIcons.strokeRoundedAlbum02,
    ),
    _HomeNavTab(
      semanticLabel: 'Feed',
      semanticIdentifier: 'biyen.photos.tab.feed',
      icon: HugeIcons.strokeRoundedUserGroup,
    ),
    _HomeNavTab(
      semanticLabel: 'Cari',
      semanticIdentifier: 'biyen.photos.tab.search',
      icon: HugeIcons.strokeRoundedSearch01,
    ),
  ];

  final int selectedIndex;
  final bool showFeed;
  final ValueChanged<int> onTabChange;

  @override
  Widget build(BuildContext context) {
    final colors = context.componentColors;
    final colorScheme = getEnteColorScheme(context);
    final tabIndices = homeTabIndices(showFeed: showFeed);

    return Container(
      width: double.infinity,
      height: homeBottomNavigationBarHeight,
      decoration: BoxDecoration(
        color: colorScheme.backgroundElevated,
        border: Border(
          top: BorderSide(
            color: colorScheme.strokeFaint,
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(tabIndices.length, (index) {
          final tabIndex = tabIndices[index];
          final tab = _tabs[tabIndex];
          final isSelected = selectedIndex == tabIndex;
          final activeColor = colorScheme.textBase;
          final inactiveColor = colorScheme.textFaint;

          return Expanded(
            child: Semantics(
              label: tab.semanticLabel,
              identifier: tab.semanticIdentifier,
              button: true,
              selected: isSelected,
              child: InkWell(
                onTap: () => onTabChange(tabIndex),
                splashColor: Colors.transparent,
                highlightColor: Colors.transparent,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    HugeIcon(
                      icon: tab.icon,
                      color: isSelected ? activeColor : inactiveColor,
                      size: 22,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      tab.semanticLabel,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 10.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? activeColor : inactiveColor,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _HomeNavTab {
  const _HomeNavTab({
    required this.semanticLabel,
    required this.semanticIdentifier,
    required this.icon,
  });

  final String semanticLabel;
  final String semanticIdentifier;
  final List<List<dynamic>> icon;
}
