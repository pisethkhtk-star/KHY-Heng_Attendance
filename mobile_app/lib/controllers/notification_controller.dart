import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification_model.dart';
import '../core/services/local_notification_service.dart';
import '../core/services/base_api_client.dart';

import '../core/services/background_notification_service.dart';

class NotificationController extends GetxController with WidgetsBindingObserver {
  final RxList<AppNotificationItem> notifications = <AppNotificationItem>[].obs;
  static const String _storageKey = 'stored_app_notifications';
  static const String _seenIdsKey = 'seen_notification_ids';
  Timer? _syncTimer;

  BaseApiClient? get _apiClient =>
      Get.isRegistered<BaseApiClient>() ? Get.find<BaseApiClient>() : null;

  int get unreadCount => notifications.where((n) => !n.isRead).length;

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    LocalNotificationService().requestPermission();
    loadStoredNotifications();
    fetchRemoteNotifications();
    _startPeriodicSync();
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncTimer?.cancel();
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.hidden) {
      // User minimized the app -> schedule immediate background sync
      BackgroundNotificationService().triggerImmediateBackgroundSync();
    } else if (state == AppLifecycleState.resumed) {
      // User reopened the app -> refresh immediately
      fetchRemoteNotifications();
    }
  }

  void _startPeriodicSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      fetchRemoteNotifications();
    });
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

  /// Sync notifications from backend /notifications
  Future<void> fetchRemoteNotifications() async {
    try {
      if (_apiClient == null) return;
      final res = await _apiClient!.get('/notifications');
      if (res == null || res.statusCode != 200) return;

      final List<dynamic> rawList = jsonDecode(res.body);
      final List<AppNotificationItem> remoteList =
          rawList.map((j) => AppNotificationItem.fromJson(j)).toList();

      final prefs = await SharedPreferences.getInstance();
      final List<String> seenIds = prefs.getStringList(_seenIdsKey) ?? [];
      final List<String> updatedSeenIds = List.from(seenIds);

      // Check for newly arrived unread notifications that haven't triggered a heads-up alert yet
      for (final item in remoteList) {
        if (!item.isRead && !seenIds.contains(item.id)) {
          updatedSeenIds.add(item.id);
          showHeadsUpNotification(item);
          LocalNotificationService().showPushNotification(
            title: item.title,
            body: item.message,
            payload: item.targetId ?? item.id,
            type: item.type,
          );
        }
      }

      await prefs.setStringList(_seenIdsKey, updatedSeenIds);
      notifications.value = remoteList;
      await _saveNotifications();
    } catch (e) {
      debugPrint('[NotificationController] Error fetching remote notifications: $e');
    }
  }

  Future<void> addNotification({
    required String title,
    required String message,
    required String type, // 'approved', 'rejected', 'LEAVE_REQUEST', etc.
    String? targetId,
    VoidCallback? onView,
  }) async {
    // Avoid exact duplicate notification within the last 60 minutes
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

    // Trigger phone top notification bar (native drawer)
    LocalNotificationService().showPushNotification(
      title: title,
      body: message,
      payload: targetId ?? item.id,
      type: type,
    );
  }

  void showHeadsUpNotification(AppNotificationItem item, {VoidCallback? onView}) {
    final typeLower = item.type.toLowerCase();
    final isApproved = typeLower == 'approved' || typeLower == 'leave_approved';
    final isRejected = typeLower == 'rejected' || typeLower == 'leave_rejected';
    final isRequest = typeLower == 'leave_request';
    final isDeleted = typeLower == 'leave_deleted' || typeLower == 'leave_cancelled';

    final isAnnouncement = typeLower == 'announcement';
    final isUrgent = typeLower == 'urgent';
    final isEvent = typeLower == 'event';
    final isReminder = typeLower == 'reminder';

    Color bgColor = const Color(0xFF3B82F6); // Blue default
    IconData iconData = LucideIcons.bellRing;

    if (isApproved) {
      bgColor = const Color(0xFF059669); // Emerald
      iconData = LucideIcons.checkCheck;
    } else if (isRejected || isUrgent) {
      bgColor = const Color(0xFFDC2626); // Red
      iconData = isUrgent ? LucideIcons.circleAlert : LucideIcons.x;
    } else if (isEvent) {
      bgColor = const Color(0xFF9333EA); // Purple
      iconData = LucideIcons.partyPopper;
    } else if (isReminder) {
      bgColor = const Color(0xFFD97706); // Amber
      iconData = LucideIcons.clock;
    } else if (isAnnouncement) {
      bgColor = const Color(0xFF2563EB); // Royal Blue
      iconData = LucideIcons.megaphone;
    } else if (isRequest) {
      bgColor = const Color(0xFF2563EB); // Blue
      iconData = LucideIcons.fileText;
    } else if (isDeleted) {
      bgColor = const Color(0xFFE11D48); // Rose
      iconData = LucideIcons.trash2;
    }

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
          iconData,
          color: Colors.white,
          size: 22,
        ),
      ),
      snackPosition: SnackPosition.TOP,
      backgroundColor: bgColor,
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
          color: bgColor.withValues(alpha: 0.4),
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
          markAsRead(item.id);
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

  void markAsRead(String id) {
    final index = notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      notifications[index].isRead = true;
      notifications.refresh();
      _saveNotifications();
    }

    try {
      if (_apiClient != null) {
        _apiClient!.put('/notifications/$id/read', body: {});
      }
    } catch (_) {}
  }

  void markAllAsRead() {
    for (var n in notifications) {
      n.isRead = true;
    }
    notifications.refresh();
    _saveNotifications();

    try {
      if (_apiClient != null) {
        _apiClient!.put('/notifications/read-all', body: {});
      }
    } catch (_) {}
  }

  void clearAll() {
    notifications.clear();
    _saveNotifications();

    try {
      if (_apiClient != null) {
        _apiClient!.delete('/notifications/clear-all');
      }
    } catch (_) {}
  }
}
