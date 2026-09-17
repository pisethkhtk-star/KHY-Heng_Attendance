import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../controllers/language_controller.dart';
import '../controllers/leave_controller.dart';
import '../core/constants/app_colors.dart';
import '../models/leave_model.dart';
import '../widgets/custom_card.dart';
import '../widgets/status_badge.dart';

class LeaveApprovalScreen extends StatefulWidget {
  const LeaveApprovalScreen({super.key});

  @override
  State<LeaveApprovalScreen> createState() => _LeaveApprovalScreenState();
}

class _LeaveApprovalScreenState extends State<LeaveApprovalScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final LeaveController _leaveController = Get.find<LeaveController>();
  final LanguageController _langController = Get.find<LanguageController>();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshAll();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _leaveController.fetchPendingApprovals(),
      _leaveController.fetchApprovalHistory(),
      _leaveController.checkApprovalEligibility(),
    ]);
  }

  void _showActionDialog(LeaveItem leave, bool isApprove) {
    final reasonController = TextEditingController();
    final isKhmer = _langController.currentLanguage == 'km';

    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (isApprove ? AppColors.success : AppColors.danger).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isApprove ? LucideIcons.checkCircle : LucideIcons.xCircle,
                  color: isApprove ? AppColors.success : AppColors.danger,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  isApprove
                      ? (isKhmer ? 'អនុម័តច្បាប់ឈប់' : 'Approve Leave')
                      : (isKhmer ? 'បដិសេធច្បាប់ឈប់' : 'Reject Leave'),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isApprove
                    ? _langController.tr('approve_confirm')
                    : _langController.tr('reject_confirm'),
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${leave.employeeName ?? leave.staffId ?? "Employee"} (${leave.staffId ?? "-"})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${leave.leaveType} • ${leave.totalDays} day(s) • ${leave.startDate}',
                      style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: reasonController,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: isApprove
                      ? _langController.tr('approval_remark')
                      : _langController.tr('rejection_reason'),
                  labelStyle: const TextStyle(fontSize: 13),
                  hintText: isApprove ? 'e.g., Have a safe trip' : 'e.g., Critical deadline this week',
                  hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(
                _langController.tr('cancel'),
                style: const TextStyle(color: Colors.grey),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: isApprove ? AppColors.success : AppColors.danger,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              ),
              onPressed: () async {
                Navigator.of(ctx).pop();
                final note = reasonController.text.trim();
                bool success = false;
                if (isApprove) {
                  success = await _leaveController.approveLeave(leave.id, reason: note.isNotEmpty ? note : null);
                } else {
                  success = await _leaveController.rejectLeave(leave.id, reason: note.isNotEmpty ? note : null);
                }

                if (success) {
                  Get.snackbar(
                    _langController.tr('success'),
                    isApprove
                        ? _langController.tr('leave_approved_success')
                        : _langController.tr('leave_rejected_success'),
                    snackPosition: SnackPosition.BOTTOM,
                    backgroundColor: (isApprove ? AppColors.success : AppColors.danger).withValues(alpha: 0.9),
                    colorText: Colors.white,
                    margin: const EdgeInsets.all(16),
                    borderRadius: 12,
                    duration: const Duration(seconds: 3),
                  );
                }
              },
              child: Text(
                isApprove ? _langController.tr('approve') : _langController.tr('reject'),
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Obx(
          () => Text(
            _langController.tr('leave_approvals'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            tooltip: 'Refresh',
            onPressed: _refreshAll,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(14),
            ),
            child: TabBar(
              controller: _tabController,
              indicatorSize: TabBarIndicatorSize.tab,
              indicator: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(12),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: isDark ? Colors.grey.shade400 : Colors.grey.shade700,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              tabs: [
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_langController.tr('pending')),
                      const SizedBox(width: 8),
                      Obx(() {
                        final count = _leaveController.pendingApprovalsCount.value;
                        if (count <= 0) return const SizedBox.shrink();
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.danger,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '$count',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                Tab(
                  child: Text(_langController.tr('approval_history')),
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPendingTab(isDark),
          _buildHistoryTab(isDark),
        ],
      ),
    );
  }

  Widget _buildPendingTab(bool isDark) {
    return RefreshIndicator(
      onRefresh: _refreshAll,
      color: AppColors.primary,
      child: Obx(() {
        if (_leaveController.isLoadingApprovals.value && _leaveController.pendingApprovals.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        final items = _leaveController.pendingApprovals;
        if (items.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(height: MediaQuery.of(context).size.height * 0.2),
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(LucideIcons.checkCheck, size: 48, color: AppColors.primary),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _langController.tr('all_caught_up'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _langController.tr('no_pending_approvals'),
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (context, index) => const SizedBox(height: 14),
          itemBuilder: (ctx, index) {
            final leave = items[index];
            return _buildPendingCard(leave, isDark)
                .animate()
                .fadeIn(duration: 250.ms, delay: (index * 40).ms)
                .slideY(begin: 0.05, end: 0);
          },
        );
      }),
    );
  }

  Widget _buildPendingCard(LeaveItem leave, bool isDark) {
    final displayName = leave.employeeNameKh != null && leave.employeeNameKh!.isNotEmpty
        ? '${leave.employeeNameKh} (${leave.employeeName ?? ""})'
        : (leave.employeeName ?? leave.staffId ?? "Employee");

    return CustomCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Employee Avatar + Name + Staff ID + Status Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildAvatar(leave.photoUrl, displayName),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            leave.staffId ?? '-',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        if (leave.departmentName != null) ...[
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              leave.departmentName!,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              StatusBadge(status: leave.status, label: _langController.tr('pending')),
            ],
          ),
          const SizedBox(height: 14),

          // Leave Details Box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? Colors.black.withValues(alpha: 0.25) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(LucideIcons.calendarDays, size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text(
                          leave.leaveType,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${leave.totalDays} ${_langController.tr(leave.totalDays <= 1 ? "full_day" : "multiple_days")}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(LucideIcons.clock, size: 14, color: Colors.grey),
                    const SizedBox(width: 6),
                    Text(
                      (leave.startDate == leave.endDate)
                          ? leave.startDate
                          : '${leave.startDate} → ${leave.endDate}',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
                if (leave.reason.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(LucideIcons.messageSquare, size: 14, color: Colors.grey),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          leave.reason,
                          style: TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: isDark ? Colors.grey.shade300 : Colors.grey.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Action Buttons: Reject & Approve
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger, width: 1.2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(LucideIcons.x, size: 18),
                  label: Text(
                    _langController.tr('reject'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  onPressed: () => _showActionDialog(leave, false),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(LucideIcons.check, size: 18),
                  label: Text(
                    _langController.tr('approve'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  onPressed: () => _showActionDialog(leave, true),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab(bool isDark) {
    return RefreshIndicator(
      onRefresh: _refreshAll,
      color: AppColors.primary,
      child: Obx(() {
        if (_leaveController.isLoadingApprovals.value && _leaveController.approvalHistory.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        final items = _leaveController.approvalHistory;
        if (items.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(height: MediaQuery.of(context).size.height * 0.2),
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.history, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    Text(
                      'No approval history records yet',
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (ctx, index) {
            final leave = items[index];
            return _buildHistoryCard(leave, isDark)
                .animate()
                .fadeIn(duration: 250.ms, delay: (index * 30).ms)
                .slideY(begin: 0.05, end: 0);
          },
        );
      }),
    );
  }

  Widget _buildHistoryCard(LeaveItem leave, bool isDark) {
    final displayName = leave.employeeNameKh != null && leave.employeeNameKh!.isNotEmpty
        ? '${leave.employeeNameKh} (${leave.employeeName ?? ""})'
        : (leave.employeeName ?? leave.staffId ?? "Employee");

    final isApproved = leave.status.toLowerCase() == 'approved';

    return CustomCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildAvatar(leave.photoUrl, displayName, radius: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    Text(
                      '${leave.leaveType} • ${leave.startDate}',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: leave.status, label: leave.status),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: (isApproved ? AppColors.success : AppColors.danger).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  isApproved ? LucideIcons.check : LucideIcons.x,
                  size: 14,
                  color: isApproved ? AppColors.success : AppColors.danger,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    leave.managerName != null
                        ? '${isApproved ? _langController.tr("approved_by") : _langController.tr("rejected_by")} ${leave.managerName}'
                        : leave.status,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isApproved ? AppColors.success : AppColors.danger,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  '${leave.totalDays}d',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          if (leave.reason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              leave.reason,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.grey.shade400 : Colors.grey.shade700,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(String? photoUrl, String name, {double radius = 22}) {
    if (photoUrl != null && photoUrl.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
        backgroundImage: NetworkImage(photoUrl),
        onBackgroundImageError: (exception, stackTrace) {},
      );
    }
    final initial = name.isNotEmpty ? name.trim().substring(0, 1).toUpperCase() : '?';
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
      child: Text(
        initial,
        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
      ),
    );
  }
}
