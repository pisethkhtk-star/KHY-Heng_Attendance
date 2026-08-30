import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/language_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/leave_controller.dart';
import '../controllers/overtime_controller.dart';
import '../controllers/notification_controller.dart';
import '../widgets/notifications_sheet.dart';
import 'home_screen.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';
import 'profile_screen.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _syncRealtimeDatabase();
    });
  }

  void _syncRealtimeDatabase() {
    final auth = Get.find<AuthController>();
    final user = auth.user;
    auth.checkSavedSession();

    if (user != null) {
      Get.find<AttendanceController>().fetchRemoteHistory(staffId: user.employeeId);
      Get.find<LeaveController>().fetchRemoteLeaves(staffId: user.employeeId);
      Get.find<OvertimeController>().fetchRemoteOvertimes(staffId: user.employeeId);
    }
  }

  void _changeTab(int index) {
    setState(() => _currentIndex = index);
    if (index == 2) {
      final user = Get.find<AuthController>().user;
      Get.find<LeaveController>().fetchRemoteLeaves(staffId: user?.employeeId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final notifController = Get.find<NotificationController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final List<Widget> pages = [
      HomeScreen(onTabSelected: _changeTab),
      const AttendanceScreen(),
      const LeaveScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.asset(
                'assets/icon/app_icon.png',
                width: 24,
                height: 24,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 10),
            Obx(() => Text(langController.tr('app_title'))),
          ],
        ),
        actions: [
          // Notification Bell with Unread Badge
          Obx(() {
            final unread = notifController.unreadCount;
            return Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(LucideIcons.bell, size: 21),
                  tooltip: 'Notifications',
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => NotificationsSheet(
                        onNavigateToLeave: () => _changeTab(2),
                      ),
                    );
                  },
                ),
                if (unread > 0)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        unread > 9 ? '9+' : '$unread',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            );
          }),
          Obx(
            () => IconButton(
              icon: Icon(
                langController.currentLanguage == 'km' ? LucideIcons.languages : LucideIcons.globe,
                size: 22,
              ),
              onPressed: () {
                final newLang = langController.currentLanguage == 'km' ? 'en' : 'km';
                langController.setLanguage(newLang);
              },
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : AppColors.cardLight,
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
              width: 1,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Obx(
          () => BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: _changeTab,
            type: BottomNavigationBarType.fixed,
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            unselectedLabelStyle: const TextStyle(fontSize: 12),
            items: [
              BottomNavigationBarItem(
                icon: const Icon(LucideIcons.home),
                activeIcon: const Icon(LucideIcons.home, color: AppColors.primary),
                label: langController.tr('home'),
              ),
              BottomNavigationBarItem(
                icon: const Icon(LucideIcons.clock),
                activeIcon: const Icon(LucideIcons.clock, color: AppColors.primary),
                label: langController.tr('history'),
              ),
              BottomNavigationBarItem(
                icon: const Icon(LucideIcons.calendarDays),
                activeIcon: const Icon(LucideIcons.calendarDays, color: AppColors.primary),
                label: langController.tr('leave'),
              ),
              BottomNavigationBarItem(
                icon: const Icon(LucideIcons.user),
                activeIcon: const Icon(LucideIcons.user, color: AppColors.primary),
                label: langController.tr('profile'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
