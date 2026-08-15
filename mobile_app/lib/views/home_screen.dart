import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../core/constants/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/live_clock_widget.dart';
import '../widgets/custom_card.dart';
import '../widgets/stat_ring_chart.dart';
import '../widgets/apply_leave_sheet.dart';
import '../widgets/scanner_modal_sheet.dart';
import 'overtime_screen.dart';

class HomeScreen extends StatelessWidget {
  final Function(int) onTabSelected;

  const HomeScreen({super.key, required this.onTabSelected});

  ImageProvider? _getAvatarImage(String? avatarUrl) {
    if (avatarUrl == null || avatarUrl.trim().isEmpty) return null;
    try {
      if (avatarUrl.startsWith('data:image') && avatarUrl.contains('base64,')) {
        final base64String = avatarUrl.split('base64,')[1].trim();
        final bytes = base64Decode(base64String);
        return MemoryImage(bytes);
      }
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('https')) {
        return NetworkImage(avatarUrl);
      }
      final bytes = base64Decode(avatarUrl.trim());
      return MemoryImage(bytes);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authController = Get.find<AuthController>();
    final attendanceController = Get.find<AttendanceController>();
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: () async {
        await attendanceController.fetchRemoteHistory(staffId: authController.user?.employeeId);
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // User Greeting Header
          Obx(() {
            final user = authController.user;
            final avatarImage = _getAvatarImage(user?.avatarUrl);
            return Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.primaryLight,
                  backgroundImage: avatarImage,
                  child: avatarImage == null
                      ? Text(
                          user?.name.substring(0, 1).toUpperCase() ?? 'U',
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${langController.tr('welcome_back')}, 👋',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                      ),
                      Text(
                        user?.name ?? 'Chomnan Heng',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${user?.position ?? 'Senior Developer'} • ${user?.department ?? 'Engineering'}',
                        style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(LucideIcons.bell, size: 22),
                ),
              ],
            );
          }).animate().fadeIn().slideY(begin: -0.2, end: 0),
          const SizedBox(height: 20),

          // Live Digital Clock Widget
          const LiveClockWidget().animate().fadeIn(delay: 100.ms),
          const SizedBox(height: 20),

          // Check In 1 / Out 1 & In 2 / Out 2 Main Action Card (All in 1 Box)
          CustomCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(LucideIcons.mapPin, color: AppColors.primary, size: 20),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Obx(
                              () => Text(
                                langController.tr('location_office'),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.successBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.shieldCheck, color: AppColors.success, size: 14),
                          SizedBox(width: 4),
                          Text('GPS Verified', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Animated Circular Punch Button
                Obx(
                  () => GestureDetector(
                    onTap: attendanceController.isProcessing
                      ? null
                      : () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                            ),
                            builder: (_) => const ScannerModalSheet(),
                          );
                        },
                    child: Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: attendanceController.currentStep % 2 == 1
                            ? const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFDC2626)])
                            : AppColors.primaryGradient,
                        boxShadow: [
                          BoxShadow(
                            color: (attendanceController.currentStep % 2 == 1
                                    ? AppColors.danger
                                    : AppColors.primary)
                                .withValues(alpha: 0.4),
                            blurRadius: 20,
                            spreadRadius: 2,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            attendanceController.currentStep % 2 == 1 ? LucideIcons.logOut : LucideIcons.fingerprint,
                            color: Colors.white,
                            size: 40,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            attendanceController.activeActionLabel,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ).animate(target: attendanceController.currentStep.toDouble()).scale(duration: 300.ms),
                const SizedBox(height: 24),

                // Single Box Daily Sessions Display (Session 1 & Session 2 in 1 Card)
                Obx(
                  () => Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                    child: Column(
                      children: [
                        // Session 1 (Morning / ព្រឹក)
                        Row(
                          children: [
                            const Expanded(
                              child: Row(
                                children: [
                                  Icon(LucideIcons.sun, size: 15, color: AppColors.warning),
                                  SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'Session 1 (ព្រឹក)',
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildTimeSlotPill('In 1', attendanceController.checkIn1 ?? '--:--', AppColors.success),
                                const SizedBox(width: 4),
                                _buildTimeSlotPill('Out 1', attendanceController.checkOut1 ?? '--:--', AppColors.danger),
                              ],
                            ),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Divider(height: 1),
                        ),

                        // Session 2 (Afternoon / រសៀល)
                        Row(
                          children: [
                            const Expanded(
                              child: Row(
                                children: [
                                  Icon(LucideIcons.sunset, size: 15, color: AppColors.accent),
                                  SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'Session 2 (រសៀល)',
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildTimeSlotPill('In 2', attendanceController.checkIn2 ?? '--:--', AppColors.success),
                                const SizedBox(width: 4),
                                _buildTimeSlotPill('Out 2', attendanceController.checkOut2 ?? '--:--', AppColors.danger),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 24),

          // Quick Action Grid
          Obx(
            () => Text(
              langController.tr('quick_actions'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),

          Obx(
            () => GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 1.35,
              children: [
                _buildActionCard(
                  context,
                  icon: LucideIcons.calendarPlus,
                  title: langController.tr('apply_leave'),
                  color: AppColors.primary,
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      builder: (_) => const ApplyLeaveSheet(),
                    );
                  },
                ),
                _buildActionCard(
                  context,
                  icon: LucideIcons.history,
                  title: langController.tr('attendance_logs'),
                  color: AppColors.accent,
                  onTap: () => onTabSelected(1),
                ),
                _buildActionCard(
                  context,
                  icon: LucideIcons.clock,
                  title: langController.tr('overtime'),
                  color: AppColors.warning,
                  onTap: () {
                    Get.to(() => const OvertimeScreen());
                  },
                ),
                _buildActionCard(
                  context,
                  icon: LucideIcons.qrCode,
                  title: langController.tr('qr_scan'),
                  color: AppColors.success,
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      builder: (_) => const ScannerModalSheet(),
                    );
                  },
                ),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms),
          const SizedBox(height: 24),

          // Monthly Statistics Summary (Attendance Statistics)
          Obx(
            () => Text(
              langController.tr('quick_stats'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),

          Obx(
            () => CustomCard(
              child: Row(
                children: [
                  StatRingChart(
                    present: attendanceController.presentCount,
                    lateDays: attendanceController.lateCount,
                    leave: attendanceController.leaveCount,
                    absent: attendanceController.absentCount,
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      children: [
                        _buildStatRow(langController.tr('present_days'), '${attendanceController.presentCount} days', AppColors.success),
                        const SizedBox(height: 8),
                        _buildStatRow(langController.tr('late_days'), '${attendanceController.lateCount} days', AppColors.warning),
                        const SizedBox(height: 8),
                        _buildStatRow(langController.tr('leave_days'), '${attendanceController.leaveCount} days', AppColors.info),
                        const SizedBox(height: 8),
                        _buildStatRow(langController.tr('absent_days'), '${attendanceController.absentCount} days', AppColors.danger),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 400.ms),
        ],
      ),
    ),
  );
  }

  Widget _buildTimeSlotPill(String label, String time, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ', style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
          Text(time, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 13)),
          ],
        ),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildActionCard(BuildContext context, {required IconData icon, required String title, required Color color, required VoidCallback onTap}) {
    return CustomCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
