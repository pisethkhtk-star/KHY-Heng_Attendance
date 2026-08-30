import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import 'scanner_modal_sheet.dart';
import 'face_scan_modal_sheet.dart';
import 'face_enroll_modal_sheet.dart';

class CheckinOnBehalfSheet extends StatefulWidget {
  const CheckinOnBehalfSheet({super.key});

  @override
  State<CheckinOnBehalfSheet> createState() => _CheckinOnBehalfSheetState();
}

class _CheckinOnBehalfSheetState extends State<CheckinOnBehalfSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _noteCtrl = TextEditingController();

  Map<String, dynamic>? _selectedEmployee;
  String _selectedAction = 'checkin_1';
  bool _isLoading = false;

  final List<Map<String, String>> _actions = [
    {'key': 'checkin_1', 'label': 'Check-in 1', 'shift': 'Shift 1'},
    {'key': 'checkout_1', 'label': 'Check-out 1', 'shift': 'Shift 1'},
    {'key': 'checkin_2', 'label': 'Check-in 2', 'shift': 'Shift 2'},
    {'key': 'checkout_2', 'label': 'Check-out 2', 'shift': 'Shift 2'},
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  ImageProvider? _getAvatarImage(String? avatarUrl) {
    if (avatarUrl == null || avatarUrl.trim().isEmpty) return null;
    try {
      if (avatarUrl.startsWith('data:image') && avatarUrl.contains('base64,')) {
        final base64String = avatarUrl.split('base64,')[1].trim();
        return MemoryImage(base64Decode(base64String));
      }
      if (avatarUrl.startsWith('http')) {
        return NetworkImage(avatarUrl);
      }
      return MemoryImage(base64Decode(avatarUrl.trim()));
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleSubmit() async {
    final attendanceController = Get.find<AttendanceController>();

    if (_selectedEmployee == null) {
      Get.snackbar(
        'Required',
        'Please select an employee first',
        snackPosition: SnackPosition.TOP,
        backgroundColor: Colors.amber.shade700,
        colorText: Colors.white,
        margin: const EdgeInsets.all(16),
      );
      return;
    }

    final targetStaffId = _selectedEmployee!['staffId']?.toString() ?? '';
    final targetName = _selectedEmployee!['fullName']?.toString() ?? targetStaffId;

    setState(() => _isLoading = true);

    // 1. Fetch the employee's registered face data
    final faceData = await attendanceController.fetchEmployeeFaceData(targetStaffId);

    if (mounted) setState(() => _isLoading = false);

    if (faceData == null ||
        (faceData['faceDescriptor'] == null && faceData['photoUrl'] == null)) {
      _showNoFaceDataDialog(targetName, targetStaffId);
      return;
    }

    final currentUser = Get.find<AuthController>().user;
    final note = _noteCtrl.text.trim().isNotEmpty
        ? _noteCtrl.text.trim()
        : 'Check-in on behalf with Face Scan by ${currentUser?.name ?? "Authorized Employee"}';

    // 2. Open Face Scanner Camera Modal to scan and compare face before inserting attendance
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FaceScanModalSheet(
        targetEmployee: _selectedEmployee!,
        selectedAction: _selectedAction,
        note: note,
        faceData: faceData,
        onSuccess: () {
          if (mounted) Navigator.of(context).pop();
        },
      ),
    );
  }

  void _showNoFaceDataDialog(String name, String staffId) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.scanFace, color: AppColors.warning, size: 22),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'មិនទាន់មានទិន្នន័យផ្ទៃមុខ',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'បុគ្គលិក $name (អត្តលេខ: $staffId) មិនទាន់បានចុះឈ្មោះស្កេនផ្ទៃមុខក្នុងប្រព័ន្ធនៅឡើយទេ។',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 8),
            const Text(
              'សូមធ្វើការចុះឈ្មោះផ្ទៃមុខ (Face Enrollment) របស់បុគ្គលិកនេះតាមរយៈប្រព័ន្ធគ្រប់គ្រងជាមុនសិន ទើបអាចស្កេនកត់វត្តមានជំនួសបាន។',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('បោះបង់ (Cancel)'),
          ),
          if (Get.find<AuthController>().user?.isAdmin == true)
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(LucideIcons.camera, size: 16),
              label: const Text(
                'ចុះឈ្មោះផ្ទៃមុខឥឡូវនេះ',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              onPressed: () {
                Navigator.of(ctx).pop();
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => FaceEnrollModalSheet(
                    initialEmployee: _selectedEmployee,
                    onSuccess: () {
                      Get.snackbar(
                        'ជោគជ័យ',
                        'បានចុះឈ្មោះផ្ទៃមុខរួចរាល់! ឥឡូវនេះលោកអ្នកអាចស្កេនកត់វត្តមានបានហើយ។',
                        snackPosition: SnackPosition.TOP,
                        backgroundColor: AppColors.success,
                        colorText: Colors.white,
                        margin: const EdgeInsets.all(16),
                      );
                    },
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attendanceController = Get.find<AttendanceController>();
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final eligibleList = attendanceController.eligibleEmployees;
    final query = _searchCtrl.text.trim().toLowerCase();

    final filteredList = eligibleList.where((emp) {
      if (query.isEmpty) return true;
      final name = (emp['fullName'] ?? '').toString().toLowerCase();
      final staffId = (emp['staffId'] ?? '').toString().toLowerCase();
      final dept = (emp['department'] ?? '').toString().toLowerCase();
      return name.contains(query) || staffId.contains(query) || dept.contains(query);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
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
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(LucideIcons.userCheck, color: AppColors.success, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        langController.tr('check_on_behalf'),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Authorized Attendance Logging',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.qrCode, size: 22, color: AppColors.primary),
                  tooltip: 'Scan QR Code instead',
                  onPressed: () {
                    Navigator.of(context).pop();
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      builder: (_) => const ScannerModalSheet(),
                    );
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Step 1: Select Employee
                  Text(
                    langController.tr('select_employee'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 8),

                  // Search input
                  TextField(
                    controller: _searchCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search by name or Staff ID...',
                      prefixIcon: const Icon(LucideIcons.search, size: 18),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      filled: true,
                      fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Selected Employee Badge or List
                  if (_selectedEmployee != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.success),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundImage: _getAvatarImage(_selectedEmployee!['avatar']),
                            child: _selectedEmployee!['avatar'] == null
                                ? Text(
                                    (_selectedEmployee!['fullName'] ?? 'E')[0].toUpperCase(),
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  )
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _selectedEmployee!['fullName'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                Text(
                                  'ID: ${_selectedEmployee!['staffId']} • ${_selectedEmployee!['department']}',
                                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.x, size: 18, color: Colors.grey),
                            onPressed: () => setState(() => _selectedEmployee = null),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else ...[
                    // Horizontal / Compact List of Eligible Employees
                    Container(
                      constraints: const BoxConstraints(maxHeight: 180),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                      child: filteredList.isEmpty
                          ? const Center(
                              child: Padding(
                                padding: EdgeInsets.all(20.0),
                                child: Text('No eligible employees found', style: TextStyle(color: Colors.grey)),
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              itemCount: filteredList.length,
                              separatorBuilder: (_, _) => const Divider(height: 1),
                              itemBuilder: (context, idx) {
                                final emp = filteredList[idx];
                                return ListTile(
                                  dense: true,
                                  leading: CircleAvatar(
                                    radius: 16,
                                    backgroundImage: _getAvatarImage(emp['avatar']),
                                    child: emp['avatar'] == null
                                        ? Text(
                                            (emp['fullName'] ?? 'E')[0].toUpperCase(),
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                          )
                                        : null,
                                  ),
                                  title: Text(
                                    emp['fullName'] ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  subtitle: Text(
                                    '${emp['staffId']} • ${emp['department']}',
                                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                                  ),
                                  trailing: const Icon(LucideIcons.plusCircle, size: 18, color: AppColors.primary),
                                  onTap: () => setState(() => _selectedEmployee = emp),
                                );
                              },
                            ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Step 2: Select Action / Shift
                  Text(
                    langController.tr('checkin_action'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 10),

                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 2.2,
                    ),
                    itemCount: _actions.length,
                    itemBuilder: (context, idx) {
                      final item = _actions[idx];
                      final isSelected = _selectedAction == item['key'];
                      final isCheckIn = item['key']!.contains('checkin');

                      return InkWell(
                        onTap: () => setState(() => _selectedAction = item['key']!),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? (isCheckIn ? AppColors.success.withValues(alpha: 0.15) : AppColors.danger.withValues(alpha: 0.15))
                                : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey.shade100),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? (isCheckIn ? AppColors.success : AppColors.danger)
                                  : (isDark ? AppColors.borderDark : AppColors.borderLight),
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isCheckIn ? LucideIcons.logIn : LucideIcons.logOut,
                                size: 18,
                                color: isSelected
                                    ? (isCheckIn ? AppColors.success : AppColors.danger)
                                    : Colors.grey,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item['label']!,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: isSelected
                                            ? (isCheckIn ? AppColors.success : AppColors.danger)
                                            : (isDark ? Colors.white : Colors.black87),
                                      ),
                                    ),
                                    Text(
                                      item['shift']!,
                                      style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Optional Note
                  const Text(
                    'Note (Optional)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _noteCtrl,
                    decoration: InputDecoration(
                      hintText: 'e.g. Scanned on behalf by supervisor',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      filled: true,
                      fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Submit & Open Face Camera Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 2,
                      ),
                      onPressed: _isLoading ? null : _handleSubmit,
                      child: _isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(LucideIcons.scanFace, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  langController.tr('scan_face_to_checkin'),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
