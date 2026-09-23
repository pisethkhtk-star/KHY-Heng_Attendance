import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart' hide Response;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import '../../controllers/notification_controller.dart';
import '../../firebase_options.dart';
import '../constants/api_config.dart';
import 'local_notification_service.dart';

/// Top-level background execution handler for Firebase Cloud Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    WidgetsFlutterBinding.ensureInitialized();
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

    debugPrint('[FCM Background] Message received: ${message.messageId}');
    final notification = message.notification;
    final data = message.data;

    final String title = notification?.title ?? data['title'] ?? 'HR chomnan Notification';
    final String body = notification?.body ?? data['body'] ?? data['message'] ?? '';
    final String type = data['type'] ?? 'ANNOUNCEMENT';

    // If message contains a notification payload, the OS displays it automatically in the status bar.
    // We only trigger local notification manually if it's a data-only payload to avoid duplicate alerts.
    if (notification == null && (title.isNotEmpty || body.isNotEmpty)) {
      await LocalNotificationService().showPushNotification(
        title: title,
        body: body,
        payload: data['targetId'] ?? data['id'],
        type: type,
      );
    }
  } catch (e) {
    debugPrint('[FCM Background Error]: $e');
  }
}

/// Top-level Workmanager background task dispatcher for periodic background sync
@pragma('vm:entry-point')
void workmanagerCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      debugPrint('[WorkManager Background Task] Running task: $task');
      WidgetsFlutterBinding.ensureInitialized();
      await LocalNotificationService().init();

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      String workingBaseUrl = prefs.getString('working_base_url') ?? ApiConfig.baseUrl;

      if (token != null && token.isNotEmpty) {
        String cleanBase = workingBaseUrl.trim();
        if (cleanBase.endsWith('/')) {
          cleanBase = cleanBase.substring(0, cleanBase.length - 1);
        }
        if (!cleanBase.endsWith('/api')) {
          cleanBase = '$cleanBase/api';
        }

        final dio = Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        ));

        // Candidate URLs to guarantee connection across environments
        final List<String> candidateUrls = [
          '$cleanBase/notifications',
          if (cleanBase != ApiConfig.baseUrl) '${ApiConfig.baseUrl}/notifications',
          'http://10.10.1.186:8080/api/notifications',
          'http://192.168.88.133:8080/api/notifications',
        ];

        Response? response;
        for (final url in candidateUrls) {
          try {
            final res = await dio.get(url);
            if (res.statusCode == 200) {
              response = res;
              // Remember working base url
              final newBase = url.replaceAll('/notifications', '');
              await prefs.setString('working_base_url', newBase);
              break;
            }
          } catch (_) {}
        }

        if (response != null && response.statusCode == 200 && response.data is List) {
          final List<dynamic> list = response.data;
          final seenIds = prefs.getStringList('seen_notification_ids') ?? [];
          final updatedSeenIds = List<String>.from(seenIds);
          int newPushedCount = 0;

          for (final item in list) {
            final String id = item['id']?.toString() ?? '';
            final bool isRead = item['isRead'] == true;

            // Trigger notification bar alert if unread and not shown yet
            if (!isRead && !seenIds.contains(id)) {
              updatedSeenIds.add(id);
              final String title = item['title']?.toString() ?? 'HR chomnan';
              final String body = item['message']?.toString() ?? '';
              final String type = item['type']?.toString() ?? 'GENERAL';

              await LocalNotificationService().showPushNotification(
                title: title,
                body: body,
                payload: item['targetId']?.toString() ?? id,
                type: type,
              );
              newPushedCount++;
              debugPrint('[WorkManager Background] Pushed notification to phone bar: $title');
            }
          }
          await prefs.setStringList('seen_notification_ids', updatedSeenIds);
          debugPrint('[WorkManager Background] Sync complete. Pushed $newPushedCount new notifications.');
        }
      }

      return Future.value(true);
    } catch (e) {
      debugPrint('[WorkManager Background Error]: $e');
      return Future.value(true);
    }
  });
}

class BackgroundNotificationService {
  static final BackgroundNotificationService _instance = BackgroundNotificationService._internal();
  factory BackgroundNotificationService() => _instance;
  BackgroundNotificationService._internal();

  FirebaseMessaging? _fcm;
  bool _isInitialized = false;

  FirebaseMessaging? get fcm {
    try {
      _fcm ??= FirebaseMessaging.instance;
      return _fcm;
    } catch (e) {
      debugPrint('[BackgroundNotificationService Warning] FirebaseMessaging.instance: $e');
      return null;
    }
  }

  Future<void> init() async {
    if (_isInitialized) return;

    try {
      // 1. Set top-level FCM background handler
      try {
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      } catch (bgError) {
        debugPrint('[BackgroundNotificationService] onBackgroundMessage warning: $bgError');
      }

      final messaging = fcm;
      if (messaging == null) {
        debugPrint('[BackgroundNotificationService] FirebaseMessaging not available, skipping FCM setup');
        return;
      }

      // 2. Request FCM permissions (Alert, Badge, Sound)
      try {
        final settings = await messaging.requestPermission(
          alert: true,
          announcement: false,
          badge: true,
          carPlay: false,
          criticalAlert: false,
          provisional: false,
          sound: true,
        );
        debugPrint('[BackgroundNotificationService] FCM permission status: ${settings.authorizationStatus}');
      } catch (permError) {
        debugPrint('[BackgroundNotificationService] requestPermission warning: $permError');
      }

      // 3. Foreground message listener -> push to system notification bar
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[FCM Foreground] Received message: ${message.messageId}');
        final notification = message.notification;
        final data = message.data;

        final String title = notification?.title ?? data['title'] ?? 'HR chomnan';
        final String body = notification?.body ?? data['body'] ?? data['message'] ?? '';
        final String type = data['type'] ?? 'GENERAL';

        // Show on phone notification bar
        LocalNotificationService().showPushNotification(
          title: title,
          body: body,
          payload: data['targetId'] ?? data['id'],
          type: type,
        );

        // Update in-app notifications if controller is alive
        if (Get.isRegistered<NotificationController>()) {
          Get.find<NotificationController>().fetchRemoteNotifications();
        }
      });

      // 4. Handle notification tap when app opened from background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[FCM Tap] App opened from notification: ${message.data}');
        if (Get.isRegistered<NotificationController>()) {
          Get.find<NotificationController>().fetchRemoteNotifications();
        }
      });

      // 5. Subscribe to default topic for company-wide notifications with timeout
      try {
        await messaging.subscribeToTopic('all_employees').timeout(const Duration(seconds: 4));
      } catch (topicError) {
        debugPrint('[BackgroundNotificationService] subscribeToTopic all_employees warning: $topicError');
      }

      // 6. Cancel legacy WorkManager tasks to prevent Out of Memory (FCM handles background alerts natively)
      try {
        await Workmanager().cancelAll();
      } catch (wmError) {
        debugPrint('[BackgroundNotificationService] WorkManager cancel warning: $wmError');
      }

      _isInitialized = true;
      debugPrint('[BackgroundNotificationService] Initialized successfully for background push!');
    } catch (e) {
      debugPrint('[BackgroundNotificationService Error] init: $e');
    }
  }

  /// Register background periodic sync with Android WorkManager
  Future<void> registerPeriodicSync() async {
    // Kept for backward compatibility, no-op since FCM handles real-time push
  }

  /// Trigger immediate background sync via Workmanager when app is paused/backgrounded
  Future<void> triggerImmediateBackgroundSync() async {
    // Kept for backward compatibility, no-op since FCM handles real-time push
  }

  /// Subscribe logged in employee to targeted topics
  Future<void> subscribeUserTopics({required String staffId, String? departmentId}) async {
    try {
      final messaging = fcm;
      if (messaging == null) return;

      final cleanStaffId = staffId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      try {
        await messaging.subscribeToTopic('staff_$cleanStaffId').timeout(const Duration(seconds: 4));
      } catch (_) {}

      if (departmentId != null && departmentId.isNotEmpty) {
        final cleanDeptId = departmentId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
        try {
          await messaging.subscribeToTopic('dept_$cleanDeptId').timeout(const Duration(seconds: 4));
        } catch (_) {}
      }

      try {
        final fcmToken = await messaging.getToken().timeout(const Duration(seconds: 4));
        if (fcmToken != null && fcmToken.isNotEmpty) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('fcm_device_token', fcmToken);
          debugPrint('[BackgroundNotificationService] FCM Token registered: $fcmToken');
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('[BackgroundNotificationService] subscribeUserTopics error: $e');
    }
  }
}
