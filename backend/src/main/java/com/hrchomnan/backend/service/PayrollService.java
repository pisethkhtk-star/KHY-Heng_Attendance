package com.hrchomnan.backend.service;

import com.hrchomnan.backend.enums.ContractType;
import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.PayrollStatus;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PayrollService {

    private final PayrollRunRepository payrollRunRepository;
    private final PayslipRepository payslipRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeSalaryProfileRepository salaryProfileRepository;
    private final NssfConfigRepository nssfConfigRepository;
    private final TaxBracketRepository taxBracketRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final AttendanceRepository attendanceRepository;
    private final OvertimeRepository overtimeRepository;
    private final LeaveRepository leaveRepository;
    private final PayrollCalculationService calculationService;

    /**
     * Generate or re-calculate a monthly payroll run
     */
    public PayrollRun generatePayrollRun(int month, int year, Integer standardDays, BigDecimal exchangeRateKhr, String note, String createdBy) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate startDate = ym.atDay(1);
        LocalDate endDate = ym.atEndOfMonth();

        int workingDays = (standardDays != null && standardDays > 0) ? standardDays : 26;
        BigDecimal exRate = (exchangeRateKhr != null && exchangeRateKhr.compareTo(BigDecimal.ZERO) > 0)
                ? exchangeRateKhr
                : getOrCreateDefaultNssfConfig().getDefaultExchangeRateKhr();

        // 1. Find existing run or create new
        PayrollRun run = payrollRunRepository.findByMonthAndYear(month, year)
                .orElseGet(() -> PayrollRun.builder()
                        .month(month)
                        .year(year)
                        .startDate(startDate)
                        .endDate(endDate)
                        .title(String.format("Payroll %02d/%d", month, year))
                        .status(PayrollStatus.Draft)
                        .build());

        if (run.getStatus() == PayrollStatus.Approved || run.getStatus() == PayrollStatus.Paid) {
            throw new IllegalStateException("Cannot re-calculate an approved or paid payroll run. Please reopen first.");
        }

        run.setStandardWorkingDays(workingDays);
        run.setExchangeRateKhr(exRate);
        run.setStartDate(startDate);
        run.setEndDate(endDate);
        if (note != null && !note.isBlank()) {
            run.setNote(note);
        }
        if (createdBy != null) {
            run.setCreatedBy(createdBy);
        }
        run = payrollRunRepository.save(run);

        // Delete previous payslips if re-calculating draft
        payslipRepository.deleteByPayrollRunId(run.getId());
        payslipRepository.flush();

        // 2. Fetch dependencies
        NssfConfig nssfConfig = getOrCreateDefaultNssfConfig();
        List<TaxBracket> taxBrackets = getOrCreateDefaultTaxBrackets();
        List<Employee> employees = employeeRepository.findAll().stream()
                .filter(e -> e.getStatus() == Status.Active)
                .sorted(Comparator.comparing(Employee::getStaffId))
                .toList();

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        List<Attendance> attendances = attendanceRepository.findByAttendanceDateBetween(startDate, endDate);
        Map<String, List<Attendance>> attByStaff = attendances.stream()
                .collect(Collectors.groupingBy(Attendance::getStaffId));

        List<Overtime> overtimes = overtimeRepository.findAll().stream()
                .filter(o -> o.getStatus() == LeaveStatus.Approved && !o.getFromDate().isAfter(endDate) && !o.getToDate().isBefore(startDate))
                .toList();
        Map<String, List<Overtime>> otByStaff = overtimes.stream()
                .collect(Collectors.groupingBy(Overtime::getStaffId));

        List<Leave> leaves = leaveRepository.findAll().stream()
                .filter(l -> l.getStatus() == LeaveStatus.Approved && l.getLeaveDate() != null
                        && !l.getLeaveDate().isAfter(endDate) && !l.getLeaveDate().isBefore(startDate))
                .toList();
        Map<String, List<Leave>> leaveByStaff = leaves.stream()
                .collect(Collectors.groupingBy(Leave::getStaffId));

        List<Payslip> payslips = new ArrayList<>();

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal totalNet = BigDecimal.ZERO;
        BigDecimal totalNssfEmp = BigDecimal.ZERO;
        BigDecimal totalNssfEmpy = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        for (Employee emp : employees) {
            EmployeeSalaryProfile profile = salaryProfileRepository.findByStaffId(emp.getStaffId())
                    .orElseGet(() -> createDefaultSalaryProfile(emp));

            // Department / Position snapshot
            String deptName = emp.getDepartmentId() != null && deptMap.containsKey(emp.getDepartmentId())
                    ? deptMap.get(emp.getDepartmentId()).getNameEn() : "";
            String posTitle = emp.getPositionId() != null && posMap.containsKey(emp.getPositionId())
                    ? posMap.get(emp.getPositionId()).getTitleEn() : "";

            // Calculate Attendance stats
            List<Attendance> staffAtt = attByStaff.getOrDefault(emp.getStaffId(), Collections.emptyList());
            long workedDaysCount = staffAtt.stream()
                    .filter(a -> (a.getCheckin1() != null && !a.getCheckin1().isBlank()) || (a.getCheckin2() != null && !a.getCheckin2().isBlank()))
                    .count();
            int lateMinutes = (int) staffAtt.stream().filter(a -> Boolean.TRUE.equals(a.getIsLate())).count() * 15; // default 15 min per late if no exact duration

            // Calculate Overtime
            List<Overtime> staffOt = otByStaff.getOrDefault(emp.getStaffId(), Collections.emptyList());
            BigDecimal normalOtHours = BigDecimal.ZERO;
            BigDecimal holidayOtHours = BigDecimal.ZERO;

            for (Overtime ot : staffOt) {
                BigDecimal hours = ot.getAmountDay() != null ? ot.getAmountDay().multiply(new BigDecimal("8")) : BigDecimal.ZERO;
                // Overtime on weekend/holiday is 200%, normal is 150%
                if (ot.getFromDate() != null && (ot.getFromDate().getDayOfWeek().getValue() == 7)) {
                    holidayOtHours = holidayOtHours.add(hours);
                } else {
                    normalOtHours = normalOtHours.add(hours);
                }
            }

            // Calculate Leaves (especially unpaid leave)
            List<Leave> staffLeaves = leaveByStaff.getOrDefault(emp.getStaffId(), Collections.emptyList());
            BigDecimal unpaidLeaveDays = BigDecimal.ZERO;
            for (Leave lv : staffLeaves) {
                String type = lv.getLeaveType() != null ? lv.getLeaveType().toLowerCase() : "";
                boolean isUnpaid = type.contains("unpaid") || type.contains("up") || type.contains("ឥតប្រាក់ឈ្នួល") || type.contains("មិនគិតប្រាក់");
                if (isUnpaid && lv.getAmountDays() != null) {
                    unpaidLeaveDays = unpaidLeaveDays.add(lv.getAmountDays());
                }
            }

            PayrollCalculationService.CalculationInput input = PayrollCalculationService.CalculationInput.builder()
                    .staffId(emp.getStaffId())
                    .employeeNameEn(emp.getNameEn())
                    .employeeNameKh(emp.getNameKh())
                    .departmentName(deptName)
                    .positionTitle(posTitle)
                    .contractType(profile.getContractType())
                    .bankName(profile.getBankName())
                    .bankAccountNumber(profile.getBankAccountNumber())
                    .baseSalary(profile.getBaseSalary())
                    .standardWorkingDays(workingDays)
                    .transportAllowance(profile.getTransportAllowance())
                    .mealAllowance(profile.getMealAllowance())
                    .housingAllowance(profile.getHousingAllowance())
                    .phoneAllowance(profile.getPhoneAllowance())
                    .attendanceAllowance(profile.getAttendanceAllowance())
                    .otherAllowances(profile.getOtherAllowances())
                    .workedDays(new BigDecimal(workedDaysCount))
                    .absentDays(BigDecimal.valueOf(Math.max(0, workingDays - workedDaysCount)))
                    .lateMinutes(lateMinutes)
                    .unpaidLeaveDays(unpaidLeaveDays)
                    .normalOtHours(normalOtHours)
                    .holidayOtHours(holidayOtHours)
                    .bonusAmount(BigDecimal.ZERO)
                    .commissionAmount(BigDecimal.ZERO)
                    .advanceDeduction(BigDecimal.ZERO)
                    .otherDeductions(BigDecimal.ZERO)
                    .hasNssf(profile.getHasNssf())
                    .spouseAllowanceEligible(profile.getSpouseAllowanceEligible())
                    .dependentChildrenCount(profile.getDependentChildrenCount())
                    .month(month)
                    .year(year)
                    .exchangeRateKhr(exRate)
                    .nssfConfig(nssfConfig)
                    .taxBrackets(taxBrackets)
                    .build();

            Payslip payslip = calculationService.calculatePayslip(input);
            payslip.setPayrollRunId(run.getId());
            payslips.add(payslip);

            totalGross = totalGross.add(payslip.getGrossSalary());
            totalDeductions = totalDeductions.add(payslip.getTotalDeductions());
            totalNet = totalNet.add(payslip.getNetSalary());
            totalNssfEmp = totalNssfEmp.add(payslip.getNssfEmployeeAmount());
            totalNssfEmpy = totalNssfEmpy.add(payslip.getNssfEmployerAmount());
            totalTax = totalTax.add(payslip.getTaxOnSalaryAmount());
        }

        payslipRepository.saveAll(payslips);

        run.setTotalEmployees(payslips.size());
        run.setTotalGross(totalGross.setScale(2, RoundingMode.HALF_UP));
        run.setTotalDeductions(totalDeductions.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNet(totalNet.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNssfEmployee(totalNssfEmp.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNssfEmployer(totalNssfEmpy.setScale(2, RoundingMode.HALF_UP));
        run.setTotalTax(totalTax.setScale(2, RoundingMode.HALF_UP));

        return payrollRunRepository.save(run);
    }

    /**
     * Adjust an individual payslip in Draft mode
     */
    public Payslip adjustPayslip(UUID payslipId, BigDecimal bonus, BigDecimal commission, BigDecimal advance, BigDecimal otherDeductions, String remarks) {
        Payslip payslip = payslipRepository.findById(payslipId)
                .orElseThrow(() -> new IllegalArgumentException("Payslip not found: " + payslipId));

        PayrollRun run = payrollRunRepository.findById(payslip.getPayrollRunId())
                .orElseThrow(() -> new IllegalArgumentException("Payroll run not found: " + payslip.getPayrollRunId()));

        if (run.getStatus() == PayrollStatus.Approved || run.getStatus() == PayrollStatus.Paid) {
            throw new IllegalStateException("Cannot adjust payslips on an approved or paid payroll run.");
        }

        EmployeeSalaryProfile profile = salaryProfileRepository.findByStaffId(payslip.getStaffId())
                .orElseGet(() -> EmployeeSalaryProfile.builder().build());

        NssfConfig nssfConfig = getOrCreateDefaultNssfConfig();
        List<TaxBracket> taxBrackets = getOrCreateDefaultTaxBrackets();

        PayrollCalculationService.CalculationInput input = PayrollCalculationService.CalculationInput.builder()
                .staffId(payslip.getStaffId())
                .employeeNameEn(payslip.getEmployeeNameEn())
                .employeeNameKh(payslip.getEmployeeNameKh())
                .departmentName(payslip.getDepartmentName())
                .positionTitle(payslip.getPositionTitle())
                .contractType(payslip.getContractType())
                .bankName(payslip.getBankName())
                .bankAccountNumber(payslip.getBankAccountNumber())
                .baseSalary(payslip.getBaseSalary())
                .standardWorkingDays(payslip.getStandardWorkingDays())
                .transportAllowance(payslip.getTransportAllowance())
                .mealAllowance(payslip.getMealAllowance())
                .housingAllowance(payslip.getHousingAllowance())
                .phoneAllowance(payslip.getPhoneAllowance())
                .attendanceAllowance(payslip.getAttendanceAllowance())
                .otherAllowances(payslip.getOtherAllowances())
                .workedDays(payslip.getWorkedDays())
                .absentDays(payslip.getAbsentDays())
                .lateMinutes(payslip.getLateMinutes())
                .unpaidLeaveDays(payslip.getUnpaidLeaveDays())
                .normalOtHours(payslip.getNormalOtHours())
                .holidayOtHours(payslip.getHolidayOtHours())
                .bonusAmount(bonus != null ? bonus : payslip.getBonusAmount())
                .commissionAmount(commission != null ? commission : payslip.getCommissionAmount())
                .advanceDeduction(advance != null ? advance : payslip.getAdvanceDeduction())
                .otherDeductions(otherDeductions != null ? otherDeductions : payslip.getOtherDeductions())
                .hasNssf(profile.getHasNssf())
                .spouseAllowanceEligible(profile.getSpouseAllowanceEligible())
                .dependentChildrenCount(profile.getDependentChildrenCount())
                .month(run.getMonth())
                .year(run.getYear())
                .exchangeRateKhr(run.getExchangeRateKhr())
                .nssfConfig(nssfConfig)
                .taxBrackets(taxBrackets)
                .build();

        Payslip updated = calculationService.calculatePayslip(input);
        updated.setId(payslip.getId());
        updated.setPayrollRunId(run.getId());
        if (remarks != null) {
            updated.setRemarks(remarks);
        }

        payslipRepository.save(updated);
        recalculateRunTotals(run);
        return updated;
    }

    private void recalculateRunTotals(PayrollRun run) {
        List<Payslip> list = payslipRepository.findByPayrollRunIdOrderByStaffIdAsc(run.getId());
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal ded = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        BigDecimal nssfEmp = BigDecimal.ZERO;
        BigDecimal nssfEmpy = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;

        for (Payslip p : list) {
            gross = gross.add(p.getGrossSalary());
            ded = ded.add(p.getTotalDeductions());
            net = net.add(p.getNetSalary());
            nssfEmp = nssfEmp.add(p.getNssfEmployeeAmount());
            nssfEmpy = nssfEmpy.add(p.getNssfEmployerAmount());
            tax = tax.add(p.getTaxOnSalaryAmount());
        }

        run.setTotalGross(gross.setScale(2, RoundingMode.HALF_UP));
        run.setTotalDeductions(ded.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNet(net.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNssfEmployee(nssfEmp.setScale(2, RoundingMode.HALF_UP));
        run.setTotalNssfEmployer(nssfEmpy.setScale(2, RoundingMode.HALF_UP));
        run.setTotalTax(tax.setScale(2, RoundingMode.HALF_UP));
        payrollRunRepository.save(run);
    }

    public PayrollRun approvePayrollRun(UUID runId, String approvedBy) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Payroll run not found: " + runId));
        run.setStatus(PayrollStatus.Approved);
        run.setApprovedBy(approvedBy);
        run.setApprovedAt(LocalDateTime.now());
        return payrollRunRepository.save(run);
    }

    public PayrollRun markPaidPayrollRun(UUID runId) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Payroll run not found: " + runId));
        run.setStatus(PayrollStatus.Paid);
        run.setPaidAt(LocalDateTime.now());
        List<Payslip> slips = payslipRepository.findByPayrollRunIdOrderByStaffIdAsc(runId);
        slips.forEach(s -> s.setIsPaid(true));
        payslipRepository.saveAll(slips);
        return payrollRunRepository.save(run);
    }

    @Transactional
    public void deletePayrollRun(UUID runId) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Payroll run not found: " + runId));
        payslipRepository.deleteByPayrollRunId(runId);
        payrollRunRepository.delete(run);
    }

    public List<PayrollRun> getAllPayrollRuns() {
        return payrollRunRepository.findAllByOrderByYearDescMonthDesc();
    }

    public PayrollRun getPayrollRunById(UUID runId) {
        return payrollRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Payroll run not found: " + runId));
    }

    public List<Payslip> getPayslipsByRunId(UUID runId) {
        return payslipRepository.findByPayrollRunIdOrderByStaffIdAsc(runId);
    }

    public Payslip getPayslipById(UUID payslipId) {
        return payslipRepository.findById(payslipId)
                .orElseThrow(() -> new IllegalArgumentException("Payslip not found: " + payslipId));
    }

    // Salary Profiles Management
    public List<Map<String, Object>> getAllSalaryProfiles() {
        List<Employee> employees = employeeRepository.findAll();
        Map<String, EmployeeSalaryProfile> profileMap = salaryProfileRepository.findAll().stream()
                .collect(Collectors.toMap(EmployeeSalaryProfile::getStaffId, p -> p, (a, b) -> a));

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        return employees.stream()
                .sorted(Comparator.comparing(Employee::getStaffId))
                .map(emp -> {
                    EmployeeSalaryProfile prof = profileMap.get(emp.getStaffId());
                    Map<String, Object> map = new HashMap<>();
                    map.put("staffId", emp.getStaffId());
                    map.put("nameEn", emp.getNameEn());
                    map.put("nameKh", emp.getNameKh());
                    map.put("gender", emp.getGender());
                    map.put("status", emp.getStatus());
                    map.put("departmentName", emp.getDepartmentId() != null && deptMap.containsKey(emp.getDepartmentId())
                            ? deptMap.get(emp.getDepartmentId()).getNameEn() : "");
                    map.put("positionTitle", emp.getPositionId() != null && posMap.containsKey(emp.getPositionId())
                            ? posMap.get(emp.getPositionId()).getTitleEn() : "");

                    if (prof != null) {
                        map.put("id", prof.getId());
                        map.put("baseSalary", prof.getBaseSalary());
                        map.put("salaryCurrency", prof.getSalaryCurrency());
                        map.put("contractType", prof.getContractType());
                        map.put("bankName", prof.getBankName());
                        map.put("bankAccountNumber", prof.getBankAccountNumber());
                        map.put("bankAccountName", prof.getBankAccountName());
                        map.put("maritalStatus", prof.getMaritalStatus());
                        map.put("spouseAllowanceEligible", prof.getSpouseAllowanceEligible());
                        map.put("dependentChildrenCount", prof.getDependentChildrenCount());
                        map.put("hasNssf", prof.getHasNssf());
                        map.put("transportAllowance", prof.getTransportAllowance());
                        map.put("mealAllowance", prof.getMealAllowance());
                        map.put("housingAllowance", prof.getHousingAllowance());
                        map.put("phoneAllowance", prof.getPhoneAllowance());
                        map.put("attendanceAllowance", prof.getAttendanceAllowance());
                        map.put("otherAllowances", prof.getOtherAllowances());
                        map.put("note", prof.getNote());
                    } else {
                        map.put("baseSalary", new BigDecimal("350.00"));
                        map.put("salaryCurrency", "USD");
                        map.put("contractType", ContractType.UDC);
                        map.put("bankName", "ABA Bank");
                        map.put("bankAccountNumber", "");
                        map.put("bankAccountName", emp.getNameEn());
                        map.put("hasNssf", true);
                    }
                    return map;
                })
                .collect(Collectors.toList());
    }

    public EmployeeSalaryProfile updateSalaryProfile(String staffId, EmployeeSalaryProfile updateData) {
        EmployeeSalaryProfile profile = salaryProfileRepository.findByStaffId(staffId)
                .orElseGet(() -> EmployeeSalaryProfile.builder().staffId(staffId).build());

        if (updateData.getBaseSalary() != null) profile.setBaseSalary(updateData.getBaseSalary());
        if (updateData.getSalaryCurrency() != null) profile.setSalaryCurrency(updateData.getSalaryCurrency());
        if (updateData.getContractType() != null) profile.setContractType(updateData.getContractType());
        if (updateData.getBankName() != null) profile.setBankName(updateData.getBankName());
        if (updateData.getBankAccountNumber() != null) profile.setBankAccountNumber(updateData.getBankAccountNumber());
        if (updateData.getBankAccountName() != null) profile.setBankAccountName(updateData.getBankAccountName());
        if (updateData.getMaritalStatus() != null) profile.setMaritalStatus(updateData.getMaritalStatus());
        if (updateData.getSpouseAllowanceEligible() != null) profile.setSpouseAllowanceEligible(updateData.getSpouseAllowanceEligible());
        if (updateData.getDependentChildrenCount() != null) profile.setDependentChildrenCount(updateData.getDependentChildrenCount());
        if (updateData.getHasNssf() != null) profile.setHasNssf(updateData.getHasNssf());
        if (updateData.getTransportAllowance() != null) profile.setTransportAllowance(updateData.getTransportAllowance());
        if (updateData.getMealAllowance() != null) profile.setMealAllowance(updateData.getMealAllowance());
        if (updateData.getHousingAllowance() != null) profile.setHousingAllowance(updateData.getHousingAllowance());
        if (updateData.getPhoneAllowance() != null) profile.setPhoneAllowance(updateData.getPhoneAllowance());
        if (updateData.getAttendanceAllowance() != null) profile.setAttendanceAllowance(updateData.getAttendanceAllowance());
        if (updateData.getOtherAllowances() != null) profile.setOtherAllowances(updateData.getOtherAllowances());
        if (updateData.getNote() != null) profile.setNote(updateData.getNote());

        return salaryProfileRepository.save(profile);
    }

    @Transactional
    public NssfConfig updateNssfConfig(NssfConfig update) {
        NssfConfig current = getOrCreateDefaultNssfConfig();
        if (update.getEmployeeRate() != null) current.setEmployeeRate(update.getEmployeeRate());
        if (update.getEmployerRate() != null) current.setEmployerRate(update.getEmployerRate());
        if (update.getMaxWageCeilingKhr() != null) current.setMaxWageCeilingKhr(update.getMaxWageCeilingKhr());
        if (update.getDefaultExchangeRateKhr() != null) current.setDefaultExchangeRateKhr(update.getDefaultExchangeRateKhr());
        if (update.getIsTaxEnabled() != null) current.setIsTaxEnabled(update.getIsTaxEnabled());
        return nssfConfigRepository.save(current);
    }

    @Transactional
    public NssfConfig toggleTaxCalculation(Boolean isTaxEnabled) {
        NssfConfig current = getOrCreateDefaultNssfConfig();
        if (isTaxEnabled != null) {
            current.setIsTaxEnabled(isTaxEnabled);
        } else {
            current.setIsTaxEnabled(!current.getIsTaxEnabled());
        }
        return nssfConfigRepository.save(current);
    }

    @Transactional
    public List<TaxBracket> updateTaxBrackets(List<TaxBracket> updatedBrackets) {
        List<TaxBracket> currentList = taxBracketRepository.findAllByOrderByTierAsc();
        Map<Integer, TaxBracket> currentMap = currentList.stream()
                .filter(b -> b.getTier() != null)
                .collect(Collectors.toMap(TaxBracket::getTier, b -> b, (b1, b2) -> b1));

        for (TaxBracket u : updatedBrackets) {
            if (u.getTier() != null && currentMap.containsKey(u.getTier())) {
                TaxBracket existing = currentMap.get(u.getTier());
                if (u.getMinKhr() != null) existing.setMinKhr(u.getMinKhr());
                existing.setMaxKhr(u.getMaxKhr());
                if (u.getTaxRate() != null) existing.setTaxRate(u.getTaxRate());
                if (u.getDependentReliefKhr() != null) existing.setDependentReliefKhr(u.getDependentReliefKhr());
                if (u.getRebateKhr() != null) existing.setRebateKhr(u.getRebateKhr());
                taxBracketRepository.save(existing);
            } else {
                TaxBracket newB = TaxBracket.builder()
                        .tier(u.getTier())
                        .minKhr(u.getMinKhr() != null ? u.getMinKhr() : BigDecimal.ZERO)
                        .maxKhr(u.getMaxKhr())
                        .taxRate(u.getTaxRate() != null ? u.getTaxRate() : BigDecimal.ZERO)
                        .dependentReliefKhr(u.getDependentReliefKhr() != null ? u.getDependentReliefKhr() : new BigDecimal("150000.00"))
                        .build();
                taxBracketRepository.save(newB);
            }
        }
        return taxBracketRepository.findAllByOrderByTierAsc();
    }

    // Config Helpers
    public NssfConfig getOrCreateDefaultNssfConfig() {
        return nssfConfigRepository.findFirstByIsActiveTrueOrderByCreatedAtDesc()
                .orElseGet(() -> nssfConfigRepository.save(NssfConfig.builder()
                        .employeeRate(new BigDecimal("0.02"))
                        .employerRate(new BigDecimal("0.02"))
                        .maxWageCeilingKhr(new BigDecimal("1200000.00"))
                        .defaultExchangeRateKhr(new BigDecimal("4100.00"))
                        .isTaxEnabled(true)
                        .isActive(true)
                        .effectiveDate(LocalDate.of(2026, 1, 1))
                        .build()));
    }

    public List<TaxBracket> getOrCreateDefaultTaxBrackets() {
        List<TaxBracket> list = taxBracketRepository.findAllByOrderByTierAsc();
        if (list.isEmpty()) {
            List<TaxBracket> defaults = List.of(
                    TaxBracket.builder().tier(1).minKhr(BigDecimal.ZERO).maxKhr(new BigDecimal("1500000.00")).taxRate(BigDecimal.ZERO).dependentReliefKhr(new BigDecimal("150000.00")).build(),
                    TaxBracket.builder().tier(2).minKhr(new BigDecimal("1500000.00")).maxKhr(new BigDecimal("2000000.00")).taxRate(new BigDecimal("0.05")).dependentReliefKhr(new BigDecimal("150000.00")).build(),
                    TaxBracket.builder().tier(3).minKhr(new BigDecimal("2000000.00")).maxKhr(new BigDecimal("8500000.00")).taxRate(new BigDecimal("0.10")).dependentReliefKhr(new BigDecimal("150000.00")).build(),
                    TaxBracket.builder().tier(4).minKhr(new BigDecimal("8500000.00")).maxKhr(new BigDecimal("12500000.00")).taxRate(new BigDecimal("0.15")).dependentReliefKhr(new BigDecimal("150000.00")).build(),
                    TaxBracket.builder().tier(5).minKhr(new BigDecimal("12500000.00")).maxKhr(null).taxRate(new BigDecimal("0.20")).dependentReliefKhr(new BigDecimal("150000.00")).build()
            );
            return taxBracketRepository.saveAll(defaults);
        }
        return list;
    }

    private EmployeeSalaryProfile createDefaultSalaryProfile(Employee emp) {
        return salaryProfileRepository.save(EmployeeSalaryProfile.builder()
                .staffId(emp.getStaffId())
                .baseSalary(new BigDecimal("350.00"))
                .salaryCurrency("USD")
                .contractType(ContractType.UDC)
                .bankName("ABA Bank")
                .bankAccountName(emp.getNameEn())
                .bankAccountNumber("")
                .maritalStatus(com.hrchomnan.backend.enums.MaritalStatus.Single)
                .dependentChildrenCount(0)
                .hasNssf(true)
                .build());
    }
}
