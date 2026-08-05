import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../core/constants/app_colors.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/language_provider.dart';
import '../widgets/live_clock_widget.dart';
import '../widgets/custom_card.dart';
import '../widgets/stat_ring_chart.dart';
import '../widgets/apply_leave_sheet.dart';
import '../widgets/scanner_modal_sheet.dart';

class HomeScreen extends StatelessWidget {
  final Function(int) onTabSelected;

  const HomeScreen({super.key, required this.onTabSelected});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final attendanceProvider = Provider.of<AttendanceProvider>(context);
    final langProvider = Provider.of<LanguageProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = authProvider.user;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // User Greeting Header
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.primaryLight,
                child: Text(
                  user?.name.substring(0, 1).toUpperCase() ?? 'U',
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${langProvider.tr('welcome_back')}, 👋',
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
          ).animate().fadeIn().slideY(begin: -0.2, end: 0),
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
                    Row(
                      children: [
                        const Icon(LucideIcons.mapPin, color: AppColors.primary, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          langProvider.tr('location_office'),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.successBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
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
                GestureDetector(
                  onTap: attendanceProvider.isProcessing
                      ? null
                      : () => attendanceProvider.toggleCheckInCheckOut(),
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: attendanceProvider.currentStep % 2 == 1
                          ? const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFDC2626)])
                          : AppColors.primaryGradient,
                      boxShadow: [
                        BoxShadow(
                          color: (attendanceProvider.currentStep % 2 == 1
                                  ? AppColors.danger
                                  : AppColors.primary)
                              .withOpacity(0.4),
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
                          attendanceProvider.currentStep % 2 == 1 ? LucideIcons.logOut : LucideIcons.fingerprint,
                          color: Colors.white,
                          size: 40,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          attendanceProvider.activeActionLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ).animate(target: attendanceProvider.currentStep.toDouble()).scale(duration: 300.ms),
                const SizedBox(height: 24),

                // Single Box Daily Sessions Display (Session 1 & Session 2 in 1 Card)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black.withOpacity(0.3) : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  ),
                  child: Column(
                    children: [
                      // Session 1 (Morning / ព្រឹក)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(LucideIcons.sun, size: 16, color: AppColors.warning),
                              SizedBox(width: 6),
                              Text('Session 1 (ព្រឹក)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                          Row(
                            children: [
                              _buildTimeSlotPill('In 1', attendanceProvider.checkIn1 ?? '--:--', AppColors.success),
                              const SizedBox(width: 8),
                              _buildTimeSlotPill('Out 1', attendanceProvider.checkOut1 ?? '--:--', AppColors.danger),
                            ],
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 10),
                        child: Divider(height: 1),
                      ),

                      // Session 2 (Afternoon / រសៀល)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(LucideIcons.sunset, size: 16, color: AppColors.accent),
                              SizedBox(width: 6),
                              Text('Session 2 (រសៀល)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                          Row(
                            children: [
                              _buildTimeSlotPill('In 2', attendanceProvider.checkIn2 ?? '--:--', AppColors.success),
                              const SizedBox(width: 8),
                              _buildTimeSlotPill('Out 2', attendanceProvider.checkOut2 ?? '--:--', AppColors.danger),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 24),

          // Monthly Statistics Summary
          Text(
            langProvider.tr('quick_stats'),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          CustomCard(
            child: Row(
              children: [
                StatRingChart(
                  present: attendanceProvider.presentCount,
                  lateDays: attendanceProvider.lateCount,
                  leave: attendanceProvider.leaveCount,
                  absent: attendanceProvider.absentCount,
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    children: [
                      _buildStatRow(langProvider.tr('present_days'), '${attendanceProvider.presentCount} days', AppColors.success),
                      const SizedBox(height: 8),
                      _buildStatRow(langProvider.tr('late_days'), '${attendanceProvider.lateCount} days', AppColors.warning),
                      const SizedBox(height: 8),
                      _buildStatRow(langProvider.tr('leave_days'), '${attendanceProvider.leaveCount} days', AppColors.info),
                      const SizedBox(height: 8),
                      _buildStatRow(langProvider.tr('absent_days'), '${attendanceProvider.absentCount} days', AppColors.danger),
                    ],
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms),
          const SizedBox(height: 24),

          // Quick Action Grid
          Text(
            langProvider.tr('quick_actions'),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: 1.6,
            children: [
              _buildActionCard(
                context,
                icon: LucideIcons.calendarPlus,
                title: langProvider.tr('apply_leave'),
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
                title: langProvider.tr('attendance_logs'),
                color: AppColors.accent,
                onTap: () => onTabSelected(1),
              ),
              _buildActionCard(
                context,
                icon: LucideIcons.clock,
                title: langProvider.tr('overtime'),
                color: AppColors.warning,
                onTap: () {},
              ),
              _buildActionCard(
                context,
                icon: LucideIcons.qrCode,
                title: langProvider.tr('qr_scan'),
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
          ).animate().fadeIn(delay: 400.ms),
        ],
      ),
    );
  }

  Widget _buildTimeSlotPill(String label, String time, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Text('$label: ', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
          Text(time, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
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
              color: color.withOpacity(0.12),
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
