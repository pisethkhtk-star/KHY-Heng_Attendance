import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification_model.dart';

class NotificationController extends GetxController {
  final RxList<AppNotificationItem> notifications = <AppNotificationItem>[].obs;
  static const String _storageKey = 'stored_app_notifications';

  int get unreadCount => notifications.where((n) => !n.isRead).length;

  @override
  void onInit() {
    super.onInit();
    loadStoredNotifications();
  }

  Future<void> loadStoredNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_storageKey);
      if (str != null && str.isNotEmpty) {
        final List<dynamic> list = jsonDecode(str);
        notifications.value = list.map((j) => AppNotificationItem.fromJson(j)).toList();
      }
    } catch (_) {}
  }

  Future<void> _saveNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = jsonEncode(notifications.map((n) => n.toJson()).toList());
      await prefs.setString(_storageKey, str);
    } catch (_) {}
  }

  Future<void> addNotification({
    required String title,
    required String message,
    required String type, // 'approved', 'rejected'
    String? targetId,
    VoidCallback? onView,
  }) async {
    // Avoid exact duplicate notification within the last few minutes
    final isDuplicate = notifications.any((n) =>
        n.targetId == targetId &&
        n.type == type &&
        DateTime.now().difference(n.timestamp).inMinutes < 60);

    if (isDuplicate) return;

    final item = AppNotificationItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      message: message,
      type: type,
      timestamp: DateTime.now(),
      targetId: targetId,
    );

    notifications.insert(0, item);
    await _saveNotifications();

    // Trigger instant native-style Heads-Up Notification Banner via Get.snackbar
    showHeadsUpNotification(item, onView: onView);
  }

  void showHeadsUpNotification(AppNotificationItem item, {VoidCallback? onView}) {
    final isApproved = item.type == 'approved';
    Get.snackbar(
      item.title,
      item.message,
      icon: Container(
        margin: const EdgeInsets.only(left: 12),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          shape: BoxShape.circle,
        ),
        child: Icon(
          isApproved ? LucideIcons.checkCheck : LucideIcons.x,
          color: Colors.white,
          size: 22,
        ),
      ),
      snackPosition: SnackPosition.TOP,
      backgroundColor: isApproved ? const Color(0xFF059669) : const Color(0xFFDC2626),
      colorText: Colors.white,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      borderRadius: 16,
      duration: const Duration(seconds: 6),
      isDismissible: true,
      dismissDirection: DismissDirection.horizontal,
      forwardAnimationCurve: Curves.easeOutCubic,
      boxShadows: [
        BoxShadow(
          color: (isApproved ? const Color(0xFF059669) : const Color(0xFFDC2626)).withValues(alpha: 0.4),
          blurRadius: 18,
          offset: const Offset(0, 8),
        )
      ],
      mainButton: TextButton(
        style: TextButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.25),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        ),
        onPressed: () {
          if (Get.isSnackbarOpen) Get.closeCurrentSnackbar();
          item.isRead = true;
          notifications.refresh();
          _saveNotifications();
          if (onView != null) {
            onView();
          }
        },
        child: const Text(
          'OPEN',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
        ),
      ),
    );
  }

  void markAllAsRead() {
    for (var n in notifications) {
      n.isRead = true;
    }
    notifications.refresh();
    _saveNotifications();
  }

  void clearAll() {
    notifications.clear();
    _saveNotifications();
  }
}
