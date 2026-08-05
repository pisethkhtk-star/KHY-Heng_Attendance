import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../core/constants/app_colors.dart';

class StatRingChart extends StatelessWidget {
  final int present;
  final int lateDays;
  final int leave;
  final int absent;

  const StatRingChart({
    super.key,
    required this.present,
    required this.lateDays,
    required this.leave,
    required this.absent,
  });

  @override
  Widget build(BuildContext context) {
    final total = (present + lateDays + leave + absent).toDouble();
    if (total == 0) return const SizedBox.shrink();

    return SizedBox(
      height: 140,
      width: 140,
      child: Stack(
        alignment: Alignment.center,
        children: [
          PieChart(
            PieChartData(
              sectionsSpace: 3,
              centerSpaceRadius: 45,
              sections: [
                PieChartSectionData(
                  color: AppColors.success,
                  value: present.toDouble(),
                  title: '',
                  radius: 14,
                ),
                PieChartSectionData(
                  color: AppColors.warning,
                  value: lateDays.toDouble(),
                  title: '',
                  radius: 14,
                ),
                PieChartSectionData(
                  color: AppColors.info,
                  value: leave.toDouble(),
                  title: '',
                  radius: 14,
                ),
                if (absent > 0)
                  PieChartSectionData(
                    color: AppColors.danger,
                    value: absent.toDouble(),
                    title: '',
                    radius: 14,
                  ),
              ],
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${((present / total) * 100).round()}%',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text(
                'On Time',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
