import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String label;

  const StatusBadge({
    super.key,
    required this.status,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;

    switch (status.toLowerCase()) {
      case 'present':
      case 'approved':
      case 'checked_in':
        bg = AppColors.successBg;
        fg = AppColors.success;
        break;
      case 'late':
      case 'pending':
        bg = AppColors.warningBg;
        fg = AppColors.warning;
        break;
      case 'absent':
      case 'rejected':
        bg = AppColors.dangerBg;
        fg = AppColors.danger;
        break;
      case 'on leave':
      case 'leave':
        bg = AppColors.infoBg;
        fg = AppColors.info;
        break;
      case 'incomplete':
      case 'incomplete shift':
      case 'miss':
        bg = AppColors.warningBg;
        fg = AppColors.warning;
        break;
      default:
        bg = Colors.grey.shade200;
        fg = Colors.grey.shade700;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
