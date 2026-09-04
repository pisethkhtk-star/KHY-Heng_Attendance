import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/controllers/attendance_controller.dart';
import 'package:mobile_app/models/attendance_model.dart';

void main() {
  group('Shift-Based Auto Action Logic for Face Scan in Check on Behalf (No Early Checkout)', () {
    const shift1End = '12:00';
    const shift2End = '17:00';

    AttendanceRecord createRecord({
      String? in1,
      String? out1,
      String? in2,
      String? out2,
    }) {
      return AttendanceRecord(
        id: '1',
        staffId: 'EMP001',
        employeeName: 'Test Staff',
        date: '2026-08-31',
        rawDate: '2026-08-31',
        checkIn1: in1,
        checkOut1: out1,
        checkIn2: in2,
        checkOut2: out2,
        status: 'Present',
        totalHours: '8h',
      );
    }

    test('Condition 1.1: currentTime < s1_end and check_in_1 is null -> CHECK_IN_1', () {
      final time = DateTime(2026, 8, 31, 8, 30); // 08:30 < 12:00
      final rec = createRecord(in1: null, out1: null, in2: null, out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkin_1');
    });

    test('Condition 1.2: currentTime < s1_end, check_in_1 != null and check_out_1 is null -> Alert (Cannot checkout 1 early)', () {
      final time = DateTime(2026, 8, 31, 11, 45); // 11:45 < 12:00
      final rec = createRecord(in1: '08:00 AM', out1: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, contains('មិនទាន់ដល់ម៉ោង Check-out វេនទី ១ នៅឡើយទេ'));
    });

    test('Condition 1.3: currentTime < s1_end, check_in_1 and check_out_1 both done -> Alert Session 1 បាន Check-in/out រួចរាល់ហើយ', () {
      final time = DateTime(2026, 8, 31, 11, 55); // 11:55 < 12:00
      final rec = createRecord(in1: '08:00 AM', out1: '11:50 AM');
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, 'Session 1 បាន Check-in/out រួចរាល់ហើយ');
    });

    test('Condition 2.1: currentTime >= s1_end and check_in_1 != null and check_out_1 is null -> CHECK_OUT_1 (On time / after s1_end)', () {
      final time = DateTime(2026, 8, 31, 12, 0); // 12:00 == 12:00
      final rec = createRecord(in1: '08:00 AM', out1: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkout_1');
    });

    test('Condition 2.1b: s1_end < currentTime < s2_end and forgot morning checkout -> CHECK_OUT_1', () {
      final time = DateTime(2026, 8, 31, 12, 30); // 12:30 > 12:00 and < 17:00
      final rec = createRecord(in1: '08:00 AM', out1: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkout_1');
    });

    test('Condition 2.2: s1_end <= currentTime < s2_end and check_in_2 is null -> CHECK_IN_2', () {
      final time = DateTime(2026, 8, 31, 13, 0); // 13:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkin_2');
    });

    test('Condition 2.2 (missed morning): s1_end <= currentTime < s2_end and check_in_2 is null -> CHECK_IN_2', () {
      final time = DateTime(2026, 8, 31, 14, 0); // 14:00
      final rec = createRecord(in1: null, out1: null, in2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkin_2');
    });

    test('Condition 2.3: s1_end <= currentTime < s2_end, check_in_2 != null and check_out_2 is null -> Alert (Cannot checkout 2 early)', () {
      final time = DateTime(2026, 8, 31, 16, 30); // 16:30 < 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: '01:05 PM', out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, contains('មិនទាន់ដល់ម៉ោង Check-out វេនទី ២ នៅឡើយទេ'));
    });

    test('Condition 2.4: s1_end <= currentTime < s2_end and all completed -> Alert បាន Check ពេញលេញសម្រាប់ថ្ងៃនេះហើយ', () {
      final time = DateTime(2026, 8, 31, 16, 45); // 16:45 < 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: '01:05 PM', out2: '04:40 PM');
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, 'បាន Check ពេញលេញសម្រាប់ថ្ងៃនេះហើយ');
    });

    test('Condition 3.1: currentTime >= s2_end, check_in_2 != null and check_out_2 is null -> CHECK_OUT_2 (On time / after s2_end)', () {
      final time = DateTime(2026, 8, 31, 17, 0); // 17:00 == 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: '01:00 PM', out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkout_2');
    });

    test('Condition 3.1b: currentTime > s2_end, check_in_2 != null and check_out_2 is null -> CHECK_OUT_2', () {
      final time = DateTime(2026, 8, 31, 17, 30); // 17:30 > 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: '01:00 PM', out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkout_2');
    });

    test('Condition 3.2: currentTime >= s2_end and already checked out -> Alert ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ', () {
      final time = DateTime(2026, 8, 31, 18, 0); // 18:00 >= 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: '01:00 PM', out2: '05:00 PM');
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, 'ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ');
    });

    test('Condition 3.3: currentTime >= s2_end and never checked in afternoon -> Alert ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ', () {
      final time = DateTime(2026, 8, 31, 19, 0); // 19:00 >= 17:00
      final rec = createRecord(in1: '08:00 AM', out1: '12:00 PM', in2: null, out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1End: shift1End,
        shift2End: shift2End,
        currentTime: time,
      );

      expect(res.isSuccess, false);
      expect(res.action, null);
      expect(res.alertMessage, 'ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ');
    });

    test('User Case: Shift 2 (07:00 PM - 10:00 PM) at 8:01 PM without checkIn2 -> CHECK_IN_2', () {
      final time = DateTime(2026, 8, 31, 20, 1); // 20:01 (8:01 PM)
      final rec = createRecord(in1: null, out1: null, in2: null, out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1Start: '08:00 AM',
        shift1End: '12:00 PM',
        shift2Start: '07:00 PM',
        shift2End: '10:00 PM',
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkin_2');
    });

    test('User Case: Shift 2 (07:00 PM - 10:00 PM) at 10:05 PM with checkIn2 -> CHECK_OUT_2', () {
      final time = DateTime(2026, 8, 31, 22, 5); // 22:05 (10:05 PM)
      final rec = createRecord(in1: null, out1: null, in2: '08:01 PM', out2: null);
      final res = AttendanceController.evaluateAutoShiftAction(
        todayRecord: rec,
        shift1Start: '08:00 AM',
        shift1End: '12:00 PM',
        shift2Start: '07:00 PM',
        shift2End: '10:00 PM',
        currentTime: time,
      );

      expect(res.isSuccess, true);
      expect(res.action, 'checkout_2');
    });
  });

  group('Biometric Euclidean Distance & Descriptor Verification', () {
    test('calculateEuclideanDistance: identical vectors -> 0.0', () {
      final v1 = AttendanceController.generateDeterministicDescriptor('EMP-003');
      final v2 = AttendanceController.generateDeterministicDescriptor('EMP-003');
      final dist = AttendanceController.calculateEuclideanDistance(v1, v2);

      expect(dist, 0.0);
    });

    test('calculateEuclideanDistance: different employees -> distance > 0.55', () {
      final v1 = AttendanceController.generateDeterministicDescriptor('EMP-001');
      final v2 = AttendanceController.generateDeterministicDescriptor('EMP-003');
      final dist = AttendanceController.calculateEuclideanDistance(v1, v2);

      expect(dist > 0.55, true);
    });
  });
}

