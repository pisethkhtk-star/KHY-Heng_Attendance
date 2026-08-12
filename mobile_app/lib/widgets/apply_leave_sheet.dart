import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../core/constants/app_colors.dart';
import '../controllers/language_controller.dart';
import '../controllers/leave_controller.dart';
import '../controllers/auth_controller.dart';

class ApplyLeaveSheet extends StatefulWidget {
  const ApplyLeaveSheet({super.key});

  @override
  State<ApplyLeaveSheet> createState() => _ApplyLeaveSheetState();
}

class _ApplyLeaveSheetState extends State<ApplyLeaveSheet> {
  String _selectedType = 'Annual Leave';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  final TextEditingController _reasonController = TextEditingController();

  final List<String> _leaveTypes = ['Annual Leave', 'Sick Leave', 'Unpaid Leave', 'Special Leave'];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  int get _calculatedDays => _endDate.difference(_startDate).inDays + 1;

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final leaveController = Get.find<LeaveController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Obx(() => Text(
              langController.tr('request_leave'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            )),
            const SizedBox(height: 20),
            
            // Leave Type Dropdown
            Obx(() => Text(langController.tr('leave_type'), style: const TextStyle(fontWeight: FontWeight.w600))),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _selectedType,
              decoration: InputDecoration(
                fillColor: isDark ? AppColors.cardDark : Colors.grey.shade100,
                filled: true,
              ),
              items: _leaveTypes.map((type) {
                return DropdownMenuItem(value: type, child: Text(type));
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedType = val);
              },
            ),
            const SizedBox(height: 16),

            // Date Pickers Row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Obx(() => Text(langController.tr('start_date'), style: const TextStyle(fontWeight: FontWeight.w600))),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _startDate,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setState(() {
                              _startDate = picked;
                              if (_endDate.isBefore(_startDate)) _endDate = _startDate;
                            });
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(DateFormat('yyyy-MM-dd').format(_startDate)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Obx(() => Text(langController.tr('end_date'), style: const TextStyle(fontWeight: FontWeight.w600))),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _endDate,
                            firstDate: _startDate,
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setState(() => _endDate = picked);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(DateFormat('yyyy-MM-dd').format(_endDate)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Total Requested Duration: $_calculatedDays day(s)',
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),

            // Reason field
            Obx(() => Text(langController.tr('reason'), style: const TextStyle(fontWeight: FontWeight.w600))),
            const SizedBox(height: 8),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Describe the reason for your leave request...',
                fillColor: isDark ? AppColors.cardDark : Colors.grey.shade100,
                filled: true,
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: Obx(
                () => ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: leaveController.isSubmitting
                      ? null
                      : () async {
                          final user = Get.find<AuthController>().user;
                          final navigator = Navigator.of(context);
                          final messenger = ScaffoldMessenger.of(context);
                          final success = await leaveController.submitLeave(
                            type: _selectedType,
                            startDate: DateFormat('yyyy-MM-dd').format(_startDate),
                            endDate: DateFormat('yyyy-MM-dd').format(_endDate),
                            days: _calculatedDays,
                            reason: _reasonController.text.isEmpty ? 'Leave application' : _reasonController.text,
                            staffId: user?.employeeId,
                          );
                          if (success) {
                            navigator.pop();
                            messenger.showSnackBar(
                              const SnackBar(content: Text('Leave request submitted successfully!')),
                            );
                          }
                        },
                  child: leaveController.isSubmitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(langController.tr('submit'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
