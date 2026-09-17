import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../core/constants/app_colors.dart';
import '../controllers/notification_controller.dart';
import '../controllers/language_controller.dart';

class NotificationsSheet extends StatelessWidget {
  final VoidCallback? onNavigateToLeave;

  const NotificationsSheet({super.key, this.onNavigateToLeave});

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('dd MMM, hh:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final notifController = Get.find<NotificationController>();
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.bellRing, size: 22, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      langController.tr('notifications'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Obx(() {
                  if (notifController.notifications.isEmpty) return const SizedBox.shrink();
                  return Row(
                    children: [
                      TextButton(
                        onPressed: notifController.markAllAsRead,
                        child: Text(
                          langController.tr('mark_all_read'),
                          style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.grey),
                        onPressed: notifController.clearAll,
                        tooltip: 'Clear All',
                      ),
                    ],
                  );
                }),
              ],
            ),
          ),
          const Divider(height: 1),

          // Notifications List
          Expanded(
            child: Obx(() {
              final list = notifController.notifications;
              if (list.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.bellOff, size: 48, color: AppColors.primary),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        langController.tr('no_notifications'),
                        style: const TextStyle(fontSize: 14, color: Colors.grey),
                      ),
                    ],
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                itemCount: list.length,
                separatorBuilder: (context, index) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = list[index];
                  final typeLower = item.type.toLowerCase();
                  final isApproved = typeLower == 'approved' || typeLower == 'leave_approved';
                  final isRejected = typeLower == 'rejected' || typeLower == 'leave_rejected';
                  final isRequest = typeLower == 'leave_request';
                  final isDeleted = typeLower == 'leave_deleted' || typeLower == 'leave_cancelled';

                  final isAnnouncement = typeLower == 'announcement';
                  final isUrgent = typeLower == 'urgent';
                  final isEvent = typeLower == 'event';
                  final isReminder = typeLower == 'reminder';

                  final Color statusColor = isApproved
                      ? const Color(0xFF10B981)
                      : (isRejected || isUrgent)
                          ? const Color(0xFFEF4444)
                          : isEvent
                              ? const Color(0xFF9333EA)
                              : isReminder
                                  ? const Color(0xFFD97706)
                                  : (isRequest || isAnnouncement)
                                      ? const Color(0xFF3B82F6)
                                      : isDeleted
                                          ? const Color(0xFFE11D48)
                                          : AppColors.primary;

                  final IconData statusIcon = isApproved
                      ? LucideIcons.checkCheck
                      : (isRejected || isUrgent)
                          ? LucideIcons.circleAlert
                          : isEvent
                              ? LucideIcons.partyPopper
                              : isReminder
                                  ? LucideIcons.clock
                                  : isAnnouncement
                                      ? LucideIcons.megaphone
                                      : isRequest
                                          ? LucideIcons.fileText
                                          : isDeleted
                                              ? LucideIcons.trash2
                                              : LucideIcons.bellRing;

                  return InkWell(
                    onTap: () {
                      notifController.markAsRead(item.id);
                      Navigator.of(context).pop();
                      if (onNavigateToLeave != null) {
                        onNavigateToLeave!();
                      }
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: item.isRead
                            ? (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.shade50)
                            : (isDark ? statusColor.withValues(alpha: 0.12) : statusColor.withValues(alpha: 0.08)),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: item.isRead
                              ? (isDark ? AppColors.borderDark : AppColors.borderLight)
                              : statusColor.withValues(alpha: 0.4),
                          width: item.isRead ? 1 : 1.5,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              statusIcon,
                              color: statusColor,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: isDark ? Colors.white : Colors.black87,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Text(
                                      _formatTime(item.timestamp),
                                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.message,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
                                    height: 1.35,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!item.isRead) ...[
                            const SizedBox(width: 6),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: statusColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }
}
