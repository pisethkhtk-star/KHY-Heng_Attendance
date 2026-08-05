import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../providers/language_provider.dart';
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
  Widget build(BuildContext context) {
    final langProvider = Provider.of<LanguageProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final List<Widget> pages = [
      HomeScreen(onTabSelected: (index) => setState(() => _currentIndex = index)),
      const AttendanceScreen(),
      const LeaveScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.userCheck, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Text(langProvider.tr('app_title')),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              langProvider.currentLanguage == 'km' ? LucideIcons.languages : LucideIcons.globe,
              size: 22,
            ),
            onPressed: () {
              final newLang = langProvider.currentLanguage == 'km' ? 'en' : 'km';
              langProvider.setLanguage(newLang);
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: pages[_currentIndex],
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
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
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
              label: langProvider.tr('home'),
            ),
            BottomNavigationBarItem(
              icon: const Icon(LucideIcons.clock),
              activeIcon: const Icon(LucideIcons.clock, color: AppColors.primary),
              label: langProvider.tr('history'),
            ),
            BottomNavigationBarItem(
              icon: const Icon(LucideIcons.calendarDays),
              activeIcon: const Icon(LucideIcons.calendarDays, color: AppColors.primary),
              label: langProvider.tr('leave'),
            ),
            BottomNavigationBarItem(
              icon: const Icon(LucideIcons.user),
              activeIcon: const Icon(LucideIcons.user, color: AppColors.primary),
              label: langProvider.tr('profile'),
            ),
          ],
        ),
      ),
    );
  }
}
