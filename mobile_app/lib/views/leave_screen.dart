import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/leave_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/custom_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/apply_leave_sheet.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadLeaveData();
    });
  }

  void _loadLeaveData() {
    final user = Get.find<AuthController>().user;
    Get.find<LeaveController>().fetchRemoteLeaves(staffId: user?.employeeId);
  }

  void _confirmCancelLeave(BuildContext context, String id) {
    final leaveController = Get.find<LeaveController>();
    final langController = Get.find<LanguageController>();
    final user = Get.find<AuthController>().user;
    
    showDialog(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          title: Text(langController.tr('cancel_leave_title')),
          content: Text(langController.tr('cancel_leave_confirm')),
          actions: [
            TextButton(
              child: Text(langController.tr('no')),
              onPressed: () => Navigator.of(ctx).pop(),
            ),
            TextButton(
              child: Text(
                langController.tr('yes_cancel'),
                style: const TextStyle(color: Colors.red),
              ),
              onPressed: () async {
                Navigator.of(ctx).pop();
                
                // Show loading spinner
                showDialog(
                  context: context,
                  barrierDismissible: false,
                  builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                );
                
                final result = await leaveController.cancelLeave(id, staffId: user?.employeeId);
                
                // Close loading spinner
                if (context.mounted) Navigator.of(context).pop();
                
                if (result['success'] == true) {
                  Get.snackbar(
                    langController.tr('success'),
                    langController.tr('cancel_leave_success'),
                    snackPosition: SnackPosition.BOTTOM,
                    backgroundColor: Colors.green,
                    colorText: Colors.white,
                  );
                } else {
                  Get.snackbar(
                    langController.tr('error'),
                    result['message'] ?? langController.tr('cancel_leave_failed'),
                    snackPosition: SnackPosition.BOTTOM,
                    backgroundColor: Colors.red,
                    colorText: Colors.white,
                  );
                }
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final leaveController = Get.find<LeaveController>();
    final langController = Get.find<LanguageController>();

    return RefreshIndicator(
      onRefresh: () async {
        final user = Get.find<AuthController>().user;
        await leaveController.fetchRemoteLeaves(staffId: user?.employeeId);
      },
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Obx(
          () => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  langController.tr('leave_balance'),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      builder: (_) => const ApplyLeaveSheet(),
                    );
                  },
                  icon: const Icon(LucideIcons.plus, size: 18),
                  label: Text(langController.tr('apply_leave')),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Leave Balance Horizontal Scroll Cards
            SizedBox(
              height: 130,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: leaveController.balances.length,
                separatorBuilder: (context, index) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final item = leaveController.balances[index];
                  return SizedBox(
                    width: 160,
                    child: CustomCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            item.typeName,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                item.formattedRemaining,
                                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                              Text(
                                ' / ${item.formattedTotal} days',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                          LinearProgressIndicator(
                            value: item.percentageUsed,
                            backgroundColor: Colors.grey.shade200,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),

            // Request History Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Leave Applications',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  onPressed: _loadLeaveData,
                  icon: const Icon(LucideIcons.refreshCw, size: 18, color: AppColors.primary),
                  tooltip: 'Sync Realtime Leaves',
                ),
              ],
            ),
            const SizedBox(height: 12),

            if (leaveController.leaveRequests.isEmpty) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Text('No leave applications found', style: TextStyle(color: Colors.grey)),
                ),
              ),
            ] else ...[
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: leaveController.leaveRequests.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final request = leaveController.leaveRequests[index];
                  return CustomCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              request.leaveType,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            Row(
                              children: [
                                StatusBadge(status: request.status, label: request.status),
                                if (request.status.toLowerCase() == 'pending') ...[
                                  const SizedBox(width: 8),
                                  IconButton(
                                    constraints: const BoxConstraints(),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.red),
                                    onPressed: () => _confirmCancelLeave(context, request.id),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(LucideIcons.calendar, size: 14, color: Colors.grey),
                            const SizedBox(width: 6),
                            Text(
                              request.startDate == request.endDate
                                  ? '${request.startDate} (${request.totalDays == 0.5 ? "0.5 day" : "${request.totalDays} day${request.totalDays > 1 ? "s" : ""}"})'
                                  : '${request.startDate} to ${request.endDate} (${request.totalDays} days)',
                              style: const TextStyle(fontSize: 13, color: Colors.grey),
                            ),
                          ],
                        ),
                        if (request.reason.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Reason: ${request.reason}',
                            style: const TextStyle(fontSize: 13),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ],
          ],
        )),
      ),
    );
  }
}
