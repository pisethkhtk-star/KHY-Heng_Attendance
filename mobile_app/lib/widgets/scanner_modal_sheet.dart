import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../core/constants/app_colors.dart';
import '../providers/language_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';
import '../core/services/api_service.dart';

class ScannerModalSheet extends StatefulWidget {
  final int initialTab; // 0: QR, 1: Face, 2: My Badge

  const ScannerModalSheet({super.key, this.initialTab = 0});

  @override
  State<ScannerModalSheet> createState() => _ScannerModalSheetState();
}

class _ScannerModalSheetState extends State<ScannerModalSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isProcessing = false;
  String? _statusMessage;
  bool _isSuccess = false;
  final TextEditingController _manualQrController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this, initialIndex: widget.initialTab);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _manualQrController.dispose();
    super.dispose();
  }

  void _handleSimulatedScan(String type) async {
    if (_isProcessing) return;

    setState(() {
      _isProcessing = true;
      _statusMessage = 'Verifying $type data...';
      _isSuccess = false;
    });

    await Future.delayed(const Duration(milliseconds: 1500));

    if (type == 'QR Code') {
      await ApiService.scanQRCode('EMP-QR-2026-HQ');
    } else {
      await ApiService.checkInFace('sample_base64_data');
    }

    if (mounted) {
      final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
      if (!attendanceProvider.isCheckedIn) {
        await attendanceProvider.toggleCheckInCheckOut();
      }

      setState(() {
        _isProcessing = false;
        _isSuccess = true;
        _statusMessage = '$type Verified! Attendance Logged.';
      });

      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) Navigator.pop(context);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final langProvider = Provider.of<LanguageProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: BoxDecoration(
        color: isDark ? AppColors.bgDark : AppColors.bgLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  langProvider.tr('scanner_title'),
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.x),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Tab Bar
          TabBar(
            controller: _tabController,
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: Colors.grey,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: [
              Tab(icon: const Icon(LucideIcons.qrCode, size: 20), text: langProvider.tr('scan_qr_tab')),
              Tab(icon: const Icon(LucideIcons.userCheck, size: 20), text: langProvider.tr('scan_face_tab')),
              Tab(icon: const Icon(LucideIcons.badgeCheck, size: 20), text: langProvider.tr('my_qr_tab')),
            ],
          ),
          const SizedBox(height: 16),

          // Tab View
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildQrScannerTab(langProvider, isDark),
                _buildFaceScannerTab(langProvider, isDark),
                _buildMyBadgeTab(langProvider, isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- 1. QR Scanner View ---
  Widget _buildQrScannerTab(LanguageProvider langProvider, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Text(
            langProvider.tr('align_qr'),
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 24),

          // Scanner Box Viewfinder
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: _isSuccess ? AppColors.success : AppColors.primary, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: (_isSuccess ? AppColors.success : AppColors.primary).withOpacity(0.3),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(LucideIcons.camera, color: Colors.white38, size: 64),
                ),
              ),

              // Animated Laser Beam
              if (!_isSuccess)
                Container(
                  width: 210,
                  height: 3,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primaryLight.withOpacity(0.8),
                        blurRadius: 8,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ).animate(onPlay: (c) => c.repeat(reverse: true)).slideY(begin: -30, end: 30, duration: 1500.ms),

              if (_isSuccess)
                Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.checkCircle2, color: Colors.white, size: 72),
                      SizedBox(height: 12),
                      Text(
                        'Verified!',
                        style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),

          if (_statusMessage != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _statusMessage!,
                style: TextStyle(
                  color: _isSuccess ? AppColors.success : AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),

          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            onPressed: () => _handleSimulatedScan('QR Code'),
            icon: const Icon(LucideIcons.scanLine, size: 20),
            label: const Text('Simulate QR Scan (Tap to Check-in)', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // --- 2. Face Scanner View ---
  Widget _buildFaceScannerTab(LanguageProvider langProvider, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Text(
            langProvider.tr('align_face'),
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 20),

          // Face Oval Target Viewfinder
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 220,
                height: 270,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(110),
                  border: Border.all(color: _isSuccess ? AppColors.success : AppColors.accent, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: (_isSuccess ? AppColors.success : AppColors.accent).withOpacity(0.3),
                      blurRadius: 20,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(LucideIcons.smile, color: Colors.white38, size: 80),
                ),
              ),

              if (_isSuccess)
                Container(
                  width: 220,
                  height: 270,
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(110),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.userCheck, color: Colors.white, size: 72),
                      SizedBox(height: 12),
                      Text(
                        'Face Matched!',
                        style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            onPressed: () => _handleSimulatedScan('Face'),
            icon: const Icon(LucideIcons.scanFace, size: 20),
            label: const Text('Capture Face & Check-In', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // --- 3. My Badge View ---
  Widget _buildMyBadgeTab(LanguageProvider langProvider, bool isDark) {
    final user = Provider.of<AuthProvider>(context).user;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: SingleChildScrollView(
        child: Column(
          children: [
            Text(
              langProvider.tr('my_qr_desc'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 20),

            // Employee Digital Badge Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'STAFF PASS',
                        style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, letterSpacing: 2),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('ACTIVE', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Simulated High-res QR Code Matrix Box
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        const Icon(LucideIcons.qrCode, size: 140, color: Colors.black),
                        const SizedBox(height: 8),
                        Text(
                          user?.employeeId ?? 'EMP-2026',
                          style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  Text(
                    user?.name ?? 'Chomnan Heng',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    user?.position ?? 'Senior Developer',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
