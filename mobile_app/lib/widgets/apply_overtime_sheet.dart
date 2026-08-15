import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/language_controller.dart';
import '../controllers/overtime_controller.dart';
import '../controllers/auth_controller.dart';

class ApplyOvertimeSheet extends StatefulWidget {
  const ApplyOvertimeSheet({super.key});

  @override
  State<ApplyOvertimeSheet> createState() => _ApplyOvertimeSheetState();
}

class _ApplyOvertimeSheetState extends State<ApplyOvertimeSheet> {
  String _dateMode = 'single'; // 'single' (1 Day), 'multiple' (Multiple Days)
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();

  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 30);
  TimeOfDay _endTime = const TimeOfDay(hour: 20, minute: 30);

  final TextEditingController _reasonController = TextEditingController();
  String? _reasonError;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  // Calculate duration in hours
  double get _hoursPerDay {
    final startMinutes = _startTime.hour * 60 + _startTime.minute;
    final endMinutes = _endTime.hour * 60 + _endTime.minute;
    int diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight overtime
    return diffMinutes / 60.0;
  }

  // Calculate days difference
  int get _dayCount {
    if (_dateMode == 'single') return 1;
    final startD = DateTime(_startDate.year, _startDate.month, _startDate.day);
    final endD = DateTime(_endDate.year, _endDate.month, _endDate.day);
    return endD.difference(startD).inDays + 1;
  }

  // Calculate total amount_day (8h = 1 standard day)
  double get _calculatedAmountDay {
    final dayFraction = _hoursPerDay / 8.0;
    return double.parse((_dayCount * dayFraction).toStringAsFixed(2));
  }

  String _formatTimeOfDay(TimeOfDay time) {
    final hourStr = time.hour.toString().padLeft(2, '0');
    final minStr = time.minute.toString().padLeft(2, '0');
    return '$hourStr:$minStr';
  }

  Future<void> _pickTime(bool isStart) async {
    final initial = isStart ? _startTime : _endTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
          child: child ?? const SizedBox(),
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final overtimeController = Get.find<OvertimeController>();
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
            // Top Handle Bar
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

            // Title
            Obx(() => Text(
              langController.tr('request_overtime'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            )),
            const SizedBox(height: 18),

            // Mode Selector (1 Day vs Multiple Days)
            Obx(() => Text(langController.tr('ot_duration'), style: const TextStyle(fontWeight: FontWeight.w600))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildOptionTab(
                    label: langController.tr('full_day'),
                    isSelected: _dateMode == 'single',
                    onTap: () => setState(() {
                      _dateMode = 'single';
                      _endDate = _startDate;
                    }),
                    isDark: isDark,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildOptionTab(
                    label: langController.tr('multiple_days'),
                    isSelected: _dateMode == 'multiple',
                    onTap: () => setState(() => _dateMode = 'multiple'),
                    isDark: isDark,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Date Selection Section
            if (_dateMode == 'multiple') ...[
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Obx(() => Text(langController.tr('from_date'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: _startDate,
                              firstDate: DateTime(2025),
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
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(LucideIcons.calendar, size: 16, color: AppColors.primary),
                                const SizedBox(width: 8),
                                Text(DateFormat('yyyy-MM-dd').format(_startDate)),
                              ],
                            ),
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
                        Obx(() => Text(langController.tr('to_date'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
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
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(LucideIcons.calendar, size: 16, color: AppColors.primary),
                                const SizedBox(width: 8),
                                Text(DateFormat('yyyy-MM-dd').format(_endDate)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ] else ...[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Obx(() => Text(langController.tr('from_date'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _startDate,
                        firstDate: DateTime(2025),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (picked != null) {
                        setState(() {
                          _startDate = picked;
                          _endDate = picked;
                        });
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade400),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.calendar, size: 16, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Text(DateFormat('yyyy-MM-dd (EEEE)').format(_startDate)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),

            // Time Selection: Start Time & End Time
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Obx(() => Text(langController.tr('start_time'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () => _pickTime(true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.clock, size: 16, color: AppColors.warning),
                              const SizedBox(width: 8),
                              Text(
                                _formatTimeOfDay(_startTime),
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
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
                      Obx(() => Text(langController.tr('end_time'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () => _pickTime(false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.clock, size: 16, color: AppColors.primary),
                              const SizedBox(width: 8),
                              Text(
                                _formatTimeOfDay(_endTime),
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Overtime Duration Info Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.info, size: 18, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_hoursPerDay.toStringAsFixed(1)} hours/day × $_dayCount day${_dayCount > 1 ? "s" : ""}',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Amount Day: $_calculatedAmountDay day${_calculatedAmountDay > 1 ? "s" : ""}',
                          style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Mandatory Reason / Note Field
            Row(
              children: [
                Obx(() => Text(langController.tr('reason'), style: const TextStyle(fontWeight: FontWeight.w600))),
                const SizedBox(width: 4),
                const Text('*', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              onChanged: (val) {
                if (_reasonError != null && val.trim().isNotEmpty) {
                  setState(() => _reasonError = null);
                }
              },
              decoration: InputDecoration(
                hintText: langController.currentLanguage == 'km'
                    ? 'សូមបញ្ជាក់មូលហេតុនៃការថែមម៉ោង...'
                    : 'Please enter reason for overtime...',
                errorText: _reasonError,
                fillColor: isDark ? AppColors.cardDark : Colors.grey.shade100,
                filled: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: _reasonError != null ? Colors.red : Colors.grey.shade300,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: _reasonError != null ? Colors.red : Colors.grey.shade300,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: _reasonError != null ? Colors.red : AppColors.primary,
                    width: 1.5,
                  ),
                ),
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
                  onPressed: overtimeController.isSubmitting
                      ? null
                      : () async {
                          final reasonText = _reasonController.text.trim();
                          if (reasonText.isEmpty) {
                            setState(() {
                              _reasonError = langController.tr('ot_reason_required');
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(langController.tr('ot_reason_required')),
                                backgroundColor: AppColors.danger,
                              ),
                            );
                            return;
                          }

                          final user = Get.find<AuthController>().user;
                          final navigator = Navigator.of(context);
                          final messenger = ScaffoldMessenger.of(context);

                          final formattedStart = DateFormat('yyyy-MM-dd').format(_startDate);
                          final formattedEnd = _dateMode == 'multiple'
                              ? DateFormat('yyyy-MM-dd').format(_endDate)
                              : formattedStart;

                          final success = await overtimeController.submitOvertime(
                            fromDate: formattedStart,
                            toDate: formattedEnd,
                            startTime: _formatTimeOfDay(_startTime),
                            endTime: _formatTimeOfDay(_endTime),
                            amountDay: _calculatedAmountDay,
                            reason: reasonText,
                            staffId: user?.employeeId,
                          );

                          if (success) {
                            navigator.pop();
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Overtime request submitted successfully!'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          }
                        },
                  child: overtimeController.isSubmitting
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

  Widget _buildOptionTab({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : (isDark ? AppColors.cardDark : Colors.grey.shade100),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.grey.shade300,
          ),
        ),
        child: Center(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ),
      ),
    );
  }
}
