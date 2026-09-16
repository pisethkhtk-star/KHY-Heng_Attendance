package com.hrchomnan.backend.service;

import com.hrchomnan.backend.enums.ContractType;
import com.hrchomnan.backend.model.NssfConfig;
import com.hrchomnan.backend.model.Payslip;
import com.hrchomnan.backend.model.TaxBracket;
import lombok.Builder;
import lombok.Data;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

@Service
public class PayrollCalculationService {

    @Data
    @Builder
    public static class CalculationInput {
        private String staffId;
        private String employeeNameEn;
        private String employeeNameKh;
        private String departmentName;
        private String positionTitle;
        private ContractType contractType;
        private String bankName;
        private String bankAccountNumber;

        // Compensation
        private BigDecimal baseSalary;
        private Integer standardWorkingDays; // e.g. 26
        private BigDecimal transportAllowance;
        private BigDecimal mealAllowance;
        private BigDecimal housingAllowance;
        private BigDecimal phoneAllowance;
        private BigDecimal attendanceAllowance;
        private BigDecimal otherAllowances;

        // Attendance / Time
        private BigDecimal workedDays;
        private BigDecimal absentDays;
        private Integer lateMinutes;
        private BigDecimal unpaidLeaveDays;
        private BigDecimal normalOtHours;
        private BigDecimal holidayOtHours;

        // Adjustments
        private BigDecimal bonusAmount;
        private BigDecimal commissionAmount;
        private BigDecimal advanceDeduction;
        private BigDecimal otherDeductions;

        // Tax & NSSF Parameters
        private Boolean hasNssf;
        private Boolean spouseAllowanceEligible;
        private Integer dependentChildrenCount;
        private Integer month;
        private Integer year;
        private BigDecimal exchangeRateKhr;

        // Configs
        private NssfConfig nssfConfig;
        private List<TaxBracket> taxBrackets;
    }

    public Payslip calculatePayslip(CalculationInput input) {
        BigDecimal zero = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        BigDecimal baseSalary = defaultVal(input.getBaseSalary());
        int standardDays = input.getStandardWorkingDays() != null && input.getStandardWorkingDays() > 0
                ? input.getStandardWorkingDays()
                : 26;

        BigDecimal standardDaysBd = new BigDecimal(standardDays);
        BigDecimal dailyRate = standardDaysBd.compareTo(BigDecimal.ZERO) > 0
                ? baseSalary.divide(standardDaysBd, 4, RoundingMode.HALF_UP)
                : zero;
        BigDecimal hourlyRate = dailyRate.divide(new BigDecimal("8"), 4, RoundingMode.HALF_UP);

        // Attendance figures
        BigDecimal workedDays = defaultVal(input.getWorkedDays());
        BigDecimal unpaidLeaveDays = defaultVal(input.getUnpaidLeaveDays());
        BigDecimal normalOtHours = defaultVal(input.getNormalOtHours());
        BigDecimal holidayOtHours = defaultVal(input.getHolidayOtHours());
        int lateMinutes = input.getLateMinutes() != null ? input.getLateMinutes() : 0;

        // 1. Base Salary Payable
        BigDecimal unpaidLeaveDeduction = unpaidLeaveDays.multiply(dailyRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal baseSalaryPayable = baseSalary.subtract(unpaidLeaveDeduction);
        if (baseSalaryPayable.compareTo(BigDecimal.ZERO) < 0) {
            baseSalaryPayable = zero;
        }

        // 2. Allowances
        BigDecimal transport = defaultVal(input.getTransportAllowance());
        BigDecimal meal = defaultVal(input.getMealAllowance());
        BigDecimal housing = defaultVal(input.getHousingAllowance());
        BigDecimal phone = defaultVal(input.getPhoneAllowance());
        BigDecimal attendance = defaultVal(input.getAttendanceAllowance());
        BigDecimal otherAllowances = defaultVal(input.getOtherAllowances());
        BigDecimal totalFixedAllowances = transport.add(meal).add(housing).add(phone).add(attendance).add(otherAllowances);

        // 3. Overtime (Cambodia Labor Law: 150% normal, 200% night/holiday)
        BigDecimal normalOtAmount = normalOtHours.multiply(hourlyRate).multiply(new BigDecimal("1.50")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal holidayOtAmount = holidayOtHours.multiply(hourlyRate).multiply(new BigDecimal("2.00")).setScale(2, RoundingMode.HALF_UP);

        // 4. Bonus & Commission
        BigDecimal bonus = defaultVal(input.getBonusAmount());
        BigDecimal commission = defaultVal(input.getCommissionAmount());

        // 5. Seniority Indemnity (UDC: 15 days/year -> 7.5 days in June, 7.5 days in December)
        BigDecimal seniorityIndemnity = zero;
        if (input.getContractType() == ContractType.UDC && input.getMonth() != null && (input.getMonth() == 6 || input.getMonth() == 12)) {
            seniorityIndemnity = dailyRate.multiply(new BigDecimal("7.5")).setScale(2, RoundingMode.HALF_UP);
        }

        // Gross Salary
        BigDecimal grossSalary = baseSalaryPayable
                .add(totalFixedAllowances)
                .add(normalOtAmount)
                .add(holidayOtAmount)
                .add(bonus)
                .add(commission)
                .add(seniorityIndemnity)
                .setScale(2, RoundingMode.HALF_UP);

        // Deductions:
        // A. Late deduction
        BigDecimal lateDeduction = zero;
        if (lateMinutes > 0) {
            BigDecimal lateHours = new BigDecimal(lateMinutes).divide(new BigDecimal("60"), 4, RoundingMode.HALF_UP);
            lateDeduction = lateHours.multiply(hourlyRate).setScale(2, RoundingMode.HALF_UP);
        }

        // B. NSSF (ប.ស.ស)
        BigDecimal exchangeRate = input.getExchangeRateKhr() != null && input.getExchangeRateKhr().compareTo(BigDecimal.ZERO) > 0
                ? input.getExchangeRateKhr()
                : (input.getNssfConfig() != null && input.getNssfConfig().getDefaultExchangeRateKhr() != null
                    ? input.getNssfConfig().getDefaultExchangeRateKhr()
                    : new BigDecimal("4100.00"));

        BigDecimal nssfEmployeeUsd = zero;
        BigDecimal nssfEmployeeKhr = zero;
        BigDecimal nssfEmployerUsd = zero;
        BigDecimal nssfEmployerKhr = zero;

        if (Boolean.TRUE.equals(input.getHasNssf()) && input.getNssfConfig() != null) {
            NssfConfig cfg = input.getNssfConfig();
            BigDecimal ceilingKhr = cfg.getMaxWageCeilingKhr() != null ? cfg.getMaxWageCeilingKhr() : new BigDecimal("1200000.00");
            BigDecimal empRate = cfg.getEmployeeRate() != null ? cfg.getEmployeeRate() : new BigDecimal("0.02");
            BigDecimal empyRate = cfg.getEmployerRate() != null ? cfg.getEmployerRate() : new BigDecimal("0.02");

            BigDecimal grossInKhr = grossSalary.multiply(exchangeRate);
            BigDecimal nssfContributoryWageKhr = grossInKhr.min(ceilingKhr);

            nssfEmployeeKhr = nssfContributoryWageKhr.multiply(empRate).setScale(2, RoundingMode.HALF_UP);
            nssfEmployerKhr = nssfContributoryWageKhr.multiply(empyRate).setScale(2, RoundingMode.HALF_UP);

            if (exchangeRate.compareTo(BigDecimal.ZERO) > 0) {
                nssfEmployeeUsd = nssfEmployeeKhr.divide(exchangeRate, 2, RoundingMode.HALF_UP);
                nssfEmployerUsd = nssfEmployerKhr.divide(exchangeRate, 2, RoundingMode.HALF_UP);
            }
        }

        // C. Tax on Salary (TOS - ពន្ធលើប្រាក់បៀវត្សរ៍)
        boolean isTaxEnabled = input.getNssfConfig() == null || input.getNssfConfig().getIsTaxEnabled();

        BigDecimal taxableUsd = zero;
        BigDecimal taxableSalaryKhr = zero;
        BigDecimal taxKhr = zero;
        BigDecimal taxUsd = zero;

        if (isTaxEnabled) {
            taxableUsd = grossSalary.subtract(nssfEmployeeUsd);
            if (taxableUsd.compareTo(BigDecimal.ZERO) < 0) {
                taxableUsd = zero;
            }
            taxableSalaryKhr = taxableUsd.multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP);

            // Dependent Relief: 150,000 KHR per dependent
            int dependents = (input.getDependentChildrenCount() != null ? Math.max(0, input.getDependentChildrenCount()) : 0)
                    + (Boolean.TRUE.equals(input.getSpouseAllowanceEligible()) ? 1 : 0);
            BigDecimal reliefPerPerson = new BigDecimal("150000.00");
            if (input.getTaxBrackets() != null && !input.getTaxBrackets().isEmpty()) {
                TaxBracket first = input.getTaxBrackets().get(0);
                if (first.getDependentReliefKhr() != null) {
                    reliefPerPerson = first.getDependentReliefKhr();
                }
            }
            BigDecimal totalReliefKhr = reliefPerPerson.multiply(new BigDecimal(dependents));
            BigDecimal taxableBaseKhr = taxableSalaryKhr.subtract(totalReliefKhr);
            if (taxableBaseKhr.compareTo(BigDecimal.ZERO) < 0) {
                taxableBaseKhr = zero;
            }

            taxKhr = calculateProgressiveTax(taxableBaseKhr, input.getTaxBrackets());
            taxUsd = exchangeRate.compareTo(BigDecimal.ZERO) > 0
                    ? taxKhr.divide(exchangeRate, 2, RoundingMode.HALF_UP)
                    : zero;
        }

        // D. Advance and other deductions
        BigDecimal advanceDeduction = defaultVal(input.getAdvanceDeduction());
        BigDecimal otherDeductions = defaultVal(input.getOtherDeductions());

        // Total Deductions
        BigDecimal totalDeductions = lateDeduction
                .add(unpaidLeaveDeduction)
                .add(nssfEmployeeUsd)
                .add(taxUsd)
                .add(advanceDeduction)
                .add(otherDeductions)
                .setScale(2, RoundingMode.HALF_UP);

        // Net Salary
        BigDecimal netSalary = grossSalary.subtract(totalDeductions).setScale(2, RoundingMode.HALF_UP);
        if (netSalary.compareTo(BigDecimal.ZERO) < 0) {
            netSalary = zero;
        }
        BigDecimal netSalaryKhr = netSalary.multiply(exchangeRate).setScale(2, RoundingMode.HALF_UP);

        return Payslip.builder()
                .staffId(input.getStaffId())
                .employeeNameEn(input.getEmployeeNameEn())
                .employeeNameKh(input.getEmployeeNameKh())
                .departmentName(input.getDepartmentName())
                .positionTitle(input.getPositionTitle())
                .contractType(input.getContractType() != null ? input.getContractType() : ContractType.UDC)
                .bankName(input.getBankName())
                .bankAccountNumber(input.getBankAccountNumber())
                .standardWorkingDays(standardDays)
                .workedDays(workedDays)
                .absentDays(defaultVal(input.getAbsentDays()))
                .lateMinutes(lateMinutes)
                .unpaidLeaveDays(unpaidLeaveDays)
                .normalOtHours(normalOtHours)
                .holidayOtHours(holidayOtHours)
                .baseSalary(baseSalary)
                .dailyRate(dailyRate)
                .hourlyRate(hourlyRate)
                .baseSalaryPayable(baseSalaryPayable)
                .transportAllowance(transport)
                .mealAllowance(meal)
                .housingAllowance(housing)
                .phoneAllowance(phone)
                .attendanceAllowance(attendance)
                .otherAllowances(otherAllowances)
                .normalOtAmount(normalOtAmount)
                .holidayOtAmount(holidayOtAmount)
                .bonusAmount(bonus)
                .commissionAmount(commission)
                .seniorityIndemnity(seniorityIndemnity)
                .grossSalary(grossSalary)
                .lateDeductionAmount(lateDeduction)
                .unpaidLeaveDeductionAmount(unpaidLeaveDeduction)
                .nssfEmployeeAmount(nssfEmployeeUsd)
                .nssfEmployeeKhr(nssfEmployeeKhr)
                .nssfEmployerAmount(nssfEmployerUsd)
                .nssfEmployerKhr(nssfEmployerKhr)
                .taxableSalaryKhr(taxableSalaryKhr)
                .taxOnSalaryAmount(taxUsd)
                .taxOnSalaryKhr(taxKhr)
                .advanceDeduction(advanceDeduction)
                .otherDeductions(otherDeductions)
                .totalDeductions(totalDeductions)
                .netSalary(netSalary)
                .netSalaryKhr(netSalaryKhr)
                .isPaid(false)
                .build();
    }

    /**
     * Progressive Tax calculation based on Cambodian GDT Brackets:
     * Tier 1: 0 - 1,500,000 KHR -> 0%
     * Tier 2: 1,500,001 - 2,000,000 KHR -> 5%
     * Tier 3: 2,000,001 - 8,500,000 KHR -> 10%
     * Tier 4: 8,500,001 - 12,500,000 KHR -> 15%
     * Tier 5: > 12,500,000 KHR -> 20%
     */
    public BigDecimal calculateProgressiveTax(BigDecimal taxableKhr, List<TaxBracket> brackets) {
        if (taxableKhr == null || taxableKhr.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        // Fallback default brackets if list is empty
        if (brackets == null || brackets.isEmpty()) {
            return calculateDefaultCambodiaTax(taxableKhr);
        }

        List<TaxBracket> sorted = brackets.stream()
                .sorted(Comparator.comparing(TaxBracket::getTier))
                .toList();

        BigDecimal totalTax = BigDecimal.ZERO;

        for (TaxBracket b : sorted) {
            BigDecimal min = b.getMinKhr() != null ? b.getMinKhr() : BigDecimal.ZERO;
            BigDecimal max = b.getMaxKhr();
            BigDecimal rate = b.getTaxRate() != null ? b.getTaxRate() : BigDecimal.ZERO;

            if (taxableKhr.compareTo(min) > 0) {
                BigDecimal upper = max != null ? taxableKhr.min(max) : taxableKhr;
                BigDecimal taxableInBracket = upper.subtract(min);
                if (taxableInBracket.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal taxInBracket = taxableInBracket.multiply(rate);
                    totalTax = totalTax.add(taxInBracket);
                }
            }
        }

        return totalTax.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateDefaultCambodiaTax(BigDecimal taxableKhr) {
        // Cambodia GDT standard brackets:
        // 0 to 1,500,000: 0%
        // 1,500,000 to 2,000,000: 5%
        // 2,000,000 to 8,500,000: 10%
        // 8,500,000 to 12,500,000: 15%
        // > 12,500,000: 20%
        BigDecimal t1 = new BigDecimal("1500000");
        BigDecimal t2 = new BigDecimal("2000000");
        BigDecimal t3 = new BigDecimal("8500000");
        BigDecimal t4 = new BigDecimal("12500000");

        BigDecimal tax = BigDecimal.ZERO;
        if (taxableKhr.compareTo(t1) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        // 1.5M - 2M (5%)
        if (taxableKhr.compareTo(t1) > 0) {
            BigDecimal taxable = taxableKhr.min(t2).subtract(t1);
            tax = tax.add(taxable.multiply(new BigDecimal("0.05")));
        }
        // 2M - 8.5M (10%)
        if (taxableKhr.compareTo(t2) > 0) {
            BigDecimal taxable = taxableKhr.min(t3).subtract(t2);
            tax = tax.add(taxable.multiply(new BigDecimal("0.10")));
        }
        // 8.5M - 12.5M (15%)
        if (taxableKhr.compareTo(t3) > 0) {
            BigDecimal taxable = taxableKhr.min(t4).subtract(t3);
            tax = tax.add(taxable.multiply(new BigDecimal("0.15")));
        }
        // > 12.5M (20%)
        if (taxableKhr.compareTo(t4) > 0) {
            BigDecimal taxable = taxableKhr.subtract(t4);
            tax = tax.add(taxable.multiply(new BigDecimal("0.20")));
        }

        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal defaultVal(BigDecimal val) {
        return val != null ? val : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
