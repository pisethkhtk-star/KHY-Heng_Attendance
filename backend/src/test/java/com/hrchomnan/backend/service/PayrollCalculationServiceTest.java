package com.hrchomnan.backend.service;

import com.hrchomnan.backend.enums.ContractType;
import com.hrchomnan.backend.model.NssfConfig;
import com.hrchomnan.backend.model.Payslip;
import com.hrchomnan.backend.model.TaxBracket;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class PayrollCalculationServiceTest {

    private PayrollCalculationService calculationService;
    private NssfConfig nssfConfig;
    private List<TaxBracket> taxBrackets;

    @BeforeEach
    public void setup() {
        calculationService = new PayrollCalculationService();

        nssfConfig = NssfConfig.builder()
                .employeeRate(new BigDecimal("0.02"))
                .employerRate(new BigDecimal("0.02"))
                .maxWageCeilingKhr(new BigDecimal("1200000.00"))
                .defaultExchangeRateKhr(new BigDecimal("4100.00"))
                .build();

        taxBrackets = List.of(
                TaxBracket.builder().tier(1).minKhr(BigDecimal.ZERO).maxKhr(new BigDecimal("1500000")).taxRate(BigDecimal.ZERO).dependentReliefKhr(new BigDecimal("150000")).build(),
                TaxBracket.builder().tier(2).minKhr(new BigDecimal("1500000")).maxKhr(new BigDecimal("2000000")).taxRate(new BigDecimal("0.05")).dependentReliefKhr(new BigDecimal("150000")).build(),
                TaxBracket.builder().tier(3).minKhr(new BigDecimal("2000000")).maxKhr(new BigDecimal("8500000")).taxRate(new BigDecimal("0.10")).dependentReliefKhr(new BigDecimal("150000")).build(),
                TaxBracket.builder().tier(4).minKhr(new BigDecimal("8500000")).maxKhr(new BigDecimal("12500000")).taxRate(new BigDecimal("0.15")).dependentReliefKhr(new BigDecimal("150000")).build(),
                TaxBracket.builder().tier(5).minKhr(new BigDecimal("12500000")).maxKhr(null).taxRate(new BigDecimal("0.20")).dependentReliefKhr(new BigDecimal("150000")).build()
        );
    }

    @Test
    public void testBasicSalaryCalculationWithoutDeductions() {
        PayrollCalculationService.CalculationInput input = PayrollCalculationService.CalculationInput.builder()
                .staffId("EMP001")
                .employeeNameEn("Sok Dara")
                .baseSalary(new BigDecimal("300.00"))
                .standardWorkingDays(26)
                .contractType(ContractType.FDC)
                .hasNssf(true)
                .nssfConfig(nssfConfig)
                .taxBrackets(taxBrackets)
                .exchangeRateKhr(new BigDecimal("4100.00"))
                .month(7)
                .year(2026)
                .build();

        Payslip payslip = calculationService.calculatePayslip(input);

        assertNotNull(payslip);
        assertEquals(new BigDecimal("300.00"), payslip.getGrossSalary());

        // NSSF: 300 USD * 4100 = 1,230,000 KHR > 1,200,000 KHR ceiling
        // Contributory wage capped at 1,200,000 KHR
        // NSSF 2% = 24,000 KHR = 24,000 / 4100 = 5.85 USD
        assertEquals(new BigDecimal("24000.00"), payslip.getNssfEmployeeKhr());
        assertEquals(new BigDecimal("5.85"), payslip.getNssfEmployeeAmount());

        // Taxable salary: 300 - 5.85 = 294.15 USD * 4100 = 1,206,015 KHR <= 1,500,000 KHR -> 0% Tax
        assertEquals(new BigDecimal("0.00"), payslip.getTaxOnSalaryAmount());

        // Net = Gross (300) - Deductions (5.85) = 294.15 USD
        assertEquals(new BigDecimal("294.15"), payslip.getNetSalary());
    }

    @Test
    public void testOvertimeCalculation150And200Percent() {
        // Base salary $520, 26 days -> $20/day -> $2.50/hour
        PayrollCalculationService.CalculationInput input = PayrollCalculationService.CalculationInput.builder()
                .staffId("EMP002")
                .baseSalary(new BigDecimal("520.00"))
                .standardWorkingDays(26)
                .contractType(ContractType.FDC)
                .normalOtHours(new BigDecimal("10.00"))   // 10 hrs * 2.50 * 1.5 = $37.50
                .holidayOtHours(new BigDecimal("5.00"))   // 5 hrs * 2.50 * 2.0 = $25.00
                .hasNssf(false)
                .taxBrackets(taxBrackets)
                .exchangeRateKhr(new BigDecimal("4100.00"))
                .month(7)
                .year(2026)
                .build();

        Payslip payslip = calculationService.calculatePayslip(input);

        assertEquals(new BigDecimal("37.50"), payslip.getNormalOtAmount());
        assertEquals(new BigDecimal("25.00"), payslip.getHolidayOtAmount());
        // Gross = 520 + 37.50 + 25.00 = 582.50
        assertEquals(new BigDecimal("582.50"), payslip.getGrossSalary());
    }

    @Test
    public void testSeniorityIndemnityForUdcInJuneAndDecember() {
        // Base salary $260, 26 days -> $10/day
        // June: Seniority = 10 * 7.5 = $75.00
        PayrollCalculationService.CalculationInput inputJune = PayrollCalculationService.CalculationInput.builder()
                .staffId("EMP003")
                .baseSalary(new BigDecimal("260.00"))
                .standardWorkingDays(26)
                .contractType(ContractType.UDC)
                .hasNssf(false)
                .taxBrackets(taxBrackets)
                .exchangeRateKhr(new BigDecimal("4100.00"))
                .month(6)
                .year(2026)
                .build();

        Payslip payslipJune = calculationService.calculatePayslip(inputJune);
        assertEquals(new BigDecimal("75.00"), payslipJune.getSeniorityIndemnity());
        assertEquals(new BigDecimal("335.00"), payslipJune.getGrossSalary()); // 260 + 75

        // July: Seniority = 0
        PayrollCalculationService.CalculationInput inputJuly = PayrollCalculationService.CalculationInput.builder()
                .staffId("EMP003")
                .baseSalary(new BigDecimal("260.00"))
                .standardWorkingDays(26)
                .contractType(ContractType.UDC)
                .hasNssf(false)
                .taxBrackets(taxBrackets)
                .exchangeRateKhr(new BigDecimal("4100.00"))
                .month(7)
                .year(2026)
                .build();

        Payslip payslipJuly = calculationService.calculatePayslip(inputJuly);
        assertEquals(new BigDecimal("0.00"), payslipJuly.getSeniorityIndemnity());
    }

    @Test
    public void testTaxOnSalaryWithChildrenDeduction() {
        // High earner: $1,500 USD * 4100 = 6,150,000 KHR
        // NSSF capped at 1,200,000 -> 24,000 KHR = 5.85 USD
        // Taxable USD: 1,494.15 USD * 4100 = 6,126,015 KHR
        // Without children: in 2M - 8.5M bracket (10%)
        // With 2 children: 2 * 150,000 = 300,000 KHR deduction
        PayrollCalculationService.CalculationInput input = PayrollCalculationService.CalculationInput.builder()
                .staffId("EMP004")
                .baseSalary(new BigDecimal("1500.00"))
                .standardWorkingDays(26)
                .contractType(ContractType.UDC)
                .hasNssf(true)
                .nssfConfig(nssfConfig)
                .taxBrackets(taxBrackets)
                .dependentChildrenCount(2)
                .exchangeRateKhr(new BigDecimal("4100.00"))
                .month(5)
                .year(2026)
                .build();

        Payslip payslip = calculationService.calculatePayslip(input);

        assertTrue(payslip.getTaxOnSalaryAmount().compareTo(BigDecimal.ZERO) > 0);
        assertTrue(payslip.getNetSalary().compareTo(new BigDecimal("1300.00")) > 0);
    }
}
