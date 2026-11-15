import 'dart:convert';
import 'dart:typed_data';

import 'package:ente_components/ente_components.dart';
import 'package:flutter/material.dart';
import 'package:photos/core/configuration.dart';
import 'package:photos/services/account/biyen_escrow_service.dart';
import 'package:photos/ui/notification/toast.dart';

class BiyenProtectionModeCard extends StatefulWidget {
  final String recoveryKeyHex;
  final BiyenEscrowService? escrowService;

  const BiyenProtectionModeCard({
    required this.recoveryKeyHex,
    this.escrowService,
    super.key,
  });

  @override
  State<BiyenProtectionModeCard> createState() =>
      _BiyenProtectionModeCardState();
}

class _BiyenProtectionModeCardState extends State<BiyenProtectionModeCard> {
  static const double _cardBorderWidth = 1.0;

  BiyenProtectionMode _mode = BiyenProtectionMode.managed;

  BiyenEscrowService get _service =>
      widget.escrowService ?? BiyenEscrowService.instance;

  @override
  void initState() {
    super.initState();
    _loadCurrentStatus();
  }

  Future<void> _loadCurrentStatus() async {
    try {
      final status = await _service.getStatus();
      if (mounted) setState(() => _mode = status.mode);
    } catch (_) {
      // Keep default managed mode when offline or before initial deposit.
    }
  }

  Future<void> _openModeSelector() async {
    final result = await Navigator.of(context).push<BiyenProtectionMode>(
      MaterialPageRoute(
        builder: (_) => BiyenProtectionModePage(
          initialMode: _mode,
          recoveryKeyHex: widget.recoveryKeyHex,
          escrowService: _service,
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() => _mode = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.componentColors;
    final isManaged = _mode == BiyenProtectionMode.managed;
    final modeTitle = isManaged
        ? 'Mode Terkelola (Managed Escrow — Post-Quantum)'
        : 'Mode Zero-Knowledge Murni';
    final modeDescription = isManaged
        ? 'Direkomendasikan: Kunci pemulihan dienkripsi X-Wing ke Admin Custody untuk pemulihan darurat via Support Biyen.'
        : 'Tidak ada salinan di escrow. Kehilangan kata sandi & 24 kata kunci berarti akun tidak dapat dipulihkan.';

    return Container(
      decoration: BoxDecoration(
        color: colors.backgroundBase,
        borderRadius: BorderRadius.circular(Radii.button),
        border: Border.all(color: colors.strokeFaint, width: _cardBorderWidth),
      ),
      padding: const EdgeInsets.all(Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Mode Perlindungan Kunci Pemulihan',
            style: TextStyles.bodyBold.copyWith(color: colors.textLight),
          ),
          const SizedBox(height: Spacing.xs),
          Text(
            modeTitle,
            style: TextStyles.bodyBold.copyWith(color: colors.textBase),
          ),
          const SizedBox(height: Spacing.xs),
          Text(
            modeDescription,
            style: TextStyles.body.copyWith(color: colors.textLight),
          ),
          const SizedBox(height: Spacing.md),
          ButtonComponent(
            key: const ValueKey('openProtectionModePageButton'),
            label: 'Ubah Mode Perlindungan',
            variant: ButtonComponentVariant.secondary,
            size: ButtonComponentSize.small,
            shouldSurfaceExecutionStates: false,
            onTap: _openModeSelector,
          ),
        ],
      ),
    );
  }
}

class BiyenProtectionModePage extends StatefulWidget {
  final BiyenProtectionMode initialMode;
  final String? recoveryKeyHex;
  final BiyenEscrowService? escrowService;

  const BiyenProtectionModePage({
    this.initialMode = BiyenProtectionMode.managed,
    this.recoveryKeyHex,
    this.escrowService,
    super.key,
  });

  @override
  State<BiyenProtectionModePage> createState() =>
      _BiyenProtectionModePageState();
}

class _BiyenProtectionModePageState extends State<BiyenProtectionModePage> {
  static const double _selectedBorderWidth = 2.0;
  static const double _unselectedBorderWidth = 1.0;

  late BiyenProtectionMode _selectedMode;

  BiyenEscrowService get _service =>
      widget.escrowService ?? BiyenEscrowService.instance;

  @override
  void initState() {
    super.initState();
    _selectedMode = widget.initialMode;
  }

  Future<void> _applySelection() async {
    try {
      if (_selectedMode == BiyenProtectionMode.managed) {
        final pubKey = await _service.fetchPublicKey();
        final cfg = Configuration.instance;
        final userId = cfg.hasConfiguredAccount()
            ? (cfg.getUserID()?.toString() ?? '0')
            : '0';
        final keyBytes = Uint8List.fromList(
          utf8.encode(widget.recoveryKeyHex ?? ''),
        );
        final commitment = BiyenEscrowService.computeCommitment(
          userId,
          keyBytes,
        );
        await _service.depositRecoveryKey(
          pubKey.kekVersion,
          keyBytes,
          commitment,
        );
      } else {
        await _service.scheduleZeroKnowledgeSwitch();
      }
      if (!mounted) return;
      showShortToast(context, 'Mode perlindungan berhasil diperbarui.');
    } catch (_) {
      // Allow offline selection during onboarding while preserving choice.
    }
    if (!mounted) return;
    Navigator.of(context).pop(_selectedMode);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.componentColors;
    return Scaffold(
      backgroundColor: colors.backgroundBase,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: colors.backgroundBase,
        title: Text(
          'Pilih Mode Perlindungan',
          style: TextStyles.large.copyWith(color: colors.textBase),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildOptionTile(BiyenProtectionMode.managed),
              const SizedBox(height: Spacing.md),
              _buildOptionTile(BiyenProtectionMode.zeroKnowledge),
              const Spacer(),
              ButtonComponent(
                key: const ValueKey('saveProtectionModeButton'),
                label: 'Simpan Mode Perlindungan',
                onTap: _applySelection,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOptionTile(BiyenProtectionMode option) {
    final colors = context.componentColors;
    final isSelected = _selectedMode == option;
    final isManaged = option == BiyenProtectionMode.managed;
    final title = isManaged
        ? 'Mode Terkelola (Managed Escrow — Post-Quantum)'
        : 'Mode Zero-Knowledge Murni';
    final description = isManaged
        ? 'Direkomendasikan. Kunci pemulihan dienkripsi hybrid X-Wing (MLKEM768-X25519) ke Admin Custody. Dapat dipulihkan melalui Support Biyen jika Anda lupa kata sandi & kehilangan 24 kata.'
        : 'Tidak ada data pemulihan dikirim ke escrow. Jika Anda lupa kata sandi sekaligus kehilangan 24 kata kunci, akun tidak dapat dipulihkan oleh siapa pun.';

    return InkWell(
      key: ValueKey(
        isManaged ? 'modeManagedOption' : 'modeZeroKnowledgeOption',
      ),
      borderRadius: BorderRadius.circular(Radii.button),
      onTap: () => setState(() => _selectedMode = option),
      child: Container(
        padding: const EdgeInsets.all(Spacing.lg),
        decoration: BoxDecoration(
          color: colors.backgroundBase,
          borderRadius: BorderRadius.circular(Radii.button),
          border: Border.all(
            color: isSelected ? colors.primary : colors.strokeFaint,
            width: isSelected ? _selectedBorderWidth : _unselectedBorderWidth,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isManaged)
              Padding(
                padding: const EdgeInsets.only(bottom: Spacing.xs),
                child: Text(
                  'Direkomendasikan',
                  style: TextStyles.bodyBold.copyWith(color: colors.primary),
                ),
              ),
            Text(
              title,
              style: TextStyles.bodyBold.copyWith(color: colors.textBase),
            ),
            const SizedBox(height: Spacing.xs),
            Text(
              description,
              style: TextStyles.body.copyWith(color: colors.textLight),
            ),
          ],
        ),
      ),
    );
  }
}
