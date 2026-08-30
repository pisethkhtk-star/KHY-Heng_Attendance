import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
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
  String _durationMode = 'half'; // 'half' (0.5 Day), 'full' (1 Day), 'multiple' (Multiple Days)
  String _halfDaySession = 'Morning'; // 'Morning' or 'Afternoon'
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final TextEditingController _reasonController = TextEditingController();
  String? _reasonError;

  final List<String> _leaveTypes = ['Annual Leave', 'Sick Leave', 'Unpaid Leave', 'Special Leave'];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  double get _calculatedDays {
    if (_durationMode == 'half') return 0.5;
    if (_durationMode == 'full') return 1.0;
    return (_endDate.difference(_startDate).inDays + 1).toDouble();
  }

  String get _calculatedDurationType {
    if (_durationMode == 'half') return _halfDaySession;
    if (_durationMode == 'full') return 'Full Day';
    return 'Multiple Days';
  }

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
            const SizedBox(height: 18),
            
            // Leave Type Dropdown
            Obx(() => Text(langController.tr('leave_type'), style: const TextStyle(fontWeight: FontWeight.w600))),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _selectedType,
              decoration: InputDecoration(
                fillColor: isDark ? AppColors.cardDark : Colors.grey.shade100,
                filled: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
              ),
              items: _leaveTypes.map((type) {
                return DropdownMenuItem(value: type, child: Text(type));
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedType = val);
              },
            ),
            const SizedBox(height: 16),

            // Duration Type Selector (0.5 Day, 1 Day, Multiple Days)
            Obx(() => Text(langController.tr('leave_duration'), style: const TextStyle(fontWeight: FontWeight.w600))),
            const SizedBox(height: 8),
            Obx(() => Row(
              children: [
                Expanded(
                  child: _buildDurationOption(
                    label: langController.tr('half_day'),
                    mode: 'half',
                    isDark: isDark,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildDurationOption(
                    label: langController.tr('full_day'),
                    mode: 'full',
                    isDark: isDark,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildDurationOption(
                    label: langController.tr('multiple_days'),
                    mode: 'multiple',
                    isDark: isDark,
                  ),
                ),
              ],
            )),
            const SizedBox(height: 14),

            // Half-Day Session Choice (Morning / Afternoon)
            if (_durationMode == 'half') ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Obx(() => Text(
                      langController.tr('select_shift'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primary),
                    )),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _halfDaySession = 'Morning'),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                              decoration: BoxDecoration(
                                color: _halfDaySession == 'Morning' ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: _halfDaySession == 'Morning' ? AppColors.primary : Colors.grey.shade400,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    LucideIcons.sun,
                                    size: 16,
                                    color: _halfDaySession == 'Morning' ? Colors.white : AppColors.primary,
                                  ),
                                  const SizedBox(width: 6),
                                  Obx(() => Text(
                                    langController.tr('shift_1'),
                                    style: TextStyle(
                                      color: _halfDaySession == 'Morning' ? Colors.white : (isDark ? Colors.white : Colors.black87),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  )),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _halfDaySession = 'Afternoon'),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                              decoration: BoxDecoration(
                                color: _halfDaySession == 'Afternoon' ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: _halfDaySession == 'Afternoon' ? AppColors.primary : Colors.grey.shade400,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    LucideIcons.sunset,
                                    size: 16,
                                    color: _halfDaySession == 'Afternoon' ? Colors.white : AppColors.primary,
                                  ),
                                  const SizedBox(width: 6),
                                  Obx(() => Text(
                                    langController.tr('shift_2'),
                                    style: TextStyle(
                                      color: _halfDaySession == 'Afternoon' ? Colors.white : (isDark ? Colors.white : Colors.black87),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  )),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Date Picker Section
            if (_durationMode == 'multiple') ...[
              // Date Range Row
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
              // Single Date Picker (for 0.5 day or 1 day)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Obx(() => Text(langController.tr('leave_date'), style: const TextStyle(fontWeight: FontWeight.w600))),
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
            const SizedBox(height: 12),

            // Summary Information Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.info, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Obx(() {
                      final isKm = langController.currentLanguage == 'km';
                      final sessionLabel = _halfDaySession == 'Morning' ? langController.tr('shift_1') : langController.tr('shift_2');
                      final durationText = _durationMode == 'half'
                          ? (isKm ? 'រយៈពេលស្នើសុំ៖ ០.៥ ថ្ងៃ ($sessionLabel)' : 'Requested Duration: 0.5 Day ($sessionLabel)')
                          : _durationMode == 'full'
                              ? (isKm ? 'រយៈពេលស្នើសុំ៖ ១ ថ្ងៃ' : 'Requested Duration: 1 Day')
                              : (isKm ? 'រយៈពេលស្នើសុំ៖ ${_calculatedDays.toInt()} ថ្ងៃ' : 'Requested Duration: ${_calculatedDays.toInt()} Days');

                      return Text(
                        durationText,
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12),
                      );
                    }),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Reason field
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
                    ? 'សូមបញ្ជាក់មូលហេតុនៃការសុំច្បាប់...'
                    : 'Please enter reason / note...',
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
                  onPressed: leaveController.isSubmitting
                      ? null
                      : () async {
                          final reasonText = _reasonController.text.trim();
                          if (reasonText.isEmpty) {
                            setState(() {
                              _reasonError = langController.tr('reason_required');
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(langController.tr('reason_required')),
                                backgroundColor: AppColors.danger,
                              ),
                            );
                            return;
                          }

                          final user = Get.find<AuthController>().user;
                          final navigator = Navigator.of(context);
                          final messenger = ScaffoldMessenger.of(context);

                          final formattedStart = DateFormat('yyyy-MM-dd').format(_startDate);
                          final formattedEnd = _durationMode == 'multiple'
                              ? DateFormat('yyyy-MM-dd').format(_endDate)
                              : formattedStart;

                          final success = await leaveController.submitLeave(
                            type: _selectedType,
                            startDate: formattedStart,
                            endDate: formattedEnd,
                            days: _calculatedDays,
                            durationType: _calculatedDurationType,
                            reason: reasonText,
                            staffId: user?.employeeId,
                          );
                          if (success) {
                            navigator.pop();
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Leave request submitted and attendance updated successfully!'),
                                backgroundColor: AppColors.success,
                              ),
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

  Widget _buildDurationOption({required String label, required String mode, required bool isDark}) {
    final isSelected = _durationMode == mode;
    return InkWell(
      onTap: () {
        setState(() {
          _durationMode = mode;
          if (mode != 'multiple') {
            _endDate = _startDate;
          }
        });
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
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
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ),
      ),
    );
  }
}
