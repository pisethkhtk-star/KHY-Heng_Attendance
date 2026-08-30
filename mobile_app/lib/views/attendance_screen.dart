import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/custom_card.dart';
import '../widgets/status_badge.dart';
import '../models/attendance_model.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  String _selectedFilter = 'All';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadHistory();
    });
  }

  void _loadHistory() {
    final user = Get.find<AuthController>().user;
    Get.find<AttendanceController>().fetchRemoteHistory(staffId: user?.employeeId);
  }

  @override
  Widget build(BuildContext context) {
    final attendanceController = Get.find<AttendanceController>();
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: () async {
        final user = Get.find<AuthController>().user;
        await attendanceController.fetchRemoteHistory(staffId: user?.employeeId);
      },
      color: AppColors.primary,
      notificationPredicate: (ScrollNotification notification) {
        // Only trigger pull-to-refresh at the top of the list! Never trigger when scrolling down!
        return notification.depth == 0 && notification.metrics.pixels <= 0;
      },
      child: Obx(() {
        final records = attendanceController.historyRecords.where((record) {
          if (_selectedFilter == 'All') return true;
          if (_selectedFilter == 'Miss' || _selectedFilter == 'Incomplete') return record.isIncomplete;
          return record.status.toLowerCase() == _selectedFilter.toLowerCase();
        }).toList();

        return CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              langController.tr('attendance_logs'),
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              "Today's Live Attendance History",
                              style: TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                        IconButton(
                          onPressed: _loadHistory,
                          icon: const Icon(LucideIcons.refreshCw, size: 20, color: AppColors.primary),
                          tooltip: 'Refresh Live Data',
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Filter Chips Row: All, Present, Late, Miss (On Leave removed)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          {'key': 'All', 'label': langController.tr('all')},
                          {'key': 'Present', 'label': langController.tr('present_days')},
                          {'key': 'Late', 'label': langController.tr('late_days')},
                          {'key': 'Miss', 'label': 'Miss'},
                        ].map((item) {
                          final filter = item['key']!;
                          final label = item['label']!;
                          final isSelected = _selectedFilter == filter;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(label),
                              selected: isSelected,
                              selectedColor: filter == 'Miss' ? Colors.orange.shade700 : AppColors.primary,
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                fontWeight: FontWeight.bold,
                              ),
                              onSelected: (selected) {
                                if (selected) setState(() => _selectedFilter = filter);
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
            if (records.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(40.0),
                    child: Text(
                      _selectedFilter == 'Miss'
                          ? 'No miss records found'
                          : 'No attendance records found',
                      style: const TextStyle(color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                sliver: SliverList.separated(
                  itemCount: records.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final record = records[index];
                    return _buildRecordCard(context, record, langController, isDark);
                  },
                ),
              ),
          ],
        );
      }),
    );
  }

  Widget _buildRecordCard(BuildContext context, AttendanceRecord record, LanguageController langController, bool isDark) {
    return CustomCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Date & Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(LucideIcons.calendarCheck, color: AppColors.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            record.date,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (record.staffId.isNotEmpty)
                            Text(
                              'Staff ID: ${record.staffId} ${record.employeeName.isNotEmpty ? "• ${record.employeeName}" : ""}',
                              style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (record.isIncomplete)
                    const StatusBadge(
                      status: 'miss',
                      label: 'Miss',
                    )
                  else
                    StatusBadge(
                      status: record.status,
                      label: record.status,
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Single Box Body: Display ONLY data existing in Database (No mock/blank pills)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Builder(
              builder: (context) {
                bool isValidLog(String? val) => val != null && val.isNotEmpty && val != '-' && val != '--:--';

                final hasCheckIn1 = isValidLog(record.checkIn1);
                final hasCheckOut1 = isValidLog(record.checkOut1);
                final hasCheckIn2 = isValidLog(record.checkIn2);
                final hasCheckOut2 = isValidLog(record.checkOut2);

                final hasShift1 = hasCheckIn1 || hasCheckOut1;
                final hasShift2 = hasCheckIn2 || hasCheckOut2;

                if (!hasShift1 && !hasShift2) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      record.status == 'On Leave' ? 'Approved Leave' : 'No check-in/out recorded',
                      style: const TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Shift 1
                    if (hasShift1) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(LucideIcons.sun, size: 14, color: AppColors.warning),
                              SizedBox(width: 6),
                              Text('Shift 1:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Column(
                            children: [
                              _buildSessionPill('Check-in 1', hasCheckIn1 ? record.checkIn1! : '--:--', AppColors.success),
                              const SizedBox(height: 6),
                              _buildSessionPill('Check-out 1', hasCheckOut1 ? record.checkOut1! : '--:--', AppColors.danger),
                            ],
                          ),
                        ],
                      ),
                    ],
                    // Shift 2
                    if (hasShift2) ...[
                      if (hasShift1)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Divider(height: 1),
                        ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(LucideIcons.sunset, size: 14, color: AppColors.accent),
                              SizedBox(width: 6),
                              Text('Shift 2:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Column(
                            children: [
                              _buildSessionPill('Check-in 2', hasCheckIn2 ? record.checkIn2! : '--:--', AppColors.success),
                              const SizedBox(height: 6),
                              _buildSessionPill('Check-out 2', hasCheckOut2 ? record.checkOut2! : '--:--', AppColors.danger),
                            ],
                          ),
                        ],
                      ),
                    ],
                    if (record.note != null && record.note!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(LucideIcons.notebook, size: 13, color: AppColors.primary),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              'Note: ${record.note}',
                              style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionPill(String label, String time, Color color) {
    return Container(
      width: double.infinity,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        '$label: $time',
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

