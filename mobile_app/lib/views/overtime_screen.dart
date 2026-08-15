import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/overtime_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/custom_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/apply_overtime_sheet.dart';

class OvertimeScreen extends StatefulWidget {
  const OvertimeScreen({super.key});

  @override
  State<OvertimeScreen> createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadOvertimeData();
    });
  }

  void _loadOvertimeData() {
    final user = Get.find<AuthController>().user;
    Get.find<OvertimeController>().fetchRemoteOvertimes(staffId: user?.employeeId);
  }

  void _confirmCancelOvertime(BuildContext context, String id) {
    final overtimeController = Get.find<OvertimeController>();
    final langController = Get.find<LanguageController>();
    final user = Get.find<AuthController>().user;

    showDialog(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          title: Text(langController.tr('cancel_ot_title')),
          content: Text(langController.tr('cancel_ot_confirm')),
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

                final result = await overtimeController.cancelOvertime(id, staffId: user?.employeeId);

                // Close loading spinner
                if (context.mounted) Navigator.of(context).pop();

                if (result['success'] == true) {
                  Get.snackbar(
                    langController.tr('success'),
                    langController.tr('cancel_ot_success'),
                    snackPosition: SnackPosition.BOTTOM,
                    backgroundColor: Colors.green,
                    colorText: Colors.white,
                  );
                } else {
                  Get.snackbar(
                    langController.tr('error'),
                    result['message'] ?? langController.tr('cancel_ot_failed'),
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
    final overtimeController = Get.find<OvertimeController>();
    final langController = Get.find<LanguageController>();

    return Scaffold(
      appBar: AppBar(
        title: Obx(() => Text(langController.tr('overtime_title'))),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final user = Get.find<AuthController>().user;
          await overtimeController.fetchRemoteOvertimes(staffId: user?.employeeId);
        },
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Obx(
            () => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Apply Overtime Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 1,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                        ),
                        builder: (_) => const ApplyOvertimeSheet(),
                      );
                    },
                    icon: const Icon(LucideIcons.plus, size: 20),
                    label: Text(
                      langController.tr('apply_overtime'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Request History Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        langController.tr('my_overtime_apps'),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                    IconButton(
                      onPressed: _loadOvertimeData,
                      icon: const Icon(LucideIcons.refreshCw, size: 18, color: AppColors.primary),
                      tooltip: 'Refresh',
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (overtimeController.overtimeRequests.isEmpty) ...[
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(40.0),
                      child: Text(
                        langController.tr('no_ot_found'),
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ),
                  ),
                ] else ...[
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: overtimeController.overtimeRequests.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final request = overtimeController.overtimeRequests[index];
                      return CustomCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(LucideIcons.clock, size: 16, color: AppColors.primary),
                                    const SizedBox(width: 6),
                                    Text(
                                      '${request.startTime} - ${request.endTime}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                    ),
                                  ],
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
                                        onPressed: () => _confirmCancelOvertime(context, request.id),
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
                                  request.fromDate == request.toDate
                                      ? '${request.fromDate} (${request.amountDay} day${request.amountDay > 1 ? "s" : ""})'
                                      : '${request.fromDate} to ${request.toDate} (${request.amountDay} days)',
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
                            if (request.comment != null && request.comment!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.grey.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Comment: ${request.comment}',
                                  style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
